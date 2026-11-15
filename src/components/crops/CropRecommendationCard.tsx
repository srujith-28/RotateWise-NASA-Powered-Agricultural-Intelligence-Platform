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
      ? 'text-[#154734]'
      : suitabilityCategory === 'Moderate'
        ? 'text-[#B45309]'
        : 'text-[#B91C1C]';

  const confidenceColor =
    confidenceLevel === 'High'
      ? 'text-[#16794B]'
      : confidenceLevel === 'Moderate'
        ? 'text-[#B45309]'
        : 'text-[#991B1B]';

  return (
    <article
      className={`rounded-xl border bg-white p-5 shadow-[0_1px_2px_rgba(18,43,29,0.03)] transition-colors ${
        isSelectedProfile ? 'border-[#154734]' : 'border-[#E4E2DA]'
      }`}
    >
      {/* Top Row: Rank, Title, Score */}
      <div className="flex flex-col gap-3 border-b border-[#ECEAE3] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6B7970]">
            <span className="font-mono font-semibold text-[#154734]">#{rank}</span>
            <span aria-hidden="true">·</span>
            <span>{crop.category}</span>
            <span aria-hidden="true">·</span>
            <span>{crop.family}</span>
          </div>
          <h3 className="mt-1 font-display text-lg font-bold text-[#14221A]">
            {crop.name}{' '}
            <span className="text-xs font-normal italic text-[#6B7970]">
              ({crop.scientificName})
            </span>
          </h3>
        </div>

        <div className="flex shrink-0 items-baseline gap-4 sm:text-right">
          <div>
            <div className="flex items-center gap-1 text-[11px] font-medium text-[#6B7970] sm:justify-end">
              <span>Suitability Score</span>
              <MetricTooltip
                label="Deterministic Suitability Score"
                description="Sum of Climate (30), Water & Rainfall (25), Soil & pH (20), Growing Season (15), and Rotation Compatibility (10). Missing inputs score 0 and lower confidence."
              />
            </div>
            <p className="font-display text-2xl font-bold tabular-nums text-[#14221A]">
              {overallScore}
              <span className="text-xs font-normal text-[#6B7970]">/100</span>
            </p>
          </div>
          <div className="border-l border-[#ECEAE3] pl-4 text-left">
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
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-5">
        {evaluation.categories.map((cat) => {
          const pct = cat.score ?? 0;
          const barColor =
            cat.status === 'unavailable'
              ? 'bg-[#D8D5CB]'
              : pct >= 75
                ? 'bg-[#2E8B57]'
                : pct >= 50
                  ? 'bg-[#D97706]'
                  : 'bg-[#DC2626]';
          return (
            <div key={cat.id} className="rounded-lg bg-[#FAFAF7] p-2.5">
              <div className="flex items-center justify-between gap-1 text-[11px]">
                <span className="truncate font-medium text-[#4B5B51]">{cat.label}</span>
                <span className="shrink-0 font-mono font-semibold tabular-nums text-[#14221A]">
                  {cat.status === 'unavailable' ? 'N/A' : `${cat.contribution}/${cat.weight}`}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded bg-[#E4E2DA]">
                <div className={`h-full rounded ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Agronomic Rationale & Considerations */}
      <div className="mt-4 grid grid-cols-1 gap-4 text-xs lg:grid-cols-2">
        <div className="space-y-2">
          <div>
            <p className="flex items-center gap-1.5 font-semibold text-[#154734]">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Supporting Reasons</span>
            </p>
            <ul className="mt-1 space-y-1 pl-5 text-[#4B5B51] list-disc">
              {evaluation.supportingReasons.slice(0, 3).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="flex items-center gap-1.5 font-semibold text-[#92400E]">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Potential Cultivation Challenges</span>
            </p>
            <ul className="mt-1 space-y-1 pl-5 text-[#4B5B51] list-disc">
              {evaluation.cultivationChallenges.slice(0, 3).map((challenge) => (
                <li key={challenge}>{challenge}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="rounded-lg border border-[#ECEAE3] bg-[#FAFAF7] p-3">
            <p className="flex items-center gap-1.5 font-semibold text-[#14221A]">
              <Droplets className="h-3.5 w-3.5 text-[#2E8B57]" aria-hidden="true" />
              <span>Water &amp; Irrigation</span>
            </p>
            <p className="mt-1 leading-relaxed text-[#4B5B51]">
              {evaluation.waterConsiderations}
            </p>
          </div>

          <div className="rounded-lg border border-[#ECEAE3] bg-[#FAFAF7] p-3">
            <p className="flex items-center gap-1.5 font-semibold text-[#14221A]">
              <Leaf className="h-3.5 w-3.5 text-[#2E8B57]" aria-hidden="true" />
              <span>Soil &amp; Nutrient Considerations</span>
            </p>
            <p className="mt-1 leading-relaxed text-[#4B5B51]">
              {evaluation.soilAndNutrientConsiderations}
            </p>
          </div>
        </div>
      </div>

      {/* Data Limitations */}
      {evaluation.dataLimitations.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#ECEAE3] bg-[#FBFBF9] px-3 py-2 text-[11px] text-[#5F6E65]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#6B7970]" aria-hidden="true" />
          <span>
            <strong className="text-[#14221A]">Data Limitations:</strong>{' '}
            {evaluation.dataLimitations.join(' · ')}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-[#ECEAE3] pt-3">
        <button
          type="button"
          onClick={() => onViewProfile(crop.id)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#D8D5CB] bg-white px-3 text-xs font-medium text-[#14221A] hover:bg-[#F6F5F0]"
        >
          <Eye className="h-3.5 w-3.5 text-[#2E8B57]" aria-hidden="true" />
          <span>View Full Profile</span>
        </button>
        <button
          type="button"
          disabled={!isCompared && compareLimitReached}
          onClick={() => onToggleCompare(crop.id)}
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${
            isCompared
              ? 'border-[#154734] bg-[#EFF6F2] text-[#154734]'
              : 'border-[#D8D5CB] bg-white text-[#14221A] hover:bg-[#F6F5F0] disabled:opacity-45'
          }`}
        >
          {isCompared ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <GitCompareArrows className="h-3.5 w-3.5 text-[#4B5B51]" aria-hidden="true" />
          )}
          <span>{isCompared ? 'In Comparison' : 'Compare'}</span>
        </button>
        <button
          type="button"
          onClick={() => onAddToRotation(crop)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#154734] px-3 text-xs font-medium text-white hover:bg-[#0F3527]"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Schedule Next</span>
        </button>
      </div>
    </article>
  );
}
