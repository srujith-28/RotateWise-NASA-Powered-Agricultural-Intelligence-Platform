import { GoogleGenAI } from '@google/genai';
import { DEMO_CROPS } from '../../src/data/demoData.ts';
import {
  calculateRotationEfficiency,
  getRecommendedNextCrops,
} from '../../src/lib/agronomy.ts';
import type { Farm, FarmClimateProfile } from '../../src/types/rotatewise.ts';

export interface AdvisorQueryPayload {
  prompt: string;
  farm: Farm;
  climate: FarmClimateProfile;
  includeFarmContext: boolean;
}

export interface AdvisorResponse {
  reply: string;
  sourceMode: 'gemini-live' | 'local-agronomy-demo';
  modelUsed?: string;
  notice?: string;
}

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim().length > 0 && key !== 'MY_GEMINI_API_KEY');
}

function buildLocalAgronomyFallback(
  payload: AdvisorQueryPayload,
  reasonNotice: string
): AdvisorResponse {
  const { farm, climate, prompt } = payload;
  const recs = getRecommendedNextCrops(farm, climate, DEMO_CROPS);
  const top = recs[0];
  const second = recs[1];
  const rotationEval = calculateRotationEfficiency(farm.rotationPlan, DEMO_CROPS, farm);

  const lower = prompt.toLowerCase();
  const focusDrought =
    lower.includes('drought') ||
    lower.includes('rain') ||
    lower.includes('moisture') ||
    lower.includes('water');
  const focusNitrogen =
    lower.includes('nitrogen') ||
    lower.includes('soil') ||
    lower.includes('fertilizer');

  const lines: string[] = [
    `Agronomic Guidance for ${farm.name} (${farm.location})`,
    '',
    `Current Field Baseline: ${farm.landAreaAcres} acres on ${farm.soilType} (${farm.irrigation}), currently planted in ${farm.currentCropName}. Rotation efficiency evaluates to ${rotationEval.efficiencyScore}/100 with ${climate.annualRainfallMm} mm annual precipitation in the local demonstration dataset.`,
  ];

  if (focusDrought) {
    lines.push(
      '',
      `Moisture Resilience Strategy: ${farm.irrigation === 'Dryland (Rainfed Only)' ? 'Because this field is rainfed-only, residue retention and shallow cover crops are critical.' : `With ${farm.irrigation}, schedule peak moisture delivery during reproductive growth stages.`} Consider ${top.crop.name} (${top.suitabilityScore}/100 fit) or ${second.crop.name} to buffer evapotranspiration losses.`
    );
  } else if (focusNitrogen) {
    lines.push(
      '',
      `Soil Nitrogen & Organic Matter Plan: Following ${farm.currentCropName}, scheduling ${top.crop.name} delivers an estimated ${top.nitrogenGainKgHa >= 0 ? `+${top.nitrogenGainKgHa}` : top.nitrogenGainKgHa} kg/ha nitrogen balance shift. Pairing an autumn nitrogen-scavenging cover crop such as Oilseed Radish helps capture residual nitrate.`
    );
  } else {
    lines.push(
      '',
      `Next-Season Recommendation: ${top.crop.name} scores ${top.suitabilityScore}/100 (${top.fitLabel}) — ${top.rationale}`
    );
    if (second) {
      lines.push(
        `Secondary Option: ${second.crop.name} (${second.suitabilityScore}/100) — ${second.rationale}`
      );
    }
  }

  if (rotationEval.warnings.length > 0) {
    lines.push('', `Sequence Alert: ${rotationEval.warnings[0]}`);
  }

  return {
    reply: lines.join('\n'),
    sourceMode: 'local-agronomy-demo',
    notice: reasonNotice,
  };
}

export async function askFarmAdvisor(
  payload: AdvisorQueryPayload
): Promise<AdvisorResponse> {
  if (!isGeminiConfigured()) {
    return buildLocalAgronomyFallback(
      payload,
      'Running in Local Agronomy Demo mode (Gemini API key not configured on server).'
    );
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const contextBlock = payload.includeFarmContext
      ? [
          `Farm Name: ${payload.farm.name}`,
          `Location: ${payload.farm.location} (${payload.farm.coordinates.lat}, ${payload.farm.coordinates.lng})`,
          `Area: ${payload.farm.landAreaAcres} acres`,
          `Soil Type: ${payload.farm.soilType} (pH ${payload.farm.health.phLevel}, OM ${payload.farm.health.organicMatterPct}%)`,
          `Irrigation: ${payload.farm.irrigation}`,
          `Current Crop: ${payload.farm.currentCropName}`,
          `Planned Sequence: ${payload.farm.rotationPlan.map((s) => `${s.season}: ${s.cropName}`).join(' -> ')}`,
          `Climate Baseline (Demo): ${payload.climate.annualRainfallMm} mm annual rain, ${payload.climate.meanGrowingTempC} C growing mean, ${payload.climate.frostFreeDays} frost-free days.`,
        ].join('\n')
      : 'No farm context attached; provide general crop rotation agronomy advice.';

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Gemini request timed out (503/busy)')), 6000);
    });

    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Farmer Question: ${payload.prompt}\n\nField Context:\n${contextBlock}`,
        config: {
          systemInstruction:
            'You are RotateWise AI Farm Advisor, a concise, practical precision agronomist. Give grounded, actionable crop rotation, soil nitrogen, and climate resilience guidance in plain structured paragraphs without markdown fluff or hype.',
        },
      }),
      timeoutPromise,
    ]);

    const text = response.text?.trim();
    if (!text) {
      return buildLocalAgronomyFallback(
        payload,
        'Gemini returned an empty response; showing local agronomy demo guidance.'
      );
    }

    return {
      reply: text,
      sourceMode: 'gemini-live',
      modelUsed: 'gemini-4-hydrogen',
    };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : '';
    const isTransient =
      rawMsg.includes('503') ||
      rawMsg.includes('UNAVAILABLE') ||
      rawMsg.includes('429');
    const cleanReason = isTransient
      ? 'Live Gemini model is temporarily at high demand; showing Local Agronomy Demo guidance.'
      : 'Live Gemini service unavailable right now; showing Local Agronomy Demo guidance.';
    return buildLocalAgronomyFallback(payload, cleanReason);
  }
}
