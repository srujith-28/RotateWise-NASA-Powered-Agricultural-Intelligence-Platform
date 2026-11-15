import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Info,
  Layers,
  ShieldCheck,
  Sprout,
} from 'lucide-react';
import { formatRainfall } from '../../lib/agronomy';
import type {
  Farm,
  NasaPowerClimateDataset,
  RotationPlanEvaluation,
} from '../../types/rotatewise';

interface RotationScorePanelProps {
  evaluation: RotationPlanEvaluation;
  farm: Farm;
  nasaData: NasaPowerClimateDataset | null;
  nasaLoading: boolean;
  nasaError: string | null;
  unitSystem: 'imperial' | 'metric';
  onEditFarm: () => void;
}

export function RotationScorePanel({
  evaluation,
  farm,
  nasaData,
  nasaLoading,
  nasaError,
  unitSystem,
  onEditFarm,
}: RotationScorePanelProps) {
  const scoreToneClass =
    evaluation.overallScore >= 75
      ? 'text-[#174C3C]'
      : evaluation.overallScore >= 55
        ? 'text-[#9A5B00]'
        : 'text-[#B91C1C]';

  const hasMissingPh = evaluation.categories.some(
    (c) => c.id === 'soil_root_diversity' && c.missingInputs.length > 0
  );

  return (
    <section
      aria-label="Deterministic rotation score and agronomic summary"
      className="rounded-2xl border border-[#E7EBE7] bg-white p-5 sm:p-6"
    >
      {/* Top Open Metric Strip (hairline dividers instead of nested cards) */}
      <div className="grid grid-cols-1 divide-y divide-[#E7EBE7] border-b border-[#E7EBE7] pb-5 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
        <div className="py-3 lg:py-0 lg:pr-5">
          <div className="flex items-center justify-between text-xs font-medium text-[#737D76]">
            <span>Rotation Score</span>
            <ShieldCheck className="h-3.5 w-3.5 text-[#174C3C]" aria-hidden="true" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className={`font-display text-3xl font-semibold tabular-nums ${scoreToneClass}`}>
              {evaluation.overallScore}
            </span>
            <span className="font-mono text-xs text-[#737D76]">/100</span>
            <span className="ml-auto text-xs font-semibold text-[#18231E]">
              {evaluation.scoreLabel}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[#737D76]">
            Confidence: <strong className="text-[#18231E]">{evaluation.confidenceLevel}</strong> · {evaluation.dataCompletenessPct}% verified
          </p>
        </div>

        <div className="py-3 lg:px-5 lg:py-0">
          <div className="flex items-center justify-between text-xs font-medium text-[#737D76]">
            <span>Botanical Families</span>
            <Layers className="h-3.5 w-3.5 text-[#287A5A]" aria-hidden="true" />
          </div>
          <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums text-[#18231E]">
            {evaluation.uniqueFamilies.length}
          </p>
          <p className="mt-1 truncate text-[11px] text-[#737D76]" title={evaluation.uniqueFamilies.join(', ')}>
            {evaluation.uniqueFamilies.length > 0
              ? evaluation.uniqueFamilies.join(' · ')
              : 'No families scheduled'}
          </p>
        </div>

        <div className="py-3 lg:px-5 lg:py-0">
          <div className="flex items-center justify-between text-xs font-medium text-[#737D76]">
            <span>Cumulative N Balance</span>
            <Sprout className="h-3.5 w-3.5 text-[#287A5A]" aria-hidden="true" />
          </div>
          <p
            className={`mt-1.5 font-display text-2xl font-semibold tabular-nums ${
              evaluation.netNitrogenKgHa >= 0 ? 'text-[#174C3C]' : 'text-[#18231E]'
            }`}
          >
            {evaluation.netNitrogenKgHa >= 0
              ? `+${evaluation.netNitrogenKgHa}`
              : evaluation.netNitrogenKgHa}{' '}
            <span className="text-xs font-normal text-[#737D76]">kg/ha</span>
          </p>
          <p className="mt-1 text-[11px] text-[#737D76]">
            Biological fixation &amp; uptake
          </p>
        </div>

        <div className="py-3 lg:px-5 lg:py-0">
          <div className="flex items-center justify-between text-xs font-medium text-[#737D76]">
            <span>Cumulative Water Need</span>
            <Droplets className="h-3.5 w-3.5 text-[#174C3C]" aria-hidden="true" />
          </div>
          <p className="mt-1.5 font-display text-lg font-semibold tabular-nums text-[#18231E]">
            {formatRainfall(evaluation.totalWaterNeedMm[0], unitSystem)} –{' '}
            {formatRainfall(evaluation.totalWaterNeedMm[1], unitSystem)}
          </p>
          <p className="mt-1 text-[11px] text-[#737D76]">
            {farm.irrigation}
          </p>
        </div>

        <div className="py-3 lg:py-0 lg:pl-5">
          <div className="flex items-center justify-between text-xs font-medium text-[#737D76]">
            <span>Identified Risks</span>
            {evaluation.identifiedRisks.length === 0 ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-[#287A5A]" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-[#B45309]" aria-hidden="true" />
            )}
          </div>
          <p
            className={`mt-1.5 font-display text-2xl font-semibold tabular-nums ${
              evaluation.identifiedRisks.length === 0 ? 'text-[#174C3C]' : 'text-[#9A5B00]'
            }`}
          >
            {evaluation.identifiedRisks.length}
          </p>
          <p className="mt-1 text-[11px] text-[#737D76]">
            {evaluation.identifiedRisks.length === 0
              ? 'Clean rotational sequence'
              : 'Review timeline conflicts below'}
          </p>
        </div>
      </div>

      {/* 5 Transparent Scoring Categories */}
      <div className="mt-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-sm font-semibold text-[#18231E]">
            Deterministic Rotation Score Breakdown (Sum of 5 Categories = {evaluation.overallScore}/100)
          </h2>
          {hasMissingPh && (
            <button
              type="button"
              onClick={onEditFarm}
              className="text-left text-xs font-semibold text-[#174C3C] hover:underline"
            >
              Add parcel topsoil pH to improve soil score completeness →
            </button>
          )}
        </div>

        <div className="mt-3.5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {evaluation.categories.map((cat) => {
            const pct = cat.weight > 0 ? Math.round((cat.contribution / cat.weight) * 100) : 0;
            const barColor =
              cat.status === 'unavailable'
                ? 'bg-[#D6DCD7]'
                : pct >= 75
                  ? 'bg-[#174C3C]'
                  : pct >= 50
                    ? 'bg-[#287A5A]'
                    : 'bg-[#D97706]';

            return (
              <div
                key={cat.id}
                className="flex flex-col justify-between rounded-xl bg-[#F7F8F6] p-3.5"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-[#18231E]">{cat.label}</span>
                    <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-[#174C3C]">
                      +{cat.contribution}/{cat.weight}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#E7EBE7]">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-[#737D76]">
                    {cat.detail}
                  </p>
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t border-[#E7EBE7] pt-2 text-[11px]">
                  <span className="text-[#737D76]">
                    Fit: <strong className="font-mono text-[#18231E]">{cat.score !== null ? `${cat.score}/100` : 'N/A'}</strong>
                  </span>
                  <span
                    className={
                      cat.status === 'evaluated'
                        ? 'font-medium text-[#174C3C]'
                        : 'font-medium text-[#9A5B00]'
                    }
                  >
                    {cat.status === 'evaluated' ? 'Verified' : cat.status === 'partial' ? 'Partial' : 'Unavailable'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Epistemic Distinction: Clean Hairline Footer */}
      <div className="mt-5 grid grid-cols-1 gap-4 border-t border-[#E7EBE7] pt-4 text-xs lg:grid-cols-3">
        <div>
          <p className="flex items-center gap-1.5 font-semibold text-[#18231E]">
            <Info className="h-3.5 w-3.5 text-[#174C3C]" aria-hidden="true" />
            <span>Historical Climate (NASA POWER)</span>
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#737D76]">
            {nasaLoading
              ? 'Loading NASA POWER AG observations for selected parcel...'
              : nasaData
                ? `${nasaData.classification}: ${nasaData.startDate} to ${nasaData.endDate} · Mean ${nasaData.summary.meanTempC?.toFixed(1) ?? '—'}°C, ${nasaData.summary.totalRainfallMm?.toFixed(1) ?? '—'} mm rain across ${nasaData.summary.validDayCount} days.`
                : nasaError
                  ? `NASA POWER unavailable (${nasaError}). Climate points withheld (0/12) — no demo weather substituted.`
                  : 'NASA POWER data not yet loaded; climate points withheld (0/12).'}
          </p>
        </div>

        <div>
          <p className="font-semibold text-[#18231E]">Planned Future Seasons (Hypothetical)</p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#737D76]">
            Upcoming seasonal stages represent planning scenarios evaluated against historical parcel climate and farm soil profile ({farm.soilType}, pH {farm.health.phLevel.toFixed(1)}). Future weather remains uncertain.
          </p>
        </div>

        <div>
          <p className="font-semibold text-[#18231E]">Agronomic Scope &amp; Limitations</p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#737D76]">
            No fabricated yield, market price, or profit predictions. Nitrogen credits and break-crop values reflect FAO, ICAR, ICRISAT, and USDA-ARS agronomic references.
          </p>
        </div>
      </div>
    </section>
  );
}
