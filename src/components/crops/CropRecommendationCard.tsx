import {
  AlertCircle,
  Check,
  CheckCircle2,
  Droplets,
  Eye,
  GitCompareArrows,
  Info,
  Leaf,
  Plus,
} from 'lucide-react';
import type { CropKnowledgeEntry, CropSuitabilityEvaluation } from '../../types/rotatewise';
import { MetricTooltip } from '../common/MetricTooltip';

interface CropRecommendationCardProps {
  rank: number;
  evaluation: CropSuitabilityEvaluation;
  isSelectedProfile: boolean;
  isCompared: boolean;
  compareLimitReached: boolean;
  onViewProfile: (cropId: string) => void;
  onToggleCompare: (cropId: string) => void;
  onAddToRotation: (entry: CropKnowledgeEntry) => void;
}

export function CropRecommendationCard({
  rank,
  evaluation,
  isSelectedProfile,
  isCompared,
  compareLimitReached,
  onViewProfile,
  onToggleCompare,
  onAddToRotation,
}: CropRecommendationCardProps) {
  const { crop, overallScore, suitabilityCategory, confidenceLevel, dataCompletenessPct } =
    evaluation;

  const categoryColor =
    suitabilityCategory === 'High'
      ? 'text-[#174C3C]'
      : suitabilityCategory === 'Moderate'
        ? 'text-[#9A5B00]'
        : 'text-[#B91C1C]';

  const confidenceColor =
    confidenceLevel === 'High'
      ? 'text-[#287A5A]'
      : confidenceLevel === 'Moderate'
        ? 'text-[#9A5B00]'
        : 'text-[#991B1B]';

  return (
    <article
      className={`rounded-2xl border bg-white p-5 sm:p-6 transition-colors ${
        isSelectedProfile ? 'border-[#174C3C] ring-1 ring-[#174C3C]/10' : 'border-[#E7EBE7]'
      }`}
    >
      {/* Top Row: Rank, Title, Score */}
      <div className="flex flex-col gap-3 border-b border-[#E7EBE7] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#737D76]">
            <span className="font-mono font-semibold text-[#174C3C]">#{rank}</span>
            <span aria-hidden="true">·</span>
            <span>{crop.category}</span>
            <span aria-hidden="true">·</span>
            <span>{crop.family}</span>
          </div>
          <h3 className="mt-1 font-display text-lg font-semibold tracking-[-0.015em] text-[#18231E]">
            {crop.name}{' '}
            <span className="text-xs font-normal italic text-[#737D76]">
              ({crop.scientificName})
            </span>
          </h3>
        </div>

        <div className="flex shrink-0 items-baseline gap-4 sm:text-right">
          <div>
            <div className="flex items-center gap-1 text-[11px] font-medium text-[#737D76] sm:justify-end">
              <span>Suitability Score</span>
              <MetricTooltip
                label="Deterministic Suitability Score"
                description="Sum of Climate (30), Water & Rainfall (25), Soil & pH (20), Growing Season (15), and Rotation Compatibility (10). Missing inputs score 0 and lower confidence."
              />
            </div>
            <p className="font-display text-2xl font-semibold tracking-[-0.02em] tabular-nums text-[#18231E]">
              {overallScore}
              <span className="ml-0.5 text-xs font-normal text-[#737D76]">/100</span>
            </p>
          </div>
          <div className="border-l border-[#E7EBE7] pl-4 text-left">
            <p className={`text-xs font-semibold ${categoryColor}`}>
              {suitabilityCategory} Suitability
            </p>
            <p className={`mt-0.5 text-[11px] font-medium ${confidenceColor}`}>
              Confidence: {confidenceLevel} ({dataCompletenessPct}%)
            </p>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
        {evaluation.categories.map((cat) => {
          const pct = cat.score ?? 0;
          const barColor =
            cat.status === 'unavailable'
              ? 'bg-[#D6DCD7]'
              : pct >= 75
                ? 'bg-[#287A5A]'
                : pct >= 50
                  ? 'bg-[#D97706]'
                  : 'bg-[#DC2626]';
          return (
            <div key={cat.id} className="rounded-xl bg-[#F7F8F6] px-3 py-2.5">
              <div className="flex items-center justify-between gap-1 text-[11px]">
                <span className="truncate font-medium text-[#445149]">{cat.label}</span>
                <span className="shrink-0 font-mono font-semibold tabular-nums text-[#18231E]">
                  {cat.status === 'unavailable' ? 'N/A' : `${cat.contribution}/${cat.weight}`}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#E7EBE7]">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Agronomic Rationale & Considerations (Open Hairline Columns, No Nested Borders) */}
      <div className="mt-5 grid grid-cols-1 gap-5 text-xs lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <p className="flex items-center gap-1.5 font-semibold text-[#174C3C]">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Supporting Reasons</span>
            </p>
            <ul className="mt-1.5 space-y-1 pl-5 text-[#445149] list-disc">
              {evaluation.supportingReasons.slice(0, 3).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>

          <div className="border-t border-[#E7EBE7] pt-3">
            <p className="flex items-center gap-1.5 font-semibold text-[#9A5B00]">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Potential Cultivation Challenges</span>
            </p>
            <ul className="mt-1.5 space-y-1 pl-5 text-[#445149] list-disc">
              {evaluation.cultivationChallenges.slice(0, 3).map((challenge) => (
                <li key={challenge}>{challenge}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-3 lg:border-l lg:border-[#E7EBE7] lg:pl-5">
          <div>
            <p className="flex items-center gap-1.5 font-semibold text-[#18231E]">
              <Droplets className="h-3.5 w-3.5 text-[#287A5A]" aria-hidden="true" />
              <span>Water &amp; Irrigation</span>
            </p>
            <p className="mt-1 leading-relaxed text-[#737D76]">
              {evaluation.waterConsiderations}
            </p>
          </div>

          <div className="border-t border-[#E7EBE7] pt-3">
            <p className="flex items-center gap-1.5 font-semibold text-[#18231E]">
              <Leaf className="h-3.5 w-3.5 text-[#287A5A]" aria-hidden="true" />
              <span>Soil &amp; Nutrient Considerations</span>
            </p>
            <p className="mt-1 leading-relaxed text-[#737D76]">
              {evaluation.soilAndNutrientConsiderations}
            </p>
          </div>
        </div>
      </div>

      {/* Data Limitations */}
      {evaluation.dataLimitations.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#F7F8F6] px-3.5 py-2.5 text-[11px] text-[#737D76]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#737D76]" aria-hidden="true" />
          <span>
            <strong className="text-[#18231E]">Data Limitations:</strong>{' '}
            {evaluation.dataLimitations.join(' · ')}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-[#E7EBE7] pt-4">
        <button
          type="button"
          onClick={() => onViewProfile(crop.id)}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E7EBE7] bg-white px-3.5 text-xs font-medium text-[#18231E] transition-colors hover:bg-[#F7F8F6]"
        >
          <Eye className="h-3.5 w-3.5 text-[#287A5A]" aria-hidden="true" />
          <span>View Full Profile</span>
        </button>
        <button
          type="button"
          disabled={!isCompared && compareLimitReached}
          onClick={() => onToggleCompare(crop.id)}
          className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3.5 text-xs font-medium transition-colors ${
            isCompared
              ? 'border-[#174C3C] bg-[#EAF2EC] text-[#174C3C]'
              : 'border-[#E7EBE7] bg-white text-[#18231E] hover:bg-[#F7F8F6] disabled:opacity-45'
          }`}
        >
          {isCompared ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <GitCompareArrows className="h-3.5 w-3.5 text-[#737D76]" aria-hidden="true" />
          )}
          <span>{isCompared ? 'In Comparison' : 'Compare'}</span>
        </button>
        <button
          type="button"
          onClick={() => onAddToRotation(crop)}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#174C3C] px-3.5 text-xs font-medium text-white transition-colors hover:bg-[#133F32]"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Schedule Next</span>
        </button>
      </div>
    </article>
  );
}
