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
      ? 'text-[#154734]'
      : evaluation.overallScore >= 55
        ? 'text-[#92400E]'
        : 'text-[#B91C1C]';

  const hasMissingPh = evaluation.categories.some(
    (c) => c.id === 'soil_root_diversity' && c.missingInputs.length > 0
  );

  return (
    <section
      aria-label="Deterministic rotation score and agronomic summary"
      className="rounded-xl border border-[#E4E2DA] bg-white p-5 shadow-[0_1px_2px_rgba(18,43,29,0.03)]"
    >
      {/* Top Metric Strip */}
      <div className="grid grid-cols-1 gap-4 border-b border-[#ECEAE3] pb-5 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-[#ECEAE3] bg-[#FAFAF7] p-4">
          <div className="flex items-center justify-between text-xs font-medium text-[#5F6E65]">
            <span>Rotation Score</span>
            <ShieldCheck className="h-3.5 w-3.5 text-[#154734]" aria-hidden="true" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className={`font-mono text-3xl font-bold tabular-nums ${scoreToneClass}`}>
              {evaluation.overallScore}
            </span>
            <span className="font-mono text-xs text-[#6B7970]">/100</span>
            <span className="ml-auto text-xs font-semibold text-[#14221A]">
              {evaluation.scoreLabel}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[#6B7970]">
            Confidence: <strong className="text-[#14221A]">{evaluation.confidenceLevel}</strong> · {evaluation.dataCompletenessPct}% inputs verified
          </p>
        </div>

        <div className="rounded-lg border border-[#ECEAE3] bg-[#FAFAF7] p-4">
          <div className="flex items-center justify-between text-xs font-medium text-[#5F6E65]">
            <span>Botanical Families</span>
            <Layers className="h-3.5 w-3.5 text-[#2E8B57]" aria-hidden="true" />
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-[#14221A]">
            {evaluation.uniqueFamilies.length}
          </p>
          <p className="mt-1 truncate text-[11px] text-[#6B7970]" title={evaluation.uniqueFamilies.join(', ')}>
            {evaluation.uniqueFamilies.length > 0
              ? evaluation.uniqueFamilies.join(' · ')
              : 'No families scheduled'}
          </p>
        </div>

        <div className="rounded-lg border border-[#ECEAE3] bg-[#FAFAF7] p-4">
          <div className="flex items-center justify-between text-xs font-medium text-[#5F6E65]">
            <span>Cumulative N Balance</span>
            <Sprout className="h-3.5 w-3.5 text-[#2E8B57]" aria-hidden="true" />
          </div>
          <p
            className={`mt-1.5 font-mono text-2xl font-bold tabular-nums ${
              evaluation.netNitrogenKgHa >= 0 ? 'text-[#154734]' : 'text-[#14221A]'
            }`}
          >
            {evaluation.netNitrogenKgHa >= 0
              ? `+${evaluation.netNitrogenKgHa}`
              : evaluation.netNitrogenKgHa}{' '}
            <span className="text-xs font-normal text-[#6B7970]">kg/ha</span>
          </p>
          <p className="mt-1 text-[11px] text-[#6B7970]">
            Sum of biological fixation &amp; crop uptake
          </p>
        </div>

        <div className="rounded-lg border border-[#ECEAE3] bg-[#FAFAF7] p-4">
          <div className="flex items-center justify-between text-xs font-medium text-[#5F6E65]">
            <span>Cumulative Water Need</span>
            <Droplets className="h-3.5 w-3.5 text-[#154734]" aria-hidden="true" />
          </div>
          <p className="mt-1.5 font-mono text-lg font-bold tabular-nums text-[#14221A]">
            {formatRainfall(evaluation.totalWaterNeedMm[0], unitSystem)} –{' '}
            {formatRainfall(evaluation.totalWaterNeedMm[1], unitSystem)}
          </p>
          <p className="mt-1 text-[11px] text-[#6B7970]">
            Parcel irrigation: {farm.irrigation}
          </p>
        </div>

        <div className="rounded-lg border border-[#ECEAE3] bg-[#FAFAF7] p-4">
          <div className="flex items-center justify-between text-xs font-medium text-[#5F6E65]">
            <span>Identified Risks</span>
            {evaluation.identifiedRisks.length === 0 ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-[#2E8B57]" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-[#B45309]" aria-hidden="true" />
            )}
          </div>
          <p
            className={`mt-1.5 font-mono text-2xl font-bold tabular-nums ${
              evaluation.identifiedRisks.length === 0 ? 'text-[#154734]' : 'text-[#92400E]'
            }`}
          >
            {evaluation.identifiedRisks.length}
          </p>
          <p className="mt-1 text-[11px] text-[#6B7970]">
            {evaluation.identifiedRisks.length === 0
              ? 'Clean rotational sequence'
              : 'Review timeline conflicts below'}
          </p>
        </div>
      </div>

      {/* 5 Transparent Scoring Categories */}
      <div className="mt-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-sm font-semibold text-[#14221A]">
            Deterministic Rotation Score Breakdown (Sum of 5 Categories = {evaluation.overallScore}/100)
          </h2>
          {hasMissingPh && (
            <button
              type="button"
              onClick={onEditFarm}
              className="text-left text-xs font-semibold text-[#154734] hover:underline"
            >
              Add parcel topsoil pH to improve soil score completeness →
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {evaluation.categories.map((cat) => {
            const pct = cat.weight > 0 ? Math.round((cat.contribution / cat.weight) * 100) : 0;
            const barColor =
              cat.status === 'unavailable'
                ? 'bg-[#D8D5CB]'
                : pct >= 75
                  ? 'bg-[#154734]'
                  : pct >= 50
                    ? 'bg-[#2E8B57]'
                    : 'bg-[#D97706]';

            return (
              <div
                key={cat.id}
                className="flex flex-col justify-between rounded-lg border border-[#ECEAE3] bg-[#FAFAF7] p-3.5"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-[#14221A]">{cat.label}</span>
                    <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-[#154734]">
                      +{cat.contribution}/{cat.weight}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#E4E2DA]">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-[#4B5B51]">
                    {cat.detail}
                  </p>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-[#ECEAE3] pt-2 text-[11px]">
                  <span className="text-[#6B7970]">
                    Category fit: <strong className="font-mono text-[#14221A]">{cat.score !== null ? `${cat.score}/100` : 'N/A'}</strong>
                  </span>
                  <span
                    className={
                      cat.status === 'evaluated'
                        ? 'font-medium text-[#154734]'
                        : 'font-medium text-[#92400E]'
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

      {/* Epistemic Distinction: Historical NASA POWER vs Planned Future Seasons vs Agronomic Assumptions */}
      <div className="mt-5 grid grid-cols-1 gap-3 border-t border-[#ECEAE3] pt-4 lg:grid-cols-3">
        <div className="rounded-lg border border-[#E4E2DA] bg-[#FBFBF9] p-3 text-xs">
          <p className="flex items-center gap-1.5 font-semibold text-[#14221A]">
            <Info className="h-3.5 w-3.5 text-[#154734]" aria-hidden="true" />
            <span>Historical Climate (NASA POWER)</span>
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#4B5B51]">
            {nasaLoading
              ? 'Loading NASA POWER AG observations for selected parcel...'
              : nasaData
                ? `${nasaData.classification}: ${nasaData.startDate} to ${nasaData.endDate} · Mean ${nasaData.summary.meanTempC?.toFixed(1) ?? '—'}°C, ${nasaData.summary.totalRainfallMm?.toFixed(1) ?? '—'} mm rain across ${nasaData.summary.validDayCount} days.`
                : nasaError
                  ? `NASA POWER unavailable (${nasaError}). Climate points withheld (0/12) — no demo weather substituted.`
                  : 'NASA POWER data not yet loaded; climate points withheld (0/12).'}
          </p>
        </div>

        <div className="rounded-lg border border-[#E4E2DA] bg-[#FBFBF9] p-3 text-xs">
          <p className="font-semibold text-[#14221A]">Planned Future Seasons (Hypothetical)</p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#4B5B51]">
            Upcoming seasonal stages represent planning scenarios evaluated against historical parcel climate and farm soil profile ({farm.soilType}, pH {farm.health.phLevel.toFixed(1)}). Future weather remains uncertain.
          </p>
        </div>

        <div className="rounded-lg border border-[#E4E2DA] bg-[#FBFBF9] p-3 text-xs">
          <p className="font-semibold text-[#14221A]">Agronomic Scope &amp; Limitations</p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#4B5B51]">
            No fabricated yield, market price, or profit predictions. Nitrogen credits and break-crop values reflect FAO, ICAR, ICRISAT, and USDA-ARS agronomic references.
          </p>
        </div>
      </div>
    </section>
  );
}
