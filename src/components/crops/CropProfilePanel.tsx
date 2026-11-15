import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  GitCompareArrows,
  Info,
  Plus,
  Sprout,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatRainfall, formatTemp } from '../../lib/agronomy';
import type { CropKnowledgeEntry, CropSuitabilityEvaluation } from '../../types/rotatewise';

interface CropProfilePanelProps {
  evaluation: CropSuitabilityEvaluation;
  unitSystem: 'imperial' | 'metric';
  isCompared: boolean;
  compareLimitReached: boolean;
  onToggleCompare: (cropId: string) => void;
  onAddToRotation: (entry: CropKnowledgeEntry) => void;
}

export function CropProfilePanel({
  evaluation,
  unitSystem,
  isCompared,
  compareLimitReached,
  onToggleCompare,
  onAddToRotation,
}: CropProfilePanelProps) {
  const { crop } = evaluation;

  const chartRows = evaluation.categories.map((cat) => ({
    name: cat.label.replace(' (NASA POWER)', ''),
    contribution: cat.contribution,
    maxWeight: cat.weight,
    scorePct: cat.score ?? 0,
    unavailable: cat.status === 'unavailable',
  }));

  return (
    <aside
      aria-label={`Full agronomic profile for ${crop.name}`}
      className="rounded-2xl border border-[#E7EBE7] bg-white p-5 sm:p-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-[#E7EBE7] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#737D76]">
            <Sprout className="h-3.5 w-3.5 text-[#287A5A]" aria-hidden="true" />
            <span>{crop.category}</span>
            <span aria-hidden="true">·</span>
            <span>{crop.family}</span>
          </div>
          <h2 className="mt-1 font-display text-xl font-semibold tracking-[-0.02em] text-[#18231E]">
            {crop.name}
          </h2>
          <p className="text-xs italic text-[#737D76]">{crop.scientificName}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!isCompared && compareLimitReached}
            onClick={() => onToggleCompare(crop.id)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${
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
            <span>{isCompared ? 'Selected for Compare' : 'Add to Compare'}</span>
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
      </div>

      {/* Overall Score + Category Contribution Chart */}
      <div className="mt-5 grid grid-cols-1 gap-5 border-b border-[#E7EBE7] pb-5 md:grid-cols-12">
        <div className="rounded-xl bg-[#F7F8F6] p-4 md:col-span-5">
          <p className="text-xs font-medium text-[#737D76]">Calculated Suitability</p>
          <p className="mt-1.5 font-display text-3xl font-semibold tracking-[-0.02em] tabular-nums text-[#174C3C]">
            {evaluation.overallScore}
            <span className="ml-0.5 text-sm font-normal text-[#737D76]">/100</span>
          </p>
          <p className="mt-1 text-xs font-semibold text-[#18231E]">
            {evaluation.suitabilityCategory} Suitability · {evaluation.confidenceLevel} conf.
          </p>
          <p className="mt-1 text-[11px] text-[#737D76]">
            Data completeness: {evaluation.dataCompletenessPct}% verified
          </p>
          <div className="mt-3.5 space-y-1.5 border-t border-[#E7EBE7] pt-3 text-[11px]">
            {evaluation.categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between gap-2">
                <span className="text-[#445149]">{cat.label}</span>
                <span className="font-mono font-semibold tabular-nums text-[#18231E]">
                  {cat.status === 'unavailable'
                    ? `0/${cat.weight} (N/A)`
                    : `${cat.contribution}/${cat.weight} (${cat.score}%)`}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-7">
          <p className="text-xs font-semibold text-[#18231E]">
            Category Point Contribution vs Maximum Weight
          </p>
          <div className="mt-2 h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartRows}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 6, bottom: 0 }}
              >
                <CartesianGrid stroke="#EEF1EE" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 30]}
                  tick={{ fontSize: 11, fill: '#737D76' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={118}
                  tick={{ fontSize: 11, fill: '#18231E' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value, _name, item) => [
                    `${value ?? 0} / ${item?.payload?.maxWeight ?? ''} pts (${item?.payload?.scorePct ?? 0}%)`,
                    'Contribution',
                  ]}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #E7EBE7',
                    boxShadow: '0 10px 26px rgba(20, 37, 29, 0.10)',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="contribution" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                  {chartRows.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.unavailable ? '#D6DCD7' : '#174C3C'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Complete Agronomic Specifications */}
      <p className="mt-4 text-sm leading-relaxed text-[#445149]">{crop.summary}</p>

      <dl className="mt-4 grid grid-cols-1 gap-4 border-t border-[#E7EBE7] pt-4 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-[#737D76]">Ideal Temperature Window</dt>
          <dd className="mt-0.5 font-mono font-semibold tabular-nums text-[#18231E]">
            {formatTemp(crop.idealTempC[0], unitSystem)} –{' '}
            {formatTemp(crop.idealTempC[1], unitSystem)}
          </dd>
        </div>
        <div>
          <dt className="text-[#737D76]">Growing Duration</dt>
          <dd className="mt-0.5 font-mono font-semibold tabular-nums text-[#18231E]">
            {crop.growingDurationDays[0]}–{crop.growingDurationDays[1]} days
          </dd>
        </div>
        <div>
          <dt className="text-[#737D76]">Seasonal Crop Water Need</dt>
          <dd className="mt-0.5 font-mono font-semibold tabular-nums text-[#18231E]">
            {formatRainfall(crop.waterNeedMm[0], unitSystem)} –{' '}
            {formatRainfall(crop.waterNeedMm[1], unitSystem)}
          </dd>
        </div>
        <div>
          <dt className="text-[#737D76]">Irrigation Dependency</dt>
          <dd className="mt-0.5 font-semibold text-[#18231E]">
            {crop.irrigationDependency} (Rainfall ideal: {crop.rainfallRangeMm[0]}–
            {crop.rainfallRangeMm[1]} mm)
          </dd>
        </div>
        <div>
          <dt className="text-[#737D76]">Suitable Soil Types</dt>
          <dd className="mt-0.5 text-[#18231E]">
            <span className="font-semibold">{crop.suitableSoilTypes.join(', ')}</span>
            {crop.secondarySoilTypes.length > 0 && (
              <span className="text-[#737D76]">
                {' '}
                (Secondary: {crop.secondarySoilTypes.join(', ')})
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[#737D76]">Soil pH Range &amp; Drainage</dt>
          <dd className="mt-0.5 text-[#18231E]">
            <span className="font-mono font-semibold tabular-nums">
              pH {crop.soilPhRange[0].toFixed(1)}–{crop.soilPhRange[1].toFixed(1)}
            </span>{' '}
            · {crop.soilDrainagePreference}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[#737D76]">Preferred Growing Seasons</dt>
          <dd className="mt-0.5 font-medium text-[#18231E]">
            {crop.preferredSeasons.join(' · ')}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[#737D76]">Nutrient Requirements</dt>
          <dd className="mt-0.5 text-[#18231E]">
            <span className="font-semibold">{crop.nutrientRequirements.nitrogenRole}</span> (
            {crop.nutrientRequirements.nitrogenDeltaKgHa >= 0
              ? `+${crop.nutrientRequirements.nitrogenDeltaKgHa}`
              : crop.nutrientRequirements.nitrogenDeltaKgHa}{' '}
            kg/ha N balance) · NPK: {crop.nutrientRequirements.npkGuidanceKgHa} · Micronutrients:{' '}
            {crop.nutrientRequirements.keyMicronutrients.join(', ')}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[#737D76]">Rotation Compatibility</dt>
          <dd className="mt-1 space-y-1 text-[#18231E]">
            <p className="flex flex-wrap items-center gap-1.5">
              <span className="text-[#737D76]">Best preceded by:</span>
              <span className="font-semibold">
                {crop.rotationCompatibility.bestPrecededBy.join(', ')}
              </span>
              <ArrowRight className="h-3 w-3 text-[#287A5A]" aria-hidden="true" />
              <span>{crop.name}</span>
            </p>
            <p className="text-[#445149]">
              Avoid immediately after:{' '}
              <span className="font-medium text-[#991B1B]">
                {crop.rotationCompatibility.avoidAfter.join(', ')}
              </span>{' '}
              · {crop.rotationCompatibility.residueBenefit}
            </p>
          </dd>
        </div>
      </dl>

      {/* Common Diseases & Risks */}
      <div className="mt-5 rounded-xl bg-[#FDF8EC] p-4 text-xs text-[#78350F]">
        <p className="flex items-center gap-1.5 font-semibold">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Common Diseases, Pests &amp; Abiotic Risks</span>
        </p>
        <p className="mt-1.5">
          <strong>Diseases:</strong> {crop.cultivationRisks.commonDiseases.join(' · ')}
        </p>
        <p className="mt-1">
          <strong>Pests:</strong> {crop.cultivationRisks.pestPressures.join(' · ')}
        </p>
        <p className="mt-1">
          <strong>Abiotic Risks:</strong> {crop.cultivationRisks.abioticRisks.join(' · ')}
        </p>
      </div>

      {/* Sources & Explicit Unknowns */}
      <div className="mt-5 space-y-2.5 border-t border-[#E7EBE7] pt-4 text-xs">
        <p className="flex items-center gap-1.5 font-semibold text-[#18231E]">
          <BookOpen className="h-3.5 w-3.5 text-[#174C3C]" aria-hidden="true" />
          <span>Agronomic Reference Sources (Database Confidence: {crop.confidenceLevel})</span>
        </p>
        <ul className="space-y-1 text-[#737D76]">
          {crop.sources.map((src) => (
            <li key={src.name}>
              <span className="font-semibold text-[#18231E]">[{src.authority}] {src.name}:</span>{' '}
              {src.note}
            </li>
          ))}
        </ul>
        <div className="flex items-start gap-2 rounded-xl bg-[#F7F8F6] px-3.5 py-2.5 text-[11px] text-[#737D76]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            <strong className="text-[#18231E]">Unknown / Site-Dependent Fields:</strong>{' '}
            {crop.unknownFields.join(' · ')}
          </span>
        </div>
      </div>
    </aside>
  );
}
