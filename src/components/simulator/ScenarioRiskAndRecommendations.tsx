import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  CheckCircle2,
  Droplets,
  Info,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { CROP_KNOWLEDGE_DATABASE } from '../../data/cropKnowledgeDb';
import { knowledgeEntryToCropProfile } from '../../lib/cropSuitabilityEngine';
import type {
  CropProfile,
  ScenarioRiskLevel,
  ScenarioSimulationResult,
} from '../../types/rotatewise';

interface ScenarioRiskAndRecommendationsProps {
  result: ScenarioSimulationResult;
  onSelectPrimaryCrop: (cropId: string) => void;
  onAddToRotation?: (crop: CropProfile) => void;
}

function getRiskToneClasses(level: ScenarioRiskLevel): {
  card: string;
  badge: string;
} {
  if (level === 'Critical') {
    return {
      card: 'border-[#E6B8B8] bg-[#FEF2F2]',
      badge: 'bg-[#991B1B] text-white',
    };
  }
  if (level === 'High') {
    return {
      card: 'border-[#F2C6C6] bg-[#FFF5F5]',
      badge: 'bg-[#DC2626] text-white',
    };
  }
  if (level === 'Moderate') {
    return {
      card: 'border-[#F3D8A8] bg-[#FFFBEB]',
      badge: 'bg-[#B45309] text-white',
    };
  }
  return {
    card: 'border-[#CFE4D6] bg-[#F5FAF7]',
    badge: 'bg-[#154734] text-white',
  };
}

export function ScenarioRiskAndRecommendations({
  result,
  onSelectPrimaryCrop,
  onAddToRotation,
}: ScenarioRiskAndRecommendationsProps) {
  if (result.status !== 'ready') return null;

  const { recommendations, risks } = result;

  return (
    <div className="space-y-6">
      {/* Rule-Based Scenario Risk Analysis */}
      <section
        aria-label="Rule-based scenario risk analysis"
        className="rounded-xl border border-[#E4E2DA] bg-white p-5 shadow-[0_1px_2px_rgba(18,43,29,0.03)]"
      >
        <div className="flex flex-col gap-1 border-b border-[#ECEAE3] pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#14221A]">
              <ShieldAlert className="h-4 w-4 text-[#154734]" aria-hidden="true" />
              <span>Scenario Risk Analysis (Deterministic Rules)</span>
            </h2>
            <p className="mt-0.5 text-xs text-[#6B7970]">
              Every classification is computed from explicit climate, water, soil, seasonal, and rotation rules.
            </p>
          </div>
          <span className="text-xs font-semibold text-[#14221A]">
            Peak Risk: <strong>{result.highestRiskLevel}</strong>
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {risks.map((risk) => {
            const tone = getRiskToneClasses(risk.level);
            return (
              <div
                key={risk.id}
                className={`flex flex-col justify-between rounded-lg border p-3.5 ${tone.card}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#14221A]">{risk.label}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone.badge}`}
                    >
                      {risk.level}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#4B5B51]">
                    {risk.explanation}
                  </p>
                </div>
                <p className="mt-2 border-t border-black/10 pt-1.5 text-[11px] font-medium text-[#5F6E65]">
                  {risk.ruleApplied}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Scenario Recommendations */}
      <section
        aria-label="Scenario agronomic recommendations"
        className="rounded-xl border border-[#E4E2DA] bg-white p-5 shadow-[0_1px_2px_rgba(18,43,29,0.03)]"
      >
        <div className="border-b border-[#ECEAE3] pb-3">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#14221A]">
            <Sparkles className="h-4 w-4 text-[#154734]" aria-hidden="true" />
            <span>Scenario Recommendations &amp; Crop Shifts</span>
          </h2>
          <p className="mt-0.5 text-xs text-[#6B7970]">
            Powered by Crop Intelligence Engine &amp; Rotation Planner — evaluates resilience and rotation compatibility across all 10 crops.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Column 1: Remains Suitable */}
          <div className="rounded-lg border border-[#CFE4D6] bg-[#F5FAF7] p-4">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#154734]">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Remains Suitable ({recommendations.remainsSuitable.length})</span>
            </h3>
            {recommendations.remainsSuitable.length === 0 ? (
              <p className="mt-2 text-xs text-[#4B5B51]">
                No evaluated crops exceed 70/100 under this extreme stress scenario without supplemental irrigation.
              </p>
            ) : (
              <ul className="mt-2.5 space-y-2">
                {recommendations.remainsSuitable.slice(0, 5).map((crop) => (
                  <li
                    key={crop.cropId}
                    className="flex items-center justify-between gap-2 rounded-md border border-[#DCEAE1] bg-white px-2.5 py-2 text-xs"
                  >
                    <div>
                      <button
                        type="button"
                        onClick={() => onSelectPrimaryCrop(crop.cropId)}
                        className="font-semibold text-[#14221A] hover:underline"
                      >
                        {crop.cropName}
                      </button>
                      <span className="block text-[11px] text-[#6B7970]">
                        {crop.family} · Rotation: {crop.rotationStatus === 'clean' ? 'Clean' : 'Conflict'}
                      </span>
                    </div>
                    <span className="font-mono font-bold tabular-nums text-[#154734]">
                      {crop.simulatedScore}/100
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Column 2: Becomes Less Suitable */}
          <div className="rounded-lg border border-[#F3D8A8] bg-[#FFFBEB] p-4">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#92400E]">
              <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Becomes Less Suitable ({recommendations.becomesLessSuitable.length})</span>
            </h3>
            {recommendations.becomesLessSuitable.length === 0 ? (
              <p className="mt-2 text-xs text-[#4B5B51]">
                No crops dropped ≥ 8 points or fell suitability tiers compared to the baseline NASA POWER window.
              </p>
            ) : (
              <ul className="mt-2.5 space-y-2">
                {recommendations.becomesLessSuitable.slice(0, 5).map((crop) => (
                  <li
                    key={crop.cropId}
                    className="flex items-center justify-between gap-2 rounded-md border border-[#F3DFB8] bg-white px-2.5 py-2 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-[#14221A]">{crop.cropName}</span>
                      <span className="block text-[11px] text-[#6B7970]">
                        {crop.baselineSuitability} ({crop.baselineScore}) → {crop.simulatedSuitability} ({crop.simulatedScore})
                      </span>
                    </div>
                    <span className="font-mono font-bold tabular-nums text-[#B91C1C]">
                      {crop.scoreDelta} pts
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Column 3: Better Alternatives + Irrigation */}
          <div className="rounded-lg border border-[#E4E2DA] bg-[#FAFAF7] p-4">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#14221A]">
              <Droplets className="h-3.5 w-3.5 text-[#154734]" aria-hidden="true" />
              <span>Alternative Crops &amp; Irrigation</span>
            </h3>

            <div className="mt-2.5 space-y-2">
              {recommendations.betterAlternatives.slice(0, 3).map((alt) => {
                const knowledgeEntry = CROP_KNOWLEDGE_DATABASE.find(
                  (e) => e.id === alt.cropId
                );
                return (
                  <div
                    key={alt.cropId}
                    className="rounded-md border border-[#E4E2DA] bg-white p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#14221A]">{alt.cropName}</span>
                      <span className="font-mono font-bold tabular-nums text-[#154734]">
                        {alt.simulatedScore}/100
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#5F6E65]">
                      {alt.waterNeedMm[0]}–{alt.waterNeedMm[1]} mm · {alt.irrigationDependency} ·{' '}
                      {alt.rotationStatus === 'clean' ? 'Rotation clean' : 'Rotation conflict'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectPrimaryCrop(alt.cropId)}
                        className="inline-flex h-7 items-center gap-1 rounded border border-[#D8D5CB] bg-[#FAFAF7] px-2 text-[11px] font-medium text-[#14221A] hover:bg-[#F2F6F3]"
                      >
                        <span>Simulate</span>
                        <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </button>
                      {onAddToRotation && knowledgeEntry && (
                        <button
                          type="button"
                          onClick={() =>
                            onAddToRotation(knowledgeEntryToCropProfile(knowledgeEntry))
                          }
                          className="inline-flex h-7 items-center rounded border border-[#154734] bg-[#154734] px-2 text-[11px] font-medium text-white hover:bg-[#0F3527]"
                        >
                          Schedule Next
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="rounded-md border border-[#D4E6DA] bg-[#F4FAF6] p-2.5 text-[11px] text-[#154734]">
                <p className="font-semibold">Water &amp; Irrigation Guidance:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {recommendations.irrigationGuidance.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Assumptions & Limitations Disclosure */}
        <div className="mt-4 rounded-lg border border-[#E4E2DA] bg-[#FBFBF9] p-3.5 text-xs">
          <p className="flex items-center gap-1.5 font-semibold text-[#14221A]">
            <Info className="h-3.5 w-3.5 text-[#154734]" aria-hidden="true" />
            <span>Simulation Assumptions &amp; Limitations</span>
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[11px] text-[#4B5B51]">
            {recommendations.assumptionsAndLimitations.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          {recommendations.priorityRisks.length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[#92400E]">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                Priority risks requiring mitigation:{' '}
                {recommendations.priorityRisks.map((r) => `${r.label} (${r.level})`).join(', ')}.
              </span>
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
