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
      className="rounded-xl border border-[#E4E2DA] bg-white p-5 shadow-[0_1px_2px_rgba(18,43,29,0.03)]"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-[#ECEAE3] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#6B7970]">
            <Sprout className="h-3.5 w-3.5 text-[#2E8B57]" aria-hidden="true" />
            <span>{crop.category}</span>
            <span aria-hidden="true">·</span>
            <span>{crop.family}</span>
          </div>
          <h2 className="mt-1 font-display text-xl font-bold text-[#14221A]">{crop.name}</h2>
          <p className="text-xs italic text-[#6B7970]">{crop.scientificName}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!isCompared && compareLimitReached}
            onClick={() => onToggleCompare(crop.id)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium ${
              isCompared
                ? 'border-[#154734] bg-[#EFF6F2] text-[#154734]'
                : 'border-[#D8D5CB] bg-white text-[#14221A] hover:bg-[#F6F5F0] disabled:opacity-45'
            }`}
          >
            {isCompared ? (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{isCompared ? 'Selected for Compare' : 'Add to Compare'}</span>
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
      </div>

      {/* Overall Score + Category Contribution Chart */}
      <div className="mt-4 grid grid-cols-1 gap-4 border-b border-[#ECEAE3] pb-5 md:grid-cols-12">
        <div className="rounded-lg bg-[#FAFAF7] p-4 md:col-span-5">
          <p className="text-xs font-medium text-[#6B7970]">Calculated Suitability</p>
          <p className="mt-1 font-display text-3xl font-bold tabular-nums text-[#154734]">
            {evaluation.overallScore}
            <span className="text-sm font-normal text-[#6B7970]">/100</span>
          </p>
          <p className="mt-1 text-xs font-semibold text-[#14221A]">
            {evaluation.suitabilityCategory} Suitability · Confidence: {evaluation.confidenceLevel}
          </p>
          <p className="mt-1 text-[11px] text-[#5F6E65]">
            Data completeness: {evaluation.dataCompletenessPct}% of scoring criteria verified.
          </p>
          <div className="mt-3 space-y-1.5 text-[11px]">
            {evaluation.categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between gap-2">
                <span className="text-[#4B5B51]">{cat.label}</span>
                <span className="font-mono font-semibold tabular-nums text-[#14221A]">
                  {cat.status === 'unavailable'
                    ? `0/${cat.weight} (N/A)`
                    : `${cat.contribution}/${cat.weight} (${cat.score}%)`}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-7">
          <p className="text-xs font-semibold text-[#14221A]">
            Category Point Contribution vs Maximum Weight
          </p>
          <div className="mt-2 h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartRows}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 6, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEAE3" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 30]}
                  tick={{ fontSize: 11, fill: '#5F6E65' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={118}
                  tick={{ fontSize: 11, fill: '#14221A' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value, _name, item) => [
                    `${value ?? 0} / ${item?.payload?.maxWeight ?? ''} pts (${item?.payload?.scorePct ?? 0}%)`,
                    'Contribution',
                  ]}
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid #E4E2DA',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="contribution" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {chartRows.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.unavailable ? '#D8D5CB' : '#154734'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Complete Agronomic Specifications */}
      <p className="mt-4 text-sm leading-relaxed text-[#4B5B51]">{crop.summary}</p>

      <dl className="mt-4 grid grid-cols-1 gap-4 border-t border-[#ECEAE3] pt-4 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-[#6B7970]">Ideal Temperature Window</dt>
          <dd className="mt-0.5 font-mono font-semibold tabular-nums text-[#14221A]">
            {formatTemp(crop.idealTempC[0], unitSystem)} –{' '}
            {formatTemp(crop.idealTempC[1], unitSystem)}
          </dd>
        </div>
        <div>
          <dt className="text-[#6B7970]">Growing Duration</dt>
          <dd className="mt-0.5 font-mono font-semibold tabular-nums text-[#14221A]">
            {crop.growingDurationDays[0]}–{crop.growingDurationDays[1]} days
          </dd>
        </div>
        <div>
          <dt className="text-[#6B7970]">Seasonal Crop Water Need</dt>
          <dd className="mt-0.5 font-mono font-semibold tabular-nums text-[#14221A]">
            {formatRainfall(crop.waterNeedMm[0], unitSystem)} –{' '}
            {formatRainfall(crop.waterNeedMm[1], unitSystem)}
          </dd>
        </div>
        <div>
          <dt className="text-[#6B7970]">Irrigation Dependency</dt>
          <dd className="mt-0.5 font-semibold text-[#14221A]">
            {crop.irrigationDependency} (Rainfall ideal: {crop.rainfallRangeMm[0]}–
            {crop.rainfallRangeMm[1]} mm)
          </dd>
        </div>
        <div>
          <dt className="text-[#6B7970]">Suitable Soil Types</dt>
          <dd className="mt-0.5 text-[#14221A]">
            <span className="font-semibold">{crop.suitableSoilTypes.join(', ')}</span>
            {crop.secondarySoilTypes.length > 0 && (
              <span className="text-[#6B7970]">
                {' '}
                (Secondary: {crop.secondarySoilTypes.join(', ')})
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[#6B7970]">Soil pH Range &amp; Drainage</dt>
          <dd className="mt-0.5 text-[#14221A]">
            <span className="font-mono font-semibold tabular-nums">
              pH {crop.soilPhRange[0].toFixed(1)}–{crop.soilPhRange[1].toFixed(1)}
            </span>{' '}
            · {crop.soilDrainagePreference}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[#6B7970]">Preferred Growing Seasons</dt>
          <dd className="mt-0.5 font-medium text-[#14221A]">
            {crop.preferredSeasons.join(' · ')}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[#6B7970]">Nutrient Requirements</dt>
          <dd className="mt-0.5 text-[#14221A]">
            <span className="font-semibold">{crop.nutrientRequirements.nitrogenRole}</span> (
            {crop.nutrientRequirements.nitrogenDeltaKgHa >= 0
              ? `+${crop.nutrientRequirements.nitrogenDeltaKgHa}`
              : crop.nutrientRequirements.nitrogenDeltaKgHa}{' '}
            kg/ha N balance) · NPK: {crop.nutrientRequirements.npkGuidanceKgHa} · Micronutrients:{' '}
            {crop.nutrientRequirements.keyMicronutrients.join(', ')}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[#6B7970]">Rotation Compatibility</dt>
          <dd className="mt-1 space-y-1 text-[#14221A]">
            <p className="flex flex-wrap items-center gap-1.5">
              <span className="text-[#4B5B51]">Best preceded by:</span>
              <span className="font-semibold">
                {crop.rotationCompatibility.bestPrecededBy.join(', ')}
              </span>
              <ArrowRight className="h-3 w-3 text-[#2E8B57]" aria-hidden="true" />
              <span>{crop.name}</span>
            </p>
            <p className="text-[#4B5B51]">
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
      <div className="mt-4 rounded-lg border border-[#F3D8A8] bg-[#FFFBEB] p-3.5 text-xs text-[#78350F]">
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
      <div className="mt-4 space-y-2 border-t border-[#ECEAE3] pt-4 text-xs">
        <p className="flex items-center gap-1.5 font-semibold text-[#14221A]">
          <BookOpen className="h-3.5 w-3.5 text-[#154734]" aria-hidden="true" />
          <span>Agronomic Reference Sources (Database Confidence: {crop.confidenceLevel})</span>
        </p>
        <ul className="space-y-1 text-[#4B5B51]">
          {crop.sources.map((src) => (
            <li key={src.name}>
              <span className="font-semibold text-[#14221A]">[{src.authority}] {src.name}:</span>{' '}
              {src.note}
            </li>
          ))}
        </ul>
        <div className="flex items-start gap-2 rounded-lg bg-[#FAFAF7] px-3 py-2 text-[11px] text-[#5F6E65]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            <strong>Unknown / Site-Dependent Fields:</strong>{' '}
            {crop.unknownFields.join(' · ')}
          </span>
        </div>
      </div>
    </aside>
  );
}
