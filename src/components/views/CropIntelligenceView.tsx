import {
  AlertTriangle,
  ArrowRight,
  Check,
  Droplets,
  Edit3,
  Eye,
  GitCompareArrows,
  Info,
  LayoutGrid,
  List,
  RefreshCw,
  Satellite,
  Search,
  ThermometerSun,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { CROP_KNOWLEDGE_DATABASE } from '../../data/cropKnowledgeDb';
import type { UseNasaPowerClimateResult } from '../../hooks/useNasaPowerClimate';
import { formatRainfall, formatTemp } from '../../lib/agronomy';
import {
  evaluateCropsForFarm,
  getTopRecommendedCrops,
  knowledgeEntryToCropProfile,
  MAX_COMPARISON_CROPS,
} from '../../lib/cropSuitabilityEngine';
import type {
  CropKnowledgeEntry,
  CropProfile,
  Farm,
  KnowledgeCropCategory,
  NavSection,
} from '../../types/rotatewise';
import { EmptyState } from '../common/StateFeedback';
import { CropProfilePanel } from '../crops/CropProfilePanel';
import { CropRecommendationCard } from '../crops/CropRecommendationCard';
import { Button } from '../ui/Button';
import { DataClassificationBadge } from '../ui/DataClassificationBadge';
import { PageHeader } from '../ui/PageHeader';

interface CropIntelligenceViewProps {
  farm: Farm | null;
  nasaClimate: UseNasaPowerClimateResult;
  unitSystem: 'imperial' | 'metric';
  comparedCropIds: string[];
  onToggleCompare: (cropId: string) => void;
  onAddToRotation: (crop: CropProfile) => void;
  onOpenAddFarm: () => void;
  onOpenEditFarm: (farm: Farm) => void;
  onNavigate: (section: NavSection) => void;
}

const CATEGORIES: Array<'All' | KnowledgeCropCategory> = [
  'All',
  'Cereal',
  'Legume',
  'Pulse',
  'Oilseed',
  'Fiber & Cash Crop',
];

function formatRetrievedTimestamp(iso: string | null): string {
  if (!iso) return 'Not yet retrieved';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function CropIntelligenceView({
  farm,
  nasaClimate,
  unitSystem,
  comparedCropIds,
  onToggleCompare,
  onAddToRotation,
  onOpenAddFarm,
  onOpenEditFarm,
  onNavigate,
}: CropIntelligenceViewProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | KnowledgeCropCategory>('All');
  const [selectedCropId, setSelectedCropId] = useState<string>('soybean');
  const [directoryView, setDirectoryView] = useState<'cards' | 'table'>('cards');

  const profileSectionRef = useRef<HTMLDivElement | null>(null);
  const nasaDataset = nasaClimate.status === 'success' ? nasaClimate.data : null;

  const evaluations = useMemo(
    () => evaluateCropsForFarm(farm, nasaDataset, CROP_KNOWLEDGE_DATABASE),
    [farm, nasaDataset]
  );

  const top5 = useMemo(() => getTopRecommendedCrops(evaluations, 5), [evaluations]);

  useEffect(() => {
    if (evaluations.length === 0) return;
    if (!evaluations.some((e) => e.crop.id === selectedCropId)) {
      setSelectedCropId(evaluations[0].crop.id);
    }
  }, [evaluations, selectedCropId]);

  if (!farm) {
    return (
      <EmptyState
        title="No Active Farm Selected"
        description="Select or add a farm parcel to run deterministic NASA POWER climate, soil, water, and rotation suitability scoring across 10 major crops."
        actionLabel="Add First Farm"
        onAction={onOpenAddFarm}
      />
    );
  }

  const filteredDirectory = evaluations.filter((item) => {
    const matchesCat = categoryFilter === 'All' || item.crop.category === categoryFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.crop.name.toLowerCase().includes(q) ||
      item.crop.scientificName.toLowerCase().includes(q) ||
      item.crop.family.toLowerCase().includes(q) ||
      item.crop.nutrientRequirements.nitrogenRole.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const selectedEvaluation =
    evaluations.find((e) => e.crop.id === selectedCropId) ??
    filteredDirectory[0] ??
    evaluations[0];

  const handleViewProfile = (cropId: string) => {
    setSelectedCropId(cropId);
    profileSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleScheduleKnowledgeCrop = (entry: CropKnowledgeEntry) => {
    onAddToRotation(knowledgeEntryToCropProfile(entry));
  };

  const top5ChartData = top5.map((item) => ({
    name: item.crop.name,
    score: item.overallScore,
    category: item.suitabilityCategory,
  }));

  const compareLimitReached = comparedCropIds.length >= MAX_COMPARISON_CROPS;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Crop Intelligence"
        title="Crop Intelligence Engine"
        subtitle={`Deterministic suitability scoring and 10-crop agronomic database anchored to ${farm.name}.`}
        classification={nasaDataset ? 'suitability' : 'insufficient'}
        metadata={
          <>
            <span className="font-mono tabular-nums text-[#17231E]">
              {farm.coordinates.lat.toFixed(4)}°, {farm.coordinates.lng.toFixed(4)}°
            </span>
            <span aria-hidden="true">·</span>
            <span>{farm.soilType}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">pH {farm.health.phLevel.toFixed(1)}</span>
            <span aria-hidden="true">·</span>
            <span>{farm.irrigation}</span>
            <span aria-hidden="true">·</span>
            <span>Prior/Current: {farm.currentCropName}</span>
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigate('comparison')}
            >
              <GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                Compare ({comparedCropIds.length}/{MAX_COMPARISON_CROPS})
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenEditFarm(farm)}
            >
              <Edit3 className="h-3.5 w-3.5 text-[#174C3C]" aria-hidden="true" />
              <span>Edit Soil / Crop</span>
            </Button>
          </>
        }
      />

      {/* NASA POWER Climate Context + Quick Window Selector */}
      <section
        aria-label="Climate observation context and NASA POWER controls"
        className="rounded-xl border border-[#E1E8E2] bg-white p-4"
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-2.5 text-xs">
            <Satellite className="mt-0.5 h-4 w-4 shrink-0 text-[#174C3C]" aria-hidden="true" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[#17231E]">
                  {nasaDataset
                    ? `NASA POWER (AG) · ${nasaDataset.startDate} to ${nasaDataset.endDate}`
                    : nasaClimate.status === 'loading'
                      ? `Retrieving NASA POWER (AG) observations for ${nasaClimate.appliedStartDate} to ${nasaClimate.appliedEndDate}...`
                      : `NASA POWER (AG) Unavailable · Requested ${nasaClimate.appliedStartDate} to ${nasaClimate.appliedEndDate}`}
                </p>
                <DataClassificationBadge
                  category={nasaDataset ? 'nasa' : 'insufficient'}
                />
              </div>
              <p className="mt-1 text-[#65736B]">
                {nasaDataset ? (
                  <>
                    Mean {formatTemp(nasaDataset.summary.meanTempC ?? 0, unitSystem)} · Rainfall{' '}
                    {formatRainfall(nasaDataset.summary.totalRainfallMm ?? 0, unitSystem)} (
                    {nasaDataset.summary.validDayCount} days) · Last climate retrieval:{' '}
                    <span className="font-mono tabular-nums">
                      {formatRetrievedTimestamp(nasaClimate.lastRetrievedAt)}
                    </span>
                  </>
                ) : (
                  <>
                    Last successful retrieval:{' '}
                    <span className="font-mono tabular-nums">
                      {formatRetrievedTimestamp(nasaClimate.lastRetrievedAt)}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: '30d', label: '30 Days' },
                { id: '90d', label: '90 Days' },
                { id: 'growing2026', label: '2026 Season' },
                { id: 'season2025', label: '2025 Season' },
              ] as const
            ).map((btn) => {
              const active = nasaClimate.preset === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => nasaClimate.selectPreset(btn.id)}
                  className={`h-8 rounded-md px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#174C3C] text-white'
                      : 'border border-[#E1E8E2] bg-[#F7F8F5] text-[#65736B] hover:bg-[#EAF2EC] hover:text-[#17231E]'
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={nasaClimate.refresh}
              aria-label="Refresh NASA POWER climate observations"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E1E8E2] bg-[#F7F8F5] px-2.5 text-xs font-medium text-[#65736B] hover:bg-[#EAF2EC] hover:text-[#17231E]"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${nasaClimate.status === 'loading' ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 border-t border-[#E1E8E2] pt-3 text-[11px] text-[#65736B]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#174C3C]" aria-hidden="true" />
          <span>
            <strong className="text-[#17231E]">Methodology Separation:</strong> Historical weather metrics come exclusively from{' '}
            <strong className="text-[#17231E]">NASA POWER</strong>; suitability scores (0–100) are calculated deterministically from FAO/ICAR/ICRISAT crop ranges and parcel soil, irrigation, and rotation history. Rankings provide agronomic planning guidance rather than yield or profit guarantees.
          </span>
        </div>
      </section>

      {nasaClimate.status === 'loading' && (
        <div
          role="status"
          aria-label="Evaluating crop suitability with NASA POWER observations"
          className="flex items-center gap-2.5 rounded-xl border border-[#C6DCD0] bg-[#EAF2EC] px-4 py-3 text-xs font-medium text-[#174C3C]"
        >
          <RefreshCw className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
          <span>
            Synchronizing NASA POWER observations for {farm.name} and recalculating crop suitability scores...
          </span>
        </div>
      )}

      {nasaClimate.status === 'error' && (
        <section
          role="alert"
          aria-label="NASA POWER unavailable limitation"
          className="rounded-xl border border-[#EBC4C4] bg-[#FEF3F3] p-4 text-xs text-[#991B1B]"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B91C1C]" aria-hidden="true" />
              <div>
                <p className="font-semibold text-[#7F1D1D]">
                  Climate Limitation: NASA POWER Observations Unavailable
                </p>
                <p className="mt-0.5">
                  {nasaClimate.error} Climate (30 pts), Rainfall (15 pts), and Growing-Season Fit (15 pts) are marked <strong>Unavailable (0 pts)</strong> and confidence is reduced to <strong>Low</strong>. Demonstration weather is not substituted.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={nasaClimate.refresh}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#DC2626]/40 bg-white px-3 text-xs font-semibold text-[#991B1B] hover:bg-[#FEE2E2] whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Retry NASA POWER</span>
            </button>
          </div>
        </section>
      )}

      {/* Top 5 Suitable Crops Section + Overview Bar Chart */}
      <section aria-label="Top 5 suitable crops" className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-[#17231E]">
              Top 5 Suitable Crops for {farm.name}
            </h2>
            <p className="text-xs text-[#65736B]">
              Weighted scoring: Climate (30%), Water &amp; Rainfall (25%), Soil &amp; pH (20%), Season Fit (15%), Rotation Break (10%)
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('comparison')}
          >
            <span>Open Side-by-Side Comparison</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>

        <div className="rounded-xl border border-[#E1E8E2] bg-white p-5">
          <p className="text-xs font-semibold text-[#17231E]">
            Top 5 Overall Suitability Scores (0–100)
          </p>
          <div className="mt-3 h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top5ChartData}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E1E8E2" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#65736B' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={95}
                  tick={{ fontSize: 12, fill: '#17231E', fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value, _n, item) => [
                    `${value ?? 0}/100 (${item?.payload?.category ?? ''})`,
                    'Suitability',
                  ]}
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid #E1E8E2',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="score" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {top5ChartData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={
                        entry.category === 'High'
                          ? '#174C3C'
                          : entry.category === 'Moderate'
                            ? '#287A5A'
                            : '#B45309'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-4">
          {top5.map((evaluation, index) => (
            <CropRecommendationCard
              key={evaluation.crop.id}
              rank={index + 1}
              evaluation={evaluation}
              isSelectedProfile={selectedEvaluation?.crop.id === evaluation.crop.id}
              isCompared={comparedCropIds.includes(evaluation.crop.id)}
              compareLimitReached={compareLimitReached}
              onViewProfile={handleViewProfile}
              onToggleCompare={onToggleCompare}
              onAddToRotation={handleScheduleKnowledgeCrop}
            />
          ))}
        </div>
      </section>

      {/* Full 10-Crop Knowledge Directory + Profile Inspector */}
      <section aria-label="Crop knowledge directory and profile details" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-[#17231E]">
              Complete 10-Crop Knowledge Directory &amp; Profile Inspector
            </h2>
            <p className="text-xs text-[#65736B]">
              Inspect suitability, water needs, temperature compatibility, and soil alignment, or select up to {MAX_COMPARISON_CROPS} crops to compare side-by-side.
            </p>
          </div>

          <div className="inline-flex self-start rounded-lg bg-[#E6ECE7] p-1">
            <button
              type="button"
              onClick={() => setDirectoryView('cards')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                directoryView === 'cards'
                  ? 'bg-white text-[#17231E] shadow-sm'
                  : 'text-[#65736B] hover:text-[#17231E]'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setDirectoryView('table')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                directoryView === 'table'
                  ? 'bg-white text-[#17231E] shadow-sm'
                  : 'text-[#65736B] hover:text-[#17231E]'
              }`}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Table</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#E6ECE7] p-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-white text-[#17231E] shadow-sm'
                    : 'text-[#65736B] hover:text-[#17231E]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#65736B]"
              aria-hidden="true"
            />
            <label htmlFor="crop-search-input" className="sr-only">
              Search 10-crop database
            </label>
            <input
              id="crop-search-input"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search crop, family, nitrogen role..."
              className="h-10 w-full rounded-lg border border-[#D4DDD6] bg-white pr-3 pl-9 text-sm text-[#17231E] focus:border-[#174C3C] focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="xl:col-span-6">
            {directoryView === 'cards' ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {filteredDirectory.map((item) => {
                  const isSelected = selectedEvaluation?.crop.id === item.crop.id;
                  const isCompared = comparedCropIds.includes(item.crop.id);
                  const soilCat = item.categories.find((c) => c.id === 'soil');
                  const climateCat = item.categories.find((c) => c.id === 'climate');

                  return (
                    <article
                      key={item.crop.id}
                      className={`flex flex-col justify-between rounded-xl border bg-white p-4 transition-colors ${
                        isSelected
                          ? 'border-[#174C3C] ring-1 ring-[#174C3C]/15'
                          : 'border-[#E1E8E2] hover:border-[#B9C9BE]'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-display text-sm font-bold text-[#17231E]">
                              {item.crop.name}
                            </h3>
                            <p className="text-[11px] text-[#65736B]">
                              {item.crop.family} · {item.crop.preferredSeasons[0]?.split(' ')[0]}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-mono text-base font-bold tabular-nums text-[#174C3C]">
                              {item.overallScore}
                            </span>
                            <span className="text-[11px] text-[#65736B]">/100</span>
                            <span className="block text-[10px] font-semibold text-[#65736B]">
                              {item.suitabilityCategory}
                            </span>
                          </div>
                        </div>

                        <dl className="mt-3 space-y-1.5 border-t border-[#E1E8E2] pt-2.5 text-[11px]">
                          <div className="flex items-center justify-between gap-2">
                            <dt className="flex items-center gap-1 text-[#65736B]">
                              <Droplets className="h-3 w-3 text-[#287A5A]" aria-hidden="true" />
                              <span>Water Need</span>
                            </dt>
                            <dd className="font-mono font-medium tabular-nums text-[#17231E]">
                              {formatRainfall(item.crop.waterNeedMm[0], unitSystem)}–
                              {formatRainfall(item.crop.waterNeedMm[1], unitSystem)}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="flex items-center gap-1 text-[#65736B]">
                              <ThermometerSun className="h-3 w-3 text-[#287A5A]" aria-hidden="true" />
                              <span>Temp Fit</span>
                            </dt>
                            <dd className="font-mono font-medium tabular-nums text-[#17231E]">
                              {climateCat?.status === 'unavailable'
                                ? 'NASA N/A'
                                : `${climateCat?.score ?? 0}/100`}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-[#65736B]">Soil Match</dt>
                            <dd className="font-mono font-medium tabular-nums text-[#17231E]">
                              {soilCat?.score ?? 0}/100
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div className="mt-3 flex items-center gap-1.5 border-t border-[#E1E8E2] pt-3">
                        <button
                          type="button"
                          onClick={() => handleViewProfile(item.crop.id)}
                          className={`inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border px-2 text-[11px] font-medium ${
                            isSelected
                              ? 'border-[#174C3C] bg-[#EAF2EC] text-[#174C3C]'
                              : 'border-[#E1E8E2] bg-white text-[#17231E] hover:bg-[#F7F8F5]'
                          }`}
                        >
                          <Eye className="h-3 w-3" aria-hidden="true" />
                          <span>View Details</span>
                        </button>
                        <button
                          type="button"
                          disabled={!isCompared && compareLimitReached}
                          onClick={() => onToggleCompare(item.crop.id)}
                          className={`inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-[11px] font-medium ${
                            isCompared
                              ? 'border-[#174C3C] bg-[#174C3C] text-white'
                              : 'border-[#E1E8E2] bg-white text-[#17231E] hover:bg-[#F7F8F5] disabled:opacity-45'
                          }`}
                        >
                          {isCompared ? (
                            <Check className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <GitCompareArrows className="h-3 w-3" aria-hidden="true" />
                          )}
                          <span>{isCompared ? 'Added' : 'Compare'}</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
                {filteredDirectory.length === 0 && (
                  <div className="col-span-full rounded-xl border border-[#E1E8E2] bg-white p-8 text-center text-sm text-[#65736B]">
                    No crops match your current search or category filter.
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[#E1E8E2] bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E1E8E2] bg-[#F7F8F5] text-[#65736B]">
                        <th className="px-4 py-3 font-medium">Crop</th>
                        <th className="px-4 py-3 font-medium">Category</th>
                        <th className="px-4 py-3 text-right font-medium">Score</th>
                        <th className="px-4 py-3 font-medium">Suitability</th>
                        <th className="px-4 py-3 text-right font-medium">Compare</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E1E8E2]">
                      {filteredDirectory.map((item) => {
                        const isSelected = selectedEvaluation?.crop.id === item.crop.id;
                        const isCompared = comparedCropIds.includes(item.crop.id);
                        return (
                          <tr
                            key={item.crop.id}
                            onClick={() => setSelectedCropId(item.crop.id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-[#EAF2EC]' : 'hover:bg-[#F7F8F5]'
                            }`}
                          >
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCropId(item.crop.id);
                                }}
                                className="text-left font-semibold text-[#17231E] hover:underline"
                              >
                                {item.crop.name}
                              </button>
                              <div className="text-[11px] text-[#65736B]">
                                {item.crop.family} · {item.crop.growingDurationDays[0]}–
                                {item.crop.growingDurationDays[1]}d
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[#65736B]">{item.crop.category}</td>
                            <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-[#174C3C]">
                              {item.overallScore}/100
                            </td>
                            <td className="px-4 py-3 text-[#17231E]">
                              <span className="font-medium">{item.suitabilityCategory}</span>
                              <span className="block text-[11px] text-[#65736B]">
                                {item.confidenceLevel} conf.
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                disabled={!isCompared && compareLimitReached}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleCompare(item.crop.id);
                                }}
                                aria-label={
                                  isCompared
                                    ? `Remove ${item.crop.name} from comparison`
                                    : `Compare ${item.crop.name}`
                                }
                                className={`inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-[11px] font-medium ${
                                  isCompared
                                    ? 'border-[#174C3C] bg-[#174C3C] text-white'
                                    : 'border-[#D4DDD6] bg-white text-[#17231E] hover:bg-[#F7F8F5] disabled:opacity-45'
                                }`}
                              >
                                {isCompared ? (
                                  <Check className="h-3 w-3" aria-hidden="true" />
                                ) : (
                                  <GitCompareArrows className="h-3 w-3" aria-hidden="true" />
                                )}
                                <span>{isCompared ? 'Added' : 'Compare'}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div ref={profileSectionRef} className="xl:col-span-6">
            {selectedEvaluation && (
              <CropProfilePanel
                evaluation={selectedEvaluation}
                unitSystem={unitSystem}
                isCompared={comparedCropIds.includes(selectedEvaluation.crop.id)}
                compareLimitReached={compareLimitReached}
                onToggleCompare={onToggleCompare}
                onAddToRotation={handleScheduleKnowledgeCrop}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
