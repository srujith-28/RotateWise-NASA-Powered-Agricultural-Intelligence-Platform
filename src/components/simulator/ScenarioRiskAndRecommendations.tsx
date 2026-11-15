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
      card: 'bg-[#FEF2F2]',
      badge: 'bg-[#991B1B] text-white',
    };
  }
  if (level === 'High') {
    return {
      card: 'bg-[#FEF4F4]',
      badge: 'bg-[#B91C1C] text-white',
    };
  }
  if (level === 'Moderate') {
    return {
      card: 'bg-[#FDF7EB]',
      badge: 'bg-[#B45309] text-white',
    };
  }
  return {
    card: 'bg-[#F2F7F3]',
    badge: 'bg-[#174C3C] text-white',
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
        className="rounded-2xl border border-[#E7EBE7] bg-white p-5 sm:p-6"
      >
        <div className="flex flex-col gap-1 border-b border-[#E7EBE7] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-semibold tracking-[-0.015em] text-[#18231E]">
              <ShieldAlert className="h-4 w-4 text-[#174C3C]" aria-hidden="true" />
              <span>Scenario Risk Analysis (Deterministic Rules)</span>
            </h2>
            <p className="mt-0.5 text-xs text-[#737D76]">
              Every classification is computed from explicit climate, water, soil, seasonal, and rotation rules.
            </p>
          </div>
          <span className="text-xs font-medium text-[#737D76]">
            Peak Risk: <strong className="font-semibold text-[#18231E]">{result.highestRiskLevel}</strong>
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {risks.map((risk) => {
            const tone = getRiskToneClasses(risk.level);
            return (
              <div
                key={risk.id}
                className={`flex flex-col justify-between rounded-xl p-4 ${tone.card}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#18231E]">{risk.label}</span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${tone.badge}`}
                    >
                      {risk.level}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[#4B5B51]">
                    {risk.explanation}
                  </p>
                </div>
                <p className="mt-3 border-t border-black/8 pt-2 text-[11px] font-medium text-[#737D76]">
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
        className="rounded-2xl border border-[#E7EBE7] bg-white p-5 sm:p-6"
      >
        <div className="border-b border-[#E7EBE7] pb-4">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold tracking-[-0.015em] text-[#18231E]">
            <Sparkles className="h-4 w-4 text-[#174C3C]" aria-hidden="true" />
            <span>Scenario Recommendations &amp; Crop Shifts</span>
          </h2>
          <p className="mt-0.5 text-xs text-[#737D76]">
            Powered by Crop Intelligence Engine &amp; Rotation Planner — evaluates resilience and rotation compatibility across all 10 crops.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Column 1: Remains Suitable */}
          <div className="rounded-xl bg-[#F2F7F3] p-4">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-[#174C3C]">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Remains Suitable ({recommendations.remainsSuitable.length})</span>
            </h3>
            {recommendations.remainsSuitable.length === 0 ? (
              <p className="mt-2.5 text-xs text-[#737D76]">
                No evaluated crops exceed 70/100 under this extreme stress scenario without supplemental irrigation.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-[#DCE8DF] rounded-xl bg-white">
                {recommendations.remainsSuitable.slice(0, 5).map((crop) => (
                  <li
                    key={crop.cropId}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs"
                  >
                    <div>
                      <button
                        type="button"
                        onClick={() => onSelectPrimaryCrop(crop.cropId)}
                        className="font-semibold text-[#18231E] hover:text-[#174C3C] hover:underline"
                      >
                        {crop.cropName}
                      </button>
                      <span className="block text-[11px] text-[#737D76]">
                        {crop.family} · Rotation: {crop.rotationStatus === 'clean' ? 'Clean' : 'Conflict'}
                      </span>
                    </div>
                    <span className="font-mono font-bold tabular-nums text-[#174C3C]">
                      {crop.simulatedScore}/100
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Column 2: Becomes Less Suitable */}
          <div className="rounded-xl bg-[#FDF7EB] p-4">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-[#9A5B00]">
              <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Becomes Less Suitable ({recommendations.becomesLessSuitable.length})</span>
            </h3>
            {recommendations.becomesLessSuitable.length === 0 ? (
              <p className="mt-2.5 text-xs text-[#737D76]">
                No crops dropped ≥ 8 points or fell suitability tiers compared to the baseline NASA POWER window.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-[#F3E2C1] rounded-xl bg-white">
                {recommendations.becomesLessSuitable.slice(0, 5).map((crop) => (
                  <li
                    key={crop.cropId}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-[#18231E]">{crop.cropName}</span>
                      <span className="block text-[11px] text-[#737D76]">
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
          <div className="rounded-xl bg-[#F7F8F6] p-4">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-[#18231E]">
              <Droplets className="h-3.5 w-3.5 text-[#174C3C]" aria-hidden="true" />
              <span>Alternative Crops &amp; Irrigation</span>
            </h3>

            <div className="mt-3 space-y-2.5">
              {recommendations.betterAlternatives.slice(0, 3).map((alt) => {
                const knowledgeEntry = CROP_KNOWLEDGE_DATABASE.find(
                  (e) => e.id === alt.cropId
                );
                return (
                  <div
                    key={alt.cropId}
                    className="rounded-xl bg-white p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#18231E]">{alt.cropName}</span>
                      <span className="font-mono font-bold tabular-nums text-[#174C3C]">
                        {alt.simulatedScore}/100
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#737D76]">
                      {alt.waterNeedMm[0]}–{alt.waterNeedMm[1]} mm · {alt.irrigationDependency} ·{' '}
                      {alt.rotationStatus === 'clean' ? 'Rotation clean' : 'Rotation conflict'}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectPrimaryCrop(alt.cropId)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E7EBE7] bg-[#F7F8F6] px-2.5 text-[11px] font-medium text-[#18231E] hover:bg-[#EAF2EC]"
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
                          className="inline-flex h-8 items-center rounded-lg bg-[#174C3C] px-2.5 text-[11px] font-medium text-white hover:bg-[#133F32]"
                        >
                          Schedule Next
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="rounded-xl bg-[#EAF2EC] p-3 text-[11px] text-[#174C3C]">
                <p className="font-semibold">Water &amp; Irrigation Guidance</p>
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
        <div className="mt-5 rounded-xl bg-[#F7F8F6] p-4 text-xs">
          <p className="flex items-center gap-1.5 font-semibold text-[#18231E]">
            <Info className="h-3.5 w-3.5 text-[#174C3C]" aria-hidden="true" />
            <span>Simulation Assumptions &amp; Limitations</span>
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-[#737D76]">
            {recommendations.assumptionsAndLimitations.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          {recommendations.priorityRisks.length > 0 && (
            <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-[#9A5B00]">
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
