import {
  AlertTriangle,
  Award,
  Check,
  CheckCircle2,
  Droplets,
  Edit3,
  GitCompareArrows,
  Info,
  Layers,
  Plus,
  Search,
  Sparkles,
  Sprout,
  Sun,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatRainfall, formatTemp } from '../../lib/agronomy';
import {
  buildCropComparison,
  MAX_COMPARISON_CROPS,
} from '../../lib/cropSuitabilityEngine';
import {
  evaluateRotationPlan,
  resolveRotationCropMeta,
} from '../../lib/rotationPlannerEngine';
import type {
  CropKnowledgeEntry,
  CropSuitabilityEvaluation,
  Farm,
  KnowledgeCropCategory,
  NasaPowerClimateDataset,
  RotationStep,
} from '../../types/rotatewise';

interface CropComparisonPanelProps {
  farm: Farm;
  nasaData: NasaPowerClimateDataset | null;
  evaluations: CropSuitabilityEvaluation[];
  selectedCropIds: string[];
  unitSystem: 'imperial' | 'metric';
  onToggleCrop: (cropId: string) => void;
  onRemoveCrop: (cropId: string) => void;
  onClearAll: () => void;
  onEditFarm: () => void;
  onAddToRotation?: (crop: CropKnowledgeEntry) => void;
}

const COMPARE_COLORS = ['#154734', '#2E8B57', '#C27803', '#3B6E8C'];

const COMPARE_CATEGORIES: Array<'All' | KnowledgeCropCategory> = [
  'All',
  'Cereal',
  'Legume',
  'Pulse',
  'Oilseed',
  'Fiber & Cash Crop',
];

type ComparisonSectionTab =
  | 'all'
  | 'suitability'
  | 'climate'
  | 'soil'
  | 'cultivation'
  | 'rotation';

const SECTION_TABS: Array<{ id: ComparisonSectionTab; label: string }> = [
  { id: 'all', label: 'All Categories' },
  { id: 'suitability', label: 'Suitability' },
  { id: 'climate', label: 'Climate' },
  { id: 'soil', label: 'Soil' },
  { id: 'cultivation', label: 'Cultivation' },
  { id: 'rotation', label: 'Rotation' },
];

export function CropComparisonPanel({
  farm,
  nasaData,
  evaluations,
  selectedCropIds,
  unitSystem,
  onToggleCrop,
  onRemoveCrop,
  onClearAll,
  onEditFarm,
  onAddToRotation,
}: CropComparisonPanelProps) {
  const [selectorSearch, setSelectorSearch] = useState('');
  const [selectorCategory, setSelectorCategory] = useState<
    'All' | KnowledgeCropCategory
  >('All');
  const [sectionTab, setSectionTab] = useState<ComparisonSectionTab>('all');

  const comparison = useMemo(
    () => buildCropComparison(evaluations, selectedCropIds),
    [evaluations, selectedCropIds]
  );
  const { crops, chartData, recommendations } = comparison;

  const filteredOptions = useMemo(() => {
    const q = selectorSearch.trim().toLowerCase();
    return evaluations.filter((item) => {
      const catOk =
        selectorCategory === 'All' || item.crop.category === selectorCategory;
      const searchOk =
        !q ||
        item.crop.name.toLowerCase().includes(q) ||
        item.crop.scientificName.toLowerCase().includes(q) ||
        item.crop.family.toLowerCase().includes(q) ||
        item.crop.nutrientRequirements.nitrogenRole.toLowerCase().includes(q);
      return catOk && searchOk;
    });
  }, [evaluations, selectorSearch, selectorCategory]);

  // Reuse rotationPlannerEngine to verify compatibility if each crop were scheduled next on the active farm
  const rotationPlanCompatibilityByCropId = useMemo(() => {
    const map = new Map<
      string,
      { hasConflict: boolean; warningSummary: string | null; planScore: number }
    >();
    const baseSteps = farm.rotationPlan.filter(
      (s) => s.status === 'completed' || s.status === 'active'
    );
    for (const item of crops) {
      const meta = resolveRotationCropMeta(item.crop.id);
      const nextStep: RotationStep = {
        id: `cmp-next-${item.crop.id}`,
        season: 'Next Season (Planned)',
        cropId: meta.id,
        cropName: meta.name,
        family: meta.family,
        status: 'planned',
        expectedYieldIndex: 105,
        nitrogenImpactKgHa: meta.nitrogenDeltaKgHa,
      };
      const evalPlan = evaluateRotationPlan(
        [...baseSteps, nextStep],
        farm,
        nasaData
      );
      const lastEval = evalPlan.stepEvaluations[evalPlan.stepEvaluations.length - 1];
      const conflictWarn = lastEval?.warnings.find(
        (w) => w.type === 'avoid_after' || w.type === 'same_family' || w.type === 'water_soil_mismatch'
      );
      map.set(item.crop.id, {
        hasConflict: Boolean(conflictWarn),
        warningSummary: conflictWarn
          ? `${conflictWarn.title}: ${conflictWarn.explanation}`
          : null,
        planScore: evalPlan.overallScore,
      });
    }
    return map;
  }, [crops, farm, nasaData]);

  const validPh =
    typeof farm.health?.phLevel === 'number' &&
    Number.isFinite(farm.health.phLevel) &&
    farm.health.phLevel >= 3.5 &&
    farm.health.phLevel <= 9.5;

  const compareLimitReached = crops.length >= MAX_COMPARISON_CROPS;
  const showSection = (id: Exclude<ComparisonSectionTab, 'all'>) =>
    sectionTab === 'all' || sectionTab === id;

  return (
    <section
      aria-label="Interactive crop comparison"
      className="rounded-xl border border-[#E4E2DA] bg-white p-5 shadow-[0_1px_2px_rgba(18,43,29,0.03)]"
    >
      {/* Header + Selected Farm Context */}
      <div className="flex flex-col gap-3 border-b border-[#ECEAE3] pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-[#14221A]">
            <GitCompareArrows className="h-4 w-4 text-[#154734]" aria-hidden="true" />
            <span>
              Crop Comparison Module ({crops.length}/{MAX_COMPARISON_CROPS} Selected)
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-[#6B7970]">
            Compare up to {MAX_COMPARISON_CROPS} crops across climate, soil, cultivation, rotation, and deterministic suitability scores. Agronomic references only — no fabricated yield, price, or profit estimates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onEditFarm}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#D8D5CB] bg-[#FAFAF7] px-2.5 text-xs font-medium text-[#14221A] hover:bg-[#F2F6F3]"
          >
            <Edit3 className="h-3.5 w-3.5 text-[#154734]" aria-hidden="true" />
            <span>Update Farm Soil / Crop</span>
          </button>
          {crops.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-[#E5C5C5] bg-white px-2.5 text-xs font-medium text-[#B91C1C] hover:bg-[#FEF2F2]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clear Comparison</span>
            </button>
          )}
        </div>
      </div>

      {/* Farm & Climate Context Strip */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 rounded-lg border border-[#ECEAE3] bg-[#FAFAF7] p-3 text-xs lg:grid-cols-2">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[#4B5B51]">
          <span className="font-semibold text-[#14221A]">Selected Farm:</span>
          <span className="font-medium text-[#154734]">{farm.name}</span>
          <span aria-hidden="true">·</span>
          <span>{farm.soilType}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            {validPh ? `pH ${farm.health.phLevel.toFixed(1)}` : 'pH Missing'}
          </span>
          <span aria-hidden="true">·</span>
          <span>{farm.irrigation}</span>
          <span aria-hidden="true">·</span>
          <span>
            Prior/Current:{' '}
            <strong className="text-[#14221A]">
              {farm.currentCropName || 'Not recorded'}
            </strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[#4B5B51] lg:justify-end">
          <span className="font-semibold text-[#14221A]">Historical Climate:</span>
          {nasaData ? (
            <span className="font-mono text-[11px] tabular-nums">
              NASA POWER ({nasaData.classification}) {nasaData.startDate} to{' '}
              {nasaData.endDate} ·{' '}
              {formatTemp(nasaData.summary.meanTempC ?? 0, unitSystem)} ·{' '}
              {formatRainfall(nasaData.summary.totalRainfallMm ?? 0, unitSystem)} ·{' '}
              {nasaData.summary.avgSolarRadiationMj !== null
                ? `${nasaData.summary.avgSolarRadiationMj.toFixed(1)} MJ/m²/d`
                : 'Solar N/A'}
            </span>
          ) : (
            <span className="font-medium text-[#92400E]">
              NASA POWER observations unavailable (missing climate &amp; rainfall metrics flagged)
            </span>
          )}
        </div>
      </div>

      {/* Searchable Crop Selector + Category Filters + Active Chips */}
      <div className="mt-4 space-y-3 rounded-lg border border-[#ECEAE3] bg-[#FBFBF9] p-3.5">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:w-72">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7970]"
              aria-hidden="true"
            />
            <label htmlFor="compare-crop-search" className="sr-only">
              Search crops to add to comparison
            </label>
            <input
              id="compare-crop-search"
              type="search"
              value={selectorSearch}
              onChange={(e) => setSelectorSearch(e.target.value)}
              placeholder="Search crops to compare (name, family, N role)..."
              className="h-9 w-full rounded-lg border border-[#D8D5CB] bg-white pr-3 pl-8 text-xs text-[#14221A] focus:border-[#154734] focus:outline-none"
            />
          </div>

          <div
            role="group"
            aria-label="Filter comparison crops by category"
            className="flex flex-wrap items-center gap-1 rounded-lg bg-[#EAE8E0] p-1"
          >
            {COMPARE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectorCategory(cat)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                  selectorCategory === cat
                    ? 'bg-white text-[#14221A] shadow-sm'
                    : 'text-[#4B5B51] hover:text-[#14221A]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Filtered Crop Add/Remove Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {filteredOptions.map((item) => {
            const selectedIdx = selectedCropIds.indexOf(item.crop.id);
            const isSelected = selectedIdx !== -1;
            const disabled = !isSelected && compareLimitReached;

            return (
              <button
                key={item.crop.id}
                type="button"
                disabled={disabled}
                onClick={() => onToggleCrop(item.crop.id)}
                aria-pressed={isSelected}
                className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'border-[#154734] bg-[#154734] text-white'
                    : 'border-[#D8D5CB] bg-white text-[#14221A] hover:bg-[#F2F6F3] disabled:cursor-not-allowed disabled:opacity-45'
                }`}
              >
                {isSelected ? (
                  <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                ) : (
                  <Plus className="h-3 w-3 shrink-0 text-[#154734]" aria-hidden="true" />
                )}
                <span>{item.crop.name}</span>
                <span
                  className={`font-mono text-[11px] tabular-nums ${
                    isSelected ? 'text-[#CBE6D6]' : 'text-[#6B7970]'
                  }`}
                >
                  {item.overallScore}
                </span>
              </button>
            );
          })}
          {filteredOptions.length === 0 && (
            <span className="text-xs text-[#6B7970]">
              No crops match &ldquo;{selectorSearch}&rdquo; in {selectorCategory}.
            </span>
          )}
        </div>

        {/* Selected Chips Strip */}
        {crops.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-[#ECEAE3] pt-2.5">
            <span className="text-[11px] font-semibold text-[#5F6E65]">
              Active Comparison:
            </span>
            {crops.map((item, idx) => (
              <button
                key={item.crop.id}
                type="button"
                onClick={() => onRemoveCrop(item.crop.id)}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#D8D5CB] bg-white px-2 text-xs font-medium text-[#14221A] hover:border-[#F2C6C6] hover:bg-[#FEE2E2]"
                title={`Remove ${item.crop.name} from comparison`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: COMPARE_COLORS[idx % COMPARE_COLORS.length],
                  }}
                  aria-hidden="true"
                />
                <span>{item.crop.name}</span>
                <X className="h-3 w-3 text-[#6B7970]" aria-hidden="true" />
              </button>
            ))}
            {compareLimitReached && (
              <span className="text-[11px] text-[#6B7970]">
                Max 4 crops reached — remove one to swap in another.
              </span>
            )}
          </div>
        )}
      </div>

      {crops.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#6B7970]">
          Select up to {MAX_COMPARISON_CROPS} crops above (or click <strong>Compare</strong> on any recommendation card) to launch side-by-side comparison.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* 4 Deterministic Recommendation Explanations */}
          <div>
            <h3 className="flex items-center gap-1.5 font-display text-sm font-bold text-[#14221A]">
              <Award className="h-4 w-4 text-[#154734]" aria-hidden="true" />
              <span>Recommendation Summary (Deterministic Suitability Engine)</span>
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(
                [
                  {
                    key: 'overall',
                    title: 'Best Overall Suitable Crop',
                    icon: Sparkles,
                    insight: recommendations.overall,
                  },
                  {
                    key: 'waterLimited',
                    title: 'Best for Water-Limited Conditions',
                    icon: Droplets,
                    insight: recommendations.waterLimited,
                  },
                  {
                    key: 'soil',
                    title: 'Best for Soil Compatibility',
                    icon: Sprout,
                    insight: recommendations.soil,
                  },
                  {
                    key: 'rotation',
                    title: 'Best for Rotation Compatibility',
                    icon: Layers,
                    insight: recommendations.rotation,
                  },
                ] as const
              ).map(({ key, title, icon: Icon, insight }) => {
                const isDetermined = insight.status === 'determined';
                return (
                  <div
                    key={key}
                    className={`flex flex-col justify-between rounded-lg border p-3.5 ${
                      isDetermined
                        ? 'border-[#CFE4D6] bg-[#F5FAF7]'
                        : 'border-[#F3D8A8] bg-[#FFFBEB]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#5F6E65]">
                          {title}
                        </span>
                        <Icon
                          className={`h-3.5 w-3.5 shrink-0 ${
                            isDetermined ? 'text-[#154734]' : 'text-[#B45309]'
                          }`}
                          aria-hidden="true"
                        />
                      </div>
                      <p
                        className={`mt-1.5 text-sm font-bold ${
                          isDetermined ? 'text-[#154734]' : 'text-[#92400E]'
                        }`}
                      >
                        {isDetermined
                          ? insight.tiedCropNames.length > 1
                            ? insight.tiedCropNames.join(' / ')
                            : insight.winnerCropName
                          : 'Insufficient Data'}
                      </p>
                      {insight.scoreLabel && (
                        <p className="font-mono text-[11px] font-semibold tabular-nums text-[#2E8B57]">
                          {insight.scoreLabel}
                        </p>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-[#4B5B51]">
                      {insight.explanation}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grouped Bar Chart Comparing Overall + 5 Scoring Categories */}
          <div className="rounded-xl border border-[#ECEAE3] bg-[#FAFAF7] p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold text-[#14221A]">
                Suitability Score &amp; Category Comparison (0–100%)
              </p>
              <span className="text-[11px] text-[#6B7970]">
                Missing inputs award 0 pts rather than full marks
              </span>
            </div>
            <div className="mt-3 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E2DA" vertical={false} />
                  <XAxis
                    dataKey="metric"
                    tick={{ fontSize: 11, fill: '#5F6E65' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: '#5F6E65' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value) => [`${value ?? 0}/100`]}
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid #E4E2DA',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  {crops.map((item, idx) => (
                    <Bar
                      key={item.crop.id}
                      dataKey={item.crop.name}
                      fill={COMPARE_COLORS[idx % COMPARE_COLORS.length]}
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Highlighted Strengths, Limitations & Missing Information per Crop (Responsive Cards) */}
          <div>
            <h3 className="font-display text-sm font-bold text-[#14221A]">
              Strengths, Limitations &amp; Missing Data per Crop
            </h3>
            <div
              className={`mt-3 grid grid-cols-1 gap-3 ${
                crops.length === 1
                  ? 'md:grid-cols-1'
                  : crops.length === 2
                    ? 'md:grid-cols-2'
                    : 'md:grid-cols-2 xl:grid-cols-4'
              }`}
            >
              {crops.map((item, idx) => {
                const rotCheck = rotationPlanCompatibilityByCropId.get(item.crop.id);
                return (
                  <div
                    key={item.crop.id}
                    className="flex flex-col justify-between rounded-xl border border-[#E4E2DA] bg-[#FAFAF7] p-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2 border-b border-[#ECEAE3] pb-2.5">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor:
                                  COMPARE_COLORS[idx % COMPARE_COLORS.length],
                              }}
                              aria-hidden="true"
                            />
                            <h4 className="text-sm font-bold text-[#14221A]">
                              {item.crop.name}
                            </h4>
                          </div>
                          <p className="text-[11px] text-[#6B7970]">
                            {item.crop.family} · {item.crop.category}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-base font-bold tabular-nums text-[#154734]">
                            {item.overallScore}/100
                          </span>
                          <span className="block text-[11px] text-[#5F6E65]">
                            {item.suitabilityCategory} · {item.confidenceLevel}
                          </span>
                        </div>
                      </div>

                      {/* Strengths */}
                      <div>
                        <p className="flex items-center gap-1 text-[11px] font-semibold text-[#154734]">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          <span>Strengths</span>
                        </p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-[#4B5B51]">
                          {item.supportingReasons.slice(0, 3).map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Limitations & Challenges */}
                      <div>
                        <p className="flex items-center gap-1 text-[11px] font-semibold text-[#92400E]">
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          <span>Limitations &amp; Risks</span>
                        </p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-[#4B5B51]">
                          {item.cultivationChallenges.slice(0, 3).map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Missing Information */}
                      {item.dataLimitations.length > 0 && (
                        <div className="rounded-md border border-[#E4E2DA] bg-white p-2 text-[11px] text-[#5F6E65]">
                          <p className="flex items-center gap-1 font-semibold text-[#14221A]">
                            <Info className="h-3 w-3 text-[#92400E]" aria-hidden="true" />
                            <span>Missing / Unknown Inputs ({item.dataCompletenessPct}% verified)</span>
                          </p>
                          <ul className="mt-0.5 list-disc pl-4">
                            {item.dataLimitations.slice(0, 3).map((lim) => (
                              <li key={lim}>{lim}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Rotation Planner Continuity Note */}
                      {rotCheck && (
                        <p
                          className={`text-[11px] ${
                            rotCheck.hasConflict ? 'text-[#991B1B]' : 'text-[#154734]'
                          }`}
                        >
                          {rotCheck.hasConflict
                            ? `Rotation warning: ${rotCheck.warningSummary}`
                            : `Rotation continuity: Fits cleanly next on ${farm.name} (projected sequence score ${rotCheck.planScore}/100).`}
                        </p>
                      )}
                    </div>

                    {onAddToRotation && (
                      <button
                        type="button"
                        onClick={() => onAddToRotation(item.crop)}
                        className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-[#154734] bg-white px-2.5 text-xs font-semibold text-[#154734] hover:bg-[#F2F8F4]"
                      >
                        Schedule {item.crop.name} Next
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5-Section Side-by-Side Comparison Matrix */}
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-display text-sm font-bold text-[#14221A]">
                Detailed Side-by-Side Comparison Matrix
              </h3>
              <div
                role="tablist"
                aria-label="Filter comparison matrix categories"
                className="flex flex-wrap items-center gap-1 rounded-lg bg-[#EAE8E0] p-1"
              >
                {SECTION_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={sectionTab === tab.id}
                    onClick={() => setSectionTab(tab.id)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                      sectionTab === tab.id
                        ? 'bg-white text-[#14221A] shadow-sm'
                        : 'text-[#4B5B51] hover:text-[#14221A]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile Stacked Comparison Cards (Zero Horizontal Hunting) */}
            <div className="space-y-3 md:hidden">
              {crops.map((item, idx) => {
                const climateCat = item.categories.find((c) => c.id === 'climate');
                const soilCat = item.categories.find((c) => c.id === 'soil');
                const rotCat = item.categories.find((c) => c.id === 'rotation');
                return (
                  <article
                    key={item.crop.id}
                    className="rounded-xl border border-[#E1E8E2] bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-[#E1E8E2] pb-2.5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                COMPARE_COLORS[idx % COMPARE_COLORS.length],
                            }}
                            aria-hidden="true"
                          />
                          <h4 className="font-display text-sm font-bold text-[#17231E]">
                            {item.crop.name}
                          </h4>
                        </div>
                        <p className="text-[11px] text-[#65736B]">
                          {item.crop.family} · {item.crop.category}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-bold tabular-nums text-[#174C3C]">
                        {item.overallScore}/100
                      </span>
                    </div>

                    <dl className="mt-3 space-y-2 text-xs">
                      {showSection('suitability') && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-[#65736B]">Suitability &amp; Confidence</dt>
                          <dd className="font-medium text-[#17231E]">
                            {item.suitabilityCategory} ({item.confidenceLevel})
                          </dd>
                        </div>
                      )}
                      {showSection('climate') && (
                        <>
                          <div className="flex justify-between gap-2">
                            <dt className="text-[#65736B]">Ideal Temp</dt>
                            <dd className="font-mono tabular-nums text-[#17231E]">
                              {formatTemp(item.crop.idealTempC[0], unitSystem)}–
                              {formatTemp(item.crop.idealTempC[1], unitSystem)}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-[#65736B]">Water Need</dt>
                            <dd className="font-mono tabular-nums text-[#17231E]">
                              {formatRainfall(item.crop.waterNeedMm[0], unitSystem)}–
                              {formatRainfall(item.crop.waterNeedMm[1], unitSystem)}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-[#65736B]">Climate Fit</dt>
                            <dd className="font-mono tabular-nums text-[#17231E]">
                              {climateCat?.status === 'unavailable'
                                ? 'NASA Unavailable'
                                : `${climateCat?.score ?? 0}/100`}
                            </dd>
                          </div>
                        </>
                      )}
                      {showSection('soil') && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-[#65736B]">Soil &amp; pH Fit</dt>
                          <dd className="text-right font-mono tabular-nums text-[#17231E]">
                            {soilCat?.score ?? 0}/100 · pH {item.crop.soilPhRange[0].toFixed(1)}–
                            {item.crop.soilPhRange[1].toFixed(1)}
                          </dd>
                        </div>
                      )}
                      {showSection('cultivation') && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-[#65736B]">Duration &amp; Irrigation</dt>
                          <dd className="text-right text-[#17231E]">
                            {item.crop.growingDurationDays[0]}–{item.crop.growingDurationDays[1]}d ·{' '}
                            {item.crop.irrigationDependency}
                          </dd>
                        </div>
                      )}
                      {showSection('rotation') && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-[#65736B]">Rotation &amp; N Balance</dt>
                          <dd className="text-right font-mono tabular-nums text-[#17231E]">
                            {rotCat?.status === 'unavailable'
                              ? 'History Missing'
                              : `${rotCat?.score ?? 0}/100`}{' '}
                            ·{' '}
                            {item.crop.nutrientRequirements.nitrogenDeltaKgHa >= 0
                              ? `+${item.crop.nutrientRequirements.nitrogenDeltaKgHa}`
                              : item.crop.nutrientRequirements.nitrogenDeltaKgHa}{' '}
                            kg/ha N
                          </dd>
                        </div>
                      )}
                    </dl>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto rounded-lg border border-[#E1E8E2] md:block">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E1E8E2] bg-[#F7F8F5] text-[#65736B]">
                    <th className="sticky left-0 z-10 min-w-[130px] bg-[#F7F8F5] px-3 py-3 font-medium sm:min-w-[180px] sm:px-4">
                      Comparison Attribute
                    </th>
                    {crops.map((item, idx) => (
                      <th
                        key={item.crop.id}
                        className="min-w-[205px] px-4 py-3 font-semibold text-[#14221A]"
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor:
                                COMPARE_COLORS[idx % COMPARE_COLORS.length],
                            }}
                            aria-hidden="true"
                          />
                          <span>{item.crop.name}</span>
                        </div>
                        <span className="block text-[11px] font-normal italic text-[#6B7970]">
                          {item.crop.scientificName} · {item.crop.family}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#ECEAE3]">
                  {/* SECTION 1: SUITABILITY */}
                  {showSection('suitability') && (
                    <>
                      <tr className="bg-[#F2F6F3]">
                        <td
                          colSpan={crops.length + 1}
                          className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#154734]"
                        >
                          Suitability (Deterministic Engine · 0–100)
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Overall Suitability Score
                        </td>
                        {crops.map((item) => (
                          <td
                            key={item.crop.id}
                            className="px-4 py-2.5 font-mono font-bold tabular-nums text-[#154734]"
                          >
                            {item.overallScore}/100 ({item.suitabilityCategory})
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Climate Score (30 pts)
                        </td>
                        {crops.map((item) => {
                          const cat = item.categories.find((c) => c.id === 'climate');
                          return (
                            <td key={item.crop.id} className="px-4 py-2.5 text-[#14221A]">
                              {cat?.status === 'unavailable' ? (
                                <span className="font-medium text-[#92400E]">
                                  Unavailable (0/30 pts)
                                </span>
                              ) : (
                                <span className="font-mono font-semibold tabular-nums">
                                  {cat?.score ?? 0}/100 (+{cat?.contribution ?? 0}/30)
                                </span>
                              )}
                              <span className="block text-[11px] text-[#6B7970]">
                                {cat?.detail}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Water Score (25 pts)
                        </td>
                        {crops.map((item) => {
                          const cat = item.categories.find((c) => c.id === 'water');
                          return (
                            <td key={item.crop.id} className="px-4 py-2.5 text-[#14221A]">
                              <span className="font-mono font-semibold tabular-nums">
                                {cat?.score !== null && cat?.score !== undefined
                                  ? `${cat.score}/100 (+${cat.contribution}/25)`
                                  : 'Unavailable'}
                              </span>
                              <span className="block text-[11px] text-[#6B7970]">
                                {cat?.status === 'partial'
                                  ? 'Partial: rainfall unavailable'
                                  : cat?.detail}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Soil Score (20 pts)
                        </td>
                        {crops.map((item) => {
                          const cat = item.categories.find((c) => c.id === 'soil');
                          return (
                            <td key={item.crop.id} className="px-4 py-2.5 text-[#14221A]">
                              <span className="font-mono font-semibold tabular-nums">
                                {cat?.score !== null && cat?.score !== undefined
                                  ? `${cat.score}/100 (+${cat.contribution}/20)`
                                  : 'Unavailable'}
                              </span>
                              <span className="block text-[11px] text-[#6B7970]">
                                {cat?.status === 'partial'
                                  ? 'Partial: parcel pH missing'
                                  : cat?.detail}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Growing-Season Score (15 pts)
                        </td>
                        {crops.map((item) => {
                          const cat = item.categories.find((c) => c.id === 'season');
                          return (
                            <td key={item.crop.id} className="px-4 py-2.5 text-[#14221A]">
                              {cat?.status === 'unavailable' ? (
                                <span className="font-medium text-[#92400E]">
                                  Unavailable (0/15 pts)
                                </span>
                              ) : (
                                <span className="font-mono font-semibold tabular-nums">
                                  {cat?.score ?? 0}/100 (+{cat?.contribution ?? 0}/15)
                                </span>
                              )}
                              <span className="block text-[11px] text-[#6B7970]">
                                {cat?.detail}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Rotation Score (10 pts)
                        </td>
                        {crops.map((item) => {
                          const cat = item.categories.find((c) => c.id === 'rotation');
                          return (
                            <td key={item.crop.id} className="px-4 py-2.5 text-[#14221A]">
                              {cat?.status === 'unavailable' ? (
                                <span className="font-medium text-[#92400E]">
                                  Unavailable (no crop history)
                                </span>
                              ) : (
                                <span className="font-mono font-semibold tabular-nums">
                                  {cat?.score ?? 0}/100 (+{cat?.contribution ?? 0}/10)
                                </span>
                              )}
                              <span className="block text-[11px] text-[#6B7970]">
                                {cat?.detail}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Confidence &amp; Completeness
                        </td>
                        {crops.map((item) => (
                          <td key={item.crop.id} className="px-4 py-2.5 text-[#14221A]">
                            <span className="font-semibold">
                              {item.confidenceLevel}
                            </span>{' '}
                            <span className="font-mono tabular-nums text-[#4B5B51]">
                              ({item.dataCompletenessPct}% verified)
                            </span>
                          </td>
                        ))}
                      </tr>
                    </>
                  )}

                  {/* SECTION 2: CLIMATE */}
                  {showSection('climate') && (
                    <>
                      <tr className="bg-[#F2F6F3]">
                        <td
                          colSpan={crops.length + 1}
                          className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#154734]"
                        >
                          Climate (Agronomic Ranges vs. NASA POWER Observations)
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Ideal Temperature Range
                        </td>
                        {crops.map((item) => (
                          <td
                            key={item.crop.id}
                            className="px-4 py-2.5 font-mono tabular-nums text-[#14221A]"
                          >
                            {formatTemp(item.crop.idealTempC[0], unitSystem)} –{' '}
                            {formatTemp(item.crop.idealTempC[1], unitSystem)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Temperature Tolerance (Frost / Heat)
                        </td>
                        {crops.map((item) => (
                          <td
                            key={item.crop.id}
                            className="px-4 py-2.5 font-mono tabular-nums text-[#14221A]"
                          >
                            <span>
                              Frost:{' '}
                              {item.crop.frostSensitivityC !== null
                                ? formatTemp(item.crop.frostSensitivityC, unitSystem)
                                : 'Unknown'}
                            </span>
                            <span className="block text-[11px] text-[#6B7970]">
                              Heat stress:{' '}
                              {item.crop.heatStressThresholdC !== null
                                ? `>${formatTemp(item.crop.heatStressThresholdC, unitSystem)}`
                                : 'Unknown'}
                            </span>
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Rainfall Requirements
                        </td>
                        {crops.map((item) => (
                          <td
                            key={item.crop.id}
                            className="px-4 py-2.5 font-mono tabular-nums text-[#14221A]"
                          >
                            {formatRainfall(item.crop.rainfallRangeMm[0], unitSystem)} –{' '}
                            {formatRainfall(item.crop.rainfallRangeMm[1], unitSystem)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Seasonal Water Requirements
                        </td>
                        {crops.map((item) => (
                          <td key={item.crop.id} className="px-4 py-2.5 text-[#14221A]">
                            <span className="font-mono tabular-nums">
                              {formatRainfall(item.crop.waterNeedMm[0], unitSystem)} –{' '}
                              {formatRainfall(item.crop.waterNeedMm[1], unitSystem)}
                            </span>
                            <span className="block text-[11px] text-[#6B7970]">
                              {item.waterConsiderations}
                            </span>
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Solar Radiation Suitability
                        </td>
                        {crops.map((item) => {
                          const solarMj = nasaData?.summary.avgSolarRadiationMj ?? null;
                          return (
                            <td key={item.crop.id} className="px-4 py-2.5 text-[#14221A]">
                              {solarMj !== null ? (
                                <>
                                  <span className="inline-flex items-center gap-1 font-mono font-semibold tabular-nums text-[#154734]">
                                    <Sun className="h-3 w-3" aria-hidden="true" />
                                    {solarMj.toFixed(1)} MJ/m²/day
                                  </span>
                                  <span className="block text-[11px] text-[#6B7970]">
                                    {solarMj >= 14
                                      ? 'High irradiance supports biomass accumulation'
                                      : solarMj >= 10
                                        ? 'Moderate solar irradiance observed'
                                        : 'Low irradiance window — slower canopy growth'}
                                  </span>
                                </>
                              ) : (
                                <span className="font-medium text-[#92400E]">
                                  Unavailable (NASA POWER ALLSKY_SFC_SW_DWN missing)
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Historical Farm Climate Fit
                        </td>
                        {crops.map((item) => {
                          const cat = item.categories.find((c) => c.id === 'climate');
                          return (
                            <td key={item.crop.id} className="px-4 py-2.5 text-[#14221A]">
                              {cat?.status === 'unavailable' ? (
                                <span className="font-medium text-[#92400E]">
                                  Cannot verify (NASA POWER unavailable)
                                </span>
                              ) : (
                                <>
                                  <span className="font-semibold text-[#154734]">
                                    {cat?.score}/100 ({cat?.status})
                                  </span>
                                  <span className="block text-[11px] text-[#6B7970]">
                                    {cat?.detail}
                                  </span>
                                </>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </>
                  )}

                  {/* SECTION 3: SOIL */}
                  {showSection('soil') && (
                    <>
                      <tr className="bg-[#F2F6F3]">
                        <td
                          colSpan={crops.length + 1}
                          className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#154734]"
                        >
                          Soil &amp; Nutrient Profile
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Suitable Soil Types
                        </td>
                        {crops.map((item) => {
                          const primaryMatch = item.crop.suitableSoilTypes.includes(
                            farm.soilType
                          );
                          const secondaryMatch = item.crop.secondarySoilTypes.includes(
                            farm.soilType
                          );
                          return (
                            <td key={item.crop.id} className="px-4 py-2.5 text-[#14221A]">
                              <span>{item.crop.suitableSoilTypes.join(', ')}</span>
                              <span
                                className={`block text-[11px] font-medium ${
                                  primaryMatch
                                    ? 'text-[#154734]'
                                    : secondaryMatch
                                      ? 'text-[#92400E]'
                                      : 'text-[#B91C1C]'
                                }`}
                              >
                                {primaryMatch
                                  ? `Matches ${farm.soilType} (Primary)`
                                  : secondaryMatch
                                    ? `${farm.soilType} is secondary`
                                    : `${farm.soilType} outside preferred`}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Soil pH Compatibility
                        </td>
                        {crops.map((item) => (
                          <td key={item.crop.id} className="px-4 py-2.5 text-[#14221A]">
                            <span className="font-mono tabular-nums">
                              Target pH {item.crop.soilPhRange[0].toFixed(1)}–
                              {item.crop.soilPhRange[1].toFixed(1)}
                            </span>
                            <span
                              className={`block text-[11px] ${
                                !validPh
                                  ? 'font-medium text-[#92400E]'
                                  : farm.health.phLevel >= item.crop.soilPhRange[0] &&
                                      farm.health.phLevel <= item.crop.soilPhRange[1]
                                    ? 'text-[#154734]'
                                    : 'text-[#92400E]'
                              }`}
                            >
                              {validPh
                                ? `Parcel pH ${farm.health.phLevel.toFixed(1)}`
                                : 'Parcel pH missing / unverified'}
                            </span>
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Drainage Preference
                        </td>
                        {crops.map((item) => (
                          <td key={item.crop.id} className="px-4 py-2.5 text-[#4B5B51]">
                            {item.crop.soilDrainagePreference}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Nutrient Requirements
                        </td>
                        {crops.map((item) => (
                          <td key={item.crop.id} className="px-4 py-2.5 text-[#14221A]">
                            <span className="font-semibold">
                              {item.crop.nutrientRequirements.nitrogenDemandLevel} N demand
                            </span>
                            <span className="block text-[11px] text-[#6B7970]">
                              {item.crop.nutrientRequirements.npkGuidanceKgHa}
                            </span>
                            <span className="block text-[11px] text-[#5F6E65]">
                              Micronutrients:{' '}
                              {item.crop.nutrientRequirements.keyMicronutrients.join(', ')}
                            </span>
                          </td>
                        ))}
                      </tr>
                    </>
                  )}

                  {/* SECTION 4: CULTIVATION */}
                  {showSection('cultivation') && (
                    <>
                      <tr className="bg-[#F2F6F3]">
                        <td
                          colSpan={crops.length + 1}
                          className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#154734]"
                        >
                          Cultivation &amp; Field Agronomics
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Preferred Growing Seasons
                        </td>
                        {crops.map((item) => (
                          <td key={item.crop.id} className="px-4 py-2.5 text-[#14221A]">
                            {item.crop.preferredSeasons.join(' · ')}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Approximate Growing Duration
                        </td>
                        {crops.map((item) => (
                          <td
                            key={item.crop.id}
                            className="px-4 py-2.5 font-mono tabular-nums text-[#14221A]"
                          >
                            {item.crop.growingDurationDays[0]}–
                            {item.crop.growingDurationDays[1]} days
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Irrigation Dependency
                        </td>
                        {crops.map((item) => (
                          <td key={item.crop.id} className="px-4 py-2.5 text-[#14221A]">
                            <span className="font-semibold">
                              {item.crop.irrigationDependency}
                            </span>
                            <span className="block text-[11px] text-[#6B7970]">
                              Parcel setup: {farm.irrigation}
                            </span>
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Root Depth
                        </td>
                        {crops.map((item) => (
                          <td key={item.crop.id} className="px-4 py-2.5 font-medium text-[#14221A]">
                            {item.crop.rootDepth}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Common Diseases &amp; Risks
                        </td>
                        {crops.map((item) => (
                          <td key={item.crop.id} className="px-4 py-2.5 text-[#4B5B51]">
                            <span className="font-medium text-[#14221A]">
                              Diseases: {item.crop.cultivationRisks.commonDiseases.slice(0, 2).join(', ')}
                            </span>
                            <span className="block text-[11px] text-[#6B7970]">
                              Pests: {item.crop.cultivationRisks.pestPressures.slice(0, 2).join(', ')}
                            </span>
                            <span className="block text-[11px] text-[#92400E]">
                              Abiotic: {item.crop.cultivationRisks.abioticRisks[0]}
                            </span>
                          </td>
                        ))}
                      </tr>
                    </>
                  )}

                  {/* SECTION 5: ROTATION */}
                  {showSection('rotation') && (
                    <>
                      <tr className="bg-[#F2F6F3]">
                        <td
                          colSpan={crops.length + 1}
                          className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#154734]"
                        >
                          Rotation &amp; Cropping History Compatibility
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Botanical Family
                        </td>
                        {crops.map((item) => (
                          <td key={item.crop.id} className="px-4 py-2.5 font-semibold text-[#14221A]">
                            {item.crop.family}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Best Preceding Crops
                        </td>
                        {crops.map((item) => (
                          <td key={item.crop.id} className="px-4 py-2.5 text-[#14221A]">
                            {item.crop.rotationCompatibility.bestPrecededBy.join(', ')}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Avoid Planting After
                        </td>
                        {crops.map((item) => (
                          <td key={item.crop.id} className="px-4 py-2.5 text-[#92400E]">
                            {item.crop.rotationCompatibility.avoidAfter.join(', ')}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Nitrogen &amp; Residue Effects
                        </td>
                        {crops.map((item) => (
                          <td key={item.crop.id} className="px-4 py-2.5 text-[#14221A]">
                            <span className="font-mono font-semibold tabular-nums">
                              {item.crop.nutrientRequirements.nitrogenRole} (
                              {item.crop.nutrientRequirements.nitrogenDeltaKgHa >= 0
                                ? `+${item.crop.nutrientRequirements.nitrogenDeltaKgHa}`
                                : item.crop.nutrientRequirements.nitrogenDeltaKgHa}{' '}
                              kg/ha)
                            </span>
                            <span className="block text-[11px] text-[#6B7970]">
                              {item.crop.rotationCompatibility.residueBenefit}
                            </span>
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-[#4B5B51]">
                          Farm Crop History &amp; Plan Fit
                        </td>
                        {crops.map((item) => {
                          const rotCat = item.categories.find((c) => c.id === 'rotation');
                          const rotPlanInfo = rotationPlanCompatibilityByCropId.get(
                            item.crop.id
                          );
                          return (
                            <td key={item.crop.id} className="px-4 py-2.5 text-[#14221A]">
                              {rotCat?.status === 'unavailable' ? (
                                <span className="font-medium text-[#92400E]">
                                  No crop history recorded on parcel
                                </span>
                              ) : (
                                <>
                                  <span className="font-semibold">
                                    {rotCat?.score}/100 ({rotCat?.detail})
                                  </span>
                                  {rotPlanInfo && (
                                    <span
                                      className={`block text-[11px] ${
                                        rotPlanInfo.hasConflict
                                          ? 'text-[#991B1B]'
                                          : 'text-[#154734]'
                                      }`}
                                    >
                                      {rotPlanInfo.hasConflict
                                        ? rotPlanInfo.warningSummary
                                        : `Next-stage plan score: ${rotPlanInfo.planScore}/100`}
                                    </span>
                                  )}
                                </>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
