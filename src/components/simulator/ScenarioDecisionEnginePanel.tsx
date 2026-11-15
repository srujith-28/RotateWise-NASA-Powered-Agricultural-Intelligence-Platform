import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Award,
  Check,
  GitCompareArrows,
  Info,
  Minus,
  RotateCcw,
  Scale,
  Sliders,
} from 'lucide-react';
import { useState } from 'react';
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
import { formatRainfall } from '../../lib/agronomy';
import {
  analyzeDecisionSensitivity,
  DECISION_CATEGORY_DESCRIPTIONS,
  DECISION_CATEGORY_LABELS,
  DECISION_CATEGORY_ORDER,
  DEFAULT_DECISION_WEIGHTS,
  evaluateMultiScenarioDecision,
} from '../../lib/decisionScoringEngine';
import { MAX_COMPARISON_SCENARIOS } from '../../lib/scenarioSimulationEngine';
import type {
  DecisionCategoryId,
  DecisionWeights,
  Farm,
  FarmDecisionPreferences,
  NasaPowerClimateDataset,
  SavedClimateScenario,
  ScenarioRiskLevel,
} from '../../types/rotatewise';
import { MetricTooltip } from '../common/MetricTooltip';

interface ScenarioDecisionEnginePanelProps {
  farm: Farm;
  nasaData: NasaPowerClimateDataset | null;
  scenarios: SavedClimateScenario[];
  preferences: FarmDecisionPreferences;
  unitSystem: 'imperial' | 'metric';
  onToggleCompareScenario: (scenarioId: string) => void;
  onChangeWeights: (weights: DecisionWeights) => void;
  onToggleBaselineReference: (include: boolean) => void;
  onRestoreDefaultWeights: () => void;
  onResetFarmPreferences: () => void;
}

const RISK_LEVEL_TO_NUM: Record<ScenarioRiskLevel, number> = {
  Low: 1,
  Moderate: 2,
  High: 3,
  Critical: 4,
};

const NUM_TO_RISK_LABEL: Record<number, string> = {
  1: 'Low',
  2: 'Moderate',
  3: 'High',
  4: 'Critical',
};

function getRiskTextClass(level: ScenarioRiskLevel | null): string {
  if (level === 'Critical') return 'font-bold text-[#991B1B]';
  if (level === 'High') return 'font-bold text-[#B91C1C]';
  if (level === 'Moderate') return 'font-semibold text-[#B45309]';
  if (level === 'Low') return 'font-semibold text-[#174C3C]';
  return 'text-[#737D76]';
}

function formatChartAxisLabel(label: string, maxLen = 12): string {
  if (label.length <= maxLen) return label;
  return `${label.slice(0, maxLen - 1).trimEnd()}…`;
}

export function ScenarioDecisionEnginePanel({
  farm,
  nasaData,
  scenarios,
  preferences,
  unitSystem,
  onToggleCompareScenario,
  onChangeWeights,
  onToggleBaselineReference,
  onRestoreDefaultWeights,
  onResetFarmPreferences,
}: ScenarioDecisionEnginePanelProps) {
  const [referenceWeights, setReferenceWeights] = useState<DecisionWeights>(
    () => ({ ...DEFAULT_DECISION_WEIGHTS })
  );

  const report = evaluateMultiScenarioDecision({
    farm,
    nasaData,
    scenarios,
    selectedScenarioIds: preferences.selectedScenarioIds,
    weights: preferences.weights,
    includeBaselineReference: preferences.includeBaselineReference,
  });

  const sensitivity = analyzeDecisionSensitivity({
    farm,
    nasaData,
    scenarios,
    selectedScenarioIds: preferences.selectedScenarioIds,
    previousWeights: referenceWeights,
    currentWeights: preferences.weights,
  });

  const { normalizedWeights, candidates, recommendation } = report;

  const handleSliderOrNumberChange = (id: DecisionCategoryId, rawVal: number) => {
    const clamped = Number.isFinite(rawVal)
      ? Math.max(0, Math.min(100, Math.round(rawVal)))
      : 0;
    onChangeWeights({
      ...preferences.weights,
      [id]: clamped,
    });
  };

  // Chart 1: Weighted Score vs. Overall Crop Suitability
  const weightedChartData = candidates.map((c) => {
    const fullName = c.isBaselineReference ? 'Baseline Reference' : c.label;
    return {
      shortName: formatChartAxisLabel(
        c.isBaselineReference ? 'Baseline Ref' : c.label
      ),
      fullName,
      WeightedScore: c.weightedScore ?? 0,
      OverallSuitability: c.overallCropSuitability ?? 0,
    };
  });

  // Chart 2: Stacked Category Contributions
  const contributionChartData = candidates.map((c) => {
    const getContrib = (id: DecisionCategoryId) =>
      c.categoryBreakdowns.find((b) => b.id === id)?.contribution ?? 0;
    const fullName = c.isBaselineReference ? 'Baseline Reference' : c.label;
    return {
      shortName: formatChartAxisLabel(
        c.isBaselineReference ? 'Baseline Ref' : c.label
      ),
      fullName,
      Climate: getContrib('climate'),
      Water: getContrib('water'),
      Soil: getContrib('soil'),
      Rotation: getContrib('rotation'),
    };
  });

  // Chart 3: Risk Severity Comparison (1=Low, 2=Moderate, 3=High, 4=Critical)
  const riskChartData = candidates.map((c) => {
    const fullName = c.isBaselineReference ? 'Baseline Reference' : c.label;
    return {
      shortName: formatChartAxisLabel(
        c.isBaselineReference ? 'Baseline Ref' : c.label
      ),
      fullName,
      RainfallStress: c.rainfallStressLevel ? RISK_LEVEL_TO_NUM[c.rainfallStressLevel] : 0,
      HeatStress: c.heatStressLevel ? RISK_LEVEL_TO_NUM[c.heatStressLevel] : 0,
      OverallRisk: c.overallRiskLevel ? RISK_LEVEL_TO_NUM[c.overallRiskLevel] : 0,
    };
  });

  return (
    <section
      aria-label="Advanced Scenario Decision Engine"
      className="space-y-6 rounded-2xl border border-[#E7EBE7] bg-white p-5 sm:p-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-[#E7EBE7] pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Scale className="h-4 w-4 shrink-0 text-[#174C3C]" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold tracking-[-0.015em] text-[#18231E]">
              Advanced Scenario Decision Engine
            </h2>
            <MetricTooltip
              label="Weighted Decision Engine"
              description="Ranks up to 3 saved scenarios (plus optional historical baseline reference) using normalized decision priority weights applied directly to Crop Intelligence category scores."
            />
          </div>
          <p className="mt-1 text-xs text-[#737D76]">
            Preferences saved per farm for <span className="font-semibold text-[#18231E]">{farm.name}</span> · Last baseline window:{' '}
            <span className="font-mono tabular-nums">
              {preferences.lastBaselinePreset}
              {preferences.lastBaselineStartDate && preferences.lastBaselineEndDate
                ? ` (${preferences.lastBaselineStartDate} to ${preferences.lastBaselineEndDate})`
                : ''}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-[#E7EBE7] bg-[#F7F8F6] px-3 text-xs font-medium text-[#18231E] hover:bg-[#EAF2EC]">
            <input
              type="checkbox"
              checked={preferences.includeBaselineReference}
              onChange={(e) => onToggleBaselineReference(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-[#174C3C]"
            />
            <span className="whitespace-nowrap">Include Baseline Reference</span>
          </label>
          <button
            type="button"
            onClick={() => {
              onResetFarmPreferences();
              setReferenceWeights({ ...DEFAULT_DECISION_WEIGHTS });
            }}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#E7EBE7] bg-white px-3 text-xs font-medium text-[#18231E] hover:bg-[#F7F8F6]"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#174C3C]" aria-hidden="true" />
            <span>Reset Farm Preferences</span>
          </button>
        </div>
      </div>

      {/* Multi-Scenario Selection Bar */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-[#18231E]">
            <GitCompareArrows className="h-3.5 w-3.5 text-[#174C3C]" aria-hidden="true" />
            <span>
              Select Up to {MAX_COMPARISON_SCENARIOS} Saved Scenarios to Rank ({preferences.selectedScenarioIds.length}/{MAX_COMPARISON_SCENARIOS})
            </span>
          </span>
          <span className="text-[11px] text-[#737D76]">
            Synced with Saved Scenarios comparison list
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {scenarios.map((scen) => {
            const isSelected = preferences.selectedScenarioIds.includes(scen.id);
            const atLimit =
              !isSelected &&
              preferences.selectedScenarioIds.length >= MAX_COMPARISON_SCENARIOS;
            return (
              <button
                key={scen.id}
                type="button"
                disabled={atLimit}
                aria-pressed={isSelected}
                onClick={() => onToggleCompareScenario(scen.id)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-[#174C3C] text-white'
                    : 'bg-[#F7F8F6] text-[#737D76] hover:bg-[#EAF2EC] hover:text-[#18231E] disabled:opacity-45'
                }`}
              >
                {isSelected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                <span>{scen.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Adjustable Decision Weights + Best-Supported Recommendation */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Adjustable Weights Panel */}
        <div className="min-w-0 rounded-2xl bg-[#F7F8F6] p-5 lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7EBE7] pb-3">
            <div className="flex items-center gap-1.5">
              <Sliders className="h-4 w-4 text-[#174C3C]" aria-hidden="true" />
              <h3 className="font-display text-sm font-semibold text-[#18231E]">
                Decision Priority Weights
              </h3>
              <MetricTooltip
                label="Automatic Weight Normalization"
                description="Raw weights (0–100) are automatically normalized so their effective percentages sum to 100.0%. Setting a weight to 0 excludes that factor from the weighted score."
              />
            </div>
            <button
              type="button"
              onClick={onRestoreDefaultWeights}
              className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-[#E7EBE7] bg-white px-2.5 text-[11px] font-medium text-[#18231E] hover:bg-[#EAF2EC]"
            >
              <RotateCcw className="h-3 w-3 text-[#737D76]" aria-hidden="true" />
              <span>Restore Default Weights</span>
            </button>
          </div>

          <div className="mt-4 space-y-3.5">
            {DECISION_CATEGORY_ORDER.map((catId) => {
              const rawValue = preferences.weights[catId];
              const effectivePct = normalizedWeights.effectivePct[catId];
              return (
                <div key={catId} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <label
                      htmlFor={`decision-weight-${catId}`}
                      className="flex items-center gap-1 font-semibold text-[#18231E]"
                    >
                      <span>{DECISION_CATEGORY_LABELS[catId]}</span>
                      <MetricTooltip
                        label={DECISION_CATEGORY_LABELS[catId]}
                        description={DECISION_CATEGORY_DESCRIPTIONS[catId]}
                      />
                    </label>
                    <div className="flex items-center gap-2 font-mono tabular-nums">
                      <input
                        id={`decision-weight-num-${catId}`}
                        type="number"
                        min={0}
                        max={100}
                        aria-label={`${DECISION_CATEGORY_LABELS[catId]} raw weight`}
                        value={rawValue}
                        onChange={(e) =>
                          handleSliderOrNumberChange(catId, Number(e.target.value))
                        }
                        className="h-7 w-14 rounded-lg border border-[#E7EBE7] bg-white px-1.5 text-right text-xs text-[#18231E]"
                      />
                      <span
                        data-testid={`normalized-weight-${catId}`}
                        className="w-16 text-right text-xs font-bold text-[#174C3C]"
                      >
                        {effectivePct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <input
                    id={`decision-weight-${catId}`}
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={rawValue}
                    onChange={(e) =>
                      handleSliderOrNumberChange(catId, Number(e.target.value))
                    }
                    className="w-full accent-[#174C3C]"
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-[#E7EBE7] pt-3 text-xs">
            <span className="text-[#737D76]">
              Effective Normalized Total
            </span>
            <span className="font-mono font-bold tabular-nums text-[#174C3C]">
              {normalizedWeights.allWeightsZero ? '0.0%' : '100.0%'}
            </span>
          </div>

          {normalizedWeights.allWeightsZero && (
            <div
              role="alert"
              className="mt-3 rounded-xl bg-[#FEF2F2] p-3 text-xs text-[#991B1B]"
            >
              All decision weights are 0%. Set at least one category above 0 or click Restore Default Weights.
            </div>
          )}
        </div>

        {/* Best-Supported Scenario Recommendation */}
        <div
          aria-label="Best-supported scenario recommendation"
          className="min-w-0 rounded-2xl bg-[#EAF2EC] p-5 lg:col-span-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#D6E4DA] pb-3.5">
            <div className="flex items-start gap-2">
              <Award className="mt-0.5 h-4 w-4 shrink-0 text-[#174C3C]" aria-hidden="true" />
              <div>
                <h3 className="font-display text-sm font-semibold text-[#18231E]">
                  {recommendation.headline}
                </h3>
                <p className="mt-0.5 text-xs text-[#4B5B51]">
                  {recommendation.confidenceAssessment}
                </p>
              </div>
            </div>
            {recommendation.topScore !== null && (
              <div className="shrink-0 whitespace-nowrap text-right font-mono tabular-nums">
                <span className="text-xl font-bold text-[#174C3C]">
                  {recommendation.topScore.toFixed(1)}
                </span>
                <span className="text-xs text-[#737D76]">/100</span>
              </div>
            )}
          </div>

          <div className="mt-3.5 space-y-3.5 text-xs text-[#4B5B51]">
            <div>
              <p className="font-semibold text-[#18231E]">
                {recommendation.status === 'winner'
                  ? 'Why It Ranks First'
                  : recommendation.status === 'tie'
                    ? 'Tie Explanation'
                    : 'Evidence Limitation'}
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4">
                {recommendation.whyRankedFirst.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            {recommendation.topContributingCategories.length > 0 && (
              <div className="grid grid-cols-1 gap-4 border-t border-[#D6E4DA] pt-3.5 sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-[#18231E]">
                    Top Contributing Categories
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {recommendation.topContributingCategories
                      .slice(0, 3)
                      .map((cat) => (
                        <li
                          key={cat.id}
                          className="flex items-center justify-between gap-2 font-mono text-[11px] tabular-nums"
                        >
                          <span className="font-sans text-[#4B5B51]">{cat.label}</span>
                          <span className="font-semibold text-[#174C3C]">
                            +{cat.contribution.toFixed(1)} pts ({cat.rawScore}/100)
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-[#18231E]">
                    Underperforming / Unavailable
                  </p>
                  {recommendation.underperformingCategories.length === 0 ? (
                    <p className="mt-1.5 text-[11px] text-[#174C3C]">
                      All weighted categories score ≥ 65/100.
                    </p>
                  ) : (
                    <ul className="mt-1.5 space-y-1">
                      {recommendation.underperformingCategories.map((cat) => (
                        <li
                          key={cat.id}
                          className="flex items-center justify-between gap-2 font-mono text-[11px] tabular-nums"
                        >
                          <span className="font-sans text-[#4B5B51]">{cat.label}</span>
                          <span className="font-semibold text-[#B45309]">
                            {cat.rawScore !== null
                              ? `${cat.rawScore}/100 (${cat.contribution.toFixed(1)} pts)`
                              : 'Unavailable'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {recommendation.remainingRisks.length > 0 && (
              <div className="border-t border-[#D6E4DA] pt-3.5">
                <p className="flex items-center gap-1.5 font-semibold text-[#18231E]">
                  <AlertTriangle className="h-3.5 w-3.5 text-[#B45309]" aria-hidden="true" />
                  <span>Remaining Risks to Mitigate</span>
                </p>
                <ul className="mt-1.5 space-y-1 text-[11px]">
                  {recommendation.remainingRisks.slice(0, 3).map((risk) => (
                    <li key={risk.id}>
                      <span className={getRiskTextClass(risk.level)}>{risk.level}</span> ·{' '}
                      <strong className="text-[#18231E]">{risk.label}:</strong>{' '}
                      {risk.explanation.replace(
                        /\bis flagged in avoidAfter\b/g,
                        'is flagged as an incompatible follow-on crop'
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Decision Visualizations */}
      {report.evaluatedAtStatus === 'ready' && candidates.length > 0 && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* 1. Weighted Score Comparison Chart */}
          <div className="min-w-0 rounded-2xl bg-[#F7F8F6] p-4">
            <h3 className="flex items-center gap-1.5 font-display text-sm font-semibold text-[#18231E]">
              <span>Weighted Decision Score (0–100)</span>
              <MetricTooltip
                label="Weighted Decision Score"
                description="Sum of (category score × effective normalized weight / 100) vs. unweighted Overall Crop Suitability."
              />
            </h3>
            <p className="mt-0.5 text-[11px] text-[#737D76]">
              Weighted priority score vs. baseline crop suitability
            </p>
            <div className="mt-3 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weightedChartData}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid stroke="#E7EBE7" vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    interval={0}
                    tick={{ fontSize: 10, fill: '#737D76' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: '#737D76' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    labelFormatter={(_, payload) =>
                      String(payload?.[0]?.payload?.fullName ?? '')
                    }
                    formatter={(val) => [`${val ?? 0}/100`]}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #E7EBE7',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar
                    dataKey="WeightedScore"
                    name="Weighted Score"
                    fill="#174C3C"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="OverallSuitability"
                    name="Crop Suitability"
                    fill="#B9CEC0"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. Category Contribution Chart */}
          <div className="min-w-0 rounded-2xl bg-[#F7F8F6] p-4">
            <h3 className="flex items-center gap-1.5 font-display text-sm font-semibold text-[#18231E]">
              <span>Category Contributions (pts)</span>
              <MetricTooltip
                label="Category Contributions"
                description="Stacked weighted point contributions from Climate, Water, Soil, and Rotation summing to each scenario's Weighted Decision Score."
              />
            </h3>
            <p className="mt-0.5 text-[11px] text-[#737D76]">
              Point breakdown adding up to total weighted score
            </p>
            <div className="mt-3 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={contributionChartData}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid stroke="#E7EBE7" vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    interval={0}
                    tick={{ fontSize: 10, fill: '#737D76' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: '#737D76' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    labelFormatter={(_, payload) =>
                      String(payload?.[0]?.payload?.fullName ?? '')
                    }
                    formatter={(val) => [`${val ?? 0} pts`]}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #E7EBE7',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="Climate" stackId="a" fill="#174C3C" isAnimationActive={false} />
                  <Bar dataKey="Water" stackId="a" fill="#287A5A" isAnimationActive={false} />
                  <Bar dataKey="Soil" stackId="a" fill="#3B6E8C" isAnimationActive={false} />
                  <Bar
                    dataKey="Rotation"
                    stackId="a"
                    fill="#B45309"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. Risk Comparison Chart */}
          <div className="min-w-0 rounded-2xl bg-[#F7F8F6] p-4">
            <h3 className="flex items-center gap-1.5 font-display text-sm font-semibold text-[#18231E]">
              <span>Risk Severity Comparison</span>
              <MetricTooltip
                label="Risk Severity Scale"
                description="Compares Rainfall Stress, Heat Stress, and Overall Risk on a deterministic 1–4 scale (1 = Low, 2 = Moderate, 3 = High, 4 = Critical). Lower bars mean lower risk."
              />
            </h3>
            <p className="mt-0.5 text-[11px] text-[#737D76]">
              Lower severity is safer (1=Low · 4=Critical)
            </p>
            <div className="mt-3 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={riskChartData}
                  margin={{ top: 8, right: 8, left: -6, bottom: 0 }}
                >
                  <CartesianGrid stroke="#E7EBE7" vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    interval={0}
                    tick={{ fontSize: 10, fill: '#737D76' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 4]}
                    ticks={[1, 2, 3, 4]}
                    tickFormatter={(v) => NUM_TO_RISK_LABEL[v] ?? ''}
                    tick={{ fontSize: 10, fill: '#737D76' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    labelFormatter={(_, payload) =>
                      String(payload?.[0]?.payload?.fullName ?? '')
                    }
                    formatter={(val) => [
                      NUM_TO_RISK_LABEL[Number(val)] ?? String(val ?? ''),
                    ]}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #E7EBE7',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar
                    dataKey="RainfallStress"
                    name="Rainfall Stress"
                    fill="#287A5A"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="HeatStress"
                    name="Heat Stress"
                    fill="#B45309"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="OverallRisk"
                    name="Overall Risk"
                    fill="#B91C1C"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Full 10-Dimension Scenario Ranking & Comparison Table */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 font-display text-sm font-semibold text-[#18231E]">
            <span>Scenario Ranking &amp; Multi-Factor Comparison Matrix</span>
            <MetricTooltip
              label="Ranking & Matrix Calculation"
              description="Weighted Score sums each available category score multiplied by its normalized percentage weight. Missing categories contribute 0 pts and are flagged explicitly."
            />
          </h3>
          <span className="text-[11px] text-[#737D76]">
            Covers all 10 climate, soil, water, seasonal, rotation, and risk metrics
          </span>
        </div>

        {candidates.length === 0 ? (
          <p className="rounded-xl bg-[#F7F8F6] p-4 text-xs text-[#737D76]">
            Select at least one saved scenario above to populate the ranking table.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#E7EBE7]">
            <table className="w-full border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-[#E7EBE7] bg-[#F7F8F6] text-[#737D76]">
                  <th className="py-2.5 pr-1.5 pl-3 font-medium whitespace-nowrap">Rank</th>
                  <th className="min-w-[132px] max-w-[170px] px-2 py-2.5 font-medium">Scenario</th>
                  <th className="px-2 py-2.5 text-right font-medium leading-tight">
                    Weighted
                  </th>
                  <th className="px-2 py-2.5 text-right font-medium leading-tight">
                    Overall
                  </th>
                  <th className="px-2 py-2.5 text-right font-medium leading-tight whitespace-nowrap">
                    Clim ({normalizedWeights.effectivePct.climate.toFixed(0)}%)
                  </th>
                  <th className="px-2 py-2.5 text-right font-medium leading-tight whitespace-nowrap">
                    Water ({normalizedWeights.effectivePct.water.toFixed(0)}%)
                  </th>
                  <th className="px-2 py-2.5 text-right font-medium leading-tight whitespace-nowrap">
                    Soil ({normalizedWeights.effectivePct.soil.toFixed(0)}%)
                  </th>
                  <th className="px-2 py-2.5 text-right font-medium leading-tight">
                    Season
                  </th>
                  <th className="px-2 py-2.5 text-right font-medium leading-tight whitespace-nowrap">
                    Rot. ({normalizedWeights.effectivePct.rotation.toFixed(0)}%)
                  </th>
                  <th className="px-2 py-2.5 text-right font-medium leading-tight">
                    Water Avail.
                  </th>
                  <th className="px-2 py-2.5 font-medium leading-tight">
                    Rain Stress
                  </th>
                  <th className="px-2 py-2.5 font-medium leading-tight">
                    Heat Stress
                  </th>
                  <th className="px-2 py-2.5 font-medium leading-tight">
                    Overall Risk
                  </th>
                  <th className="py-2.5 pr-3 pl-2 font-medium leading-tight">
                    Confidence
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7EBE7]">
                {candidates.map((item) => {
                  const getBreakdown = (id: DecisionCategoryId) =>
                    item.categoryBreakdowns.find((b) => b.id === id);
                  const clim = getBreakdown('climate');
                  const wat = getBreakdown('water');
                  const soil = getBreakdown('soil');
                  const rot = getBreakdown('rotation');
                  const isTop =
                    !item.isBaselineReference &&
                    recommendation.status === 'winner' &&
                    recommendation.winnerIds.includes(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={
                        item.isBaselineReference
                          ? 'bg-[#F7F8F6]'
                          : isTop
                            ? 'bg-[#EAF2EC]/60'
                            : 'hover:bg-[#F7F8F6]/70'
                      }
                    >
                      <td className="py-2.5 pr-1.5 pl-3 font-mono font-bold tabular-nums text-[#18231E] whitespace-nowrap">
                        {item.isBaselineReference
                          ? 'Baseline'
                          : item.rank !== null
                            ? `#${item.rank}`
                            : '—'}
                      </td>
                      <td className="max-w-[170px] px-2 py-2.5">
                        <span className="font-semibold text-[#18231E]">
                          {item.label}
                        </span>
                        <span className="block text-[10px] text-[#737D76]">
                          {item.cropName}
                          {item.missingWeightPct > 0 &&
                            ` · ${item.missingWeightPct}% unavail.`}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono font-bold tabular-nums text-[#174C3C] whitespace-nowrap">
                        {item.weightedScore !== null
                          ? `${item.weightedScore.toFixed(1)}`
                          : 'Insuff.'}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono tabular-nums text-[#18231E] whitespace-nowrap">
                        {item.overallCropSuitability !== null
                          ? `${item.overallCropSuitability}`
                          : '—'}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono tabular-nums text-[#4B5B51]">
                        {clim?.rawScore !== null && clim?.rawScore !== undefined ? (
                          <>
                            <span>{clim.rawScore}</span>
                            <span className="block text-[10px] text-[#737D76]">
                              +{clim.contribution.toFixed(1)}
                            </span>
                          </>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono tabular-nums text-[#4B5B51]">
                        {wat?.rawScore !== null && wat?.rawScore !== undefined ? (
                          <>
                            <span>{wat.rawScore}</span>
                            <span className="block text-[10px] text-[#737D76]">
                              +{wat.contribution.toFixed(1)}
                            </span>
                          </>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono tabular-nums text-[#4B5B51]">
                        {soil?.rawScore !== null && soil?.rawScore !== undefined ? (
                          <>
                            <span>{soil.rawScore}</span>
                            <span className="block text-[10px] text-[#737D76]">
                              +{soil.contribution.toFixed(1)}
                            </span>
                          </>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono tabular-nums text-[#4B5B51]">
                        {item.seasonalSuitabilityScore !== null
                          ? `${item.seasonalSuitabilityScore}`
                          : '—'}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono tabular-nums text-[#4B5B51]">
                        {rot?.rawScore !== null && rot?.rawScore !== undefined ? (
                          <>
                            <span>{rot.rawScore}</span>
                            <span className="block text-[10px] text-[#737D76]">
                              +{rot.contribution.toFixed(1)}
                            </span>
                          </>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono tabular-nums text-[#18231E] whitespace-nowrap">
                        {item.effectiveAvailableWaterMm !== null ? (
                          <>
                            <span>
                              {formatRainfall(item.effectiveAvailableWaterMm, unitSystem)}
                            </span>
                            <span className="block font-sans text-[10px] text-[#737D76]">
                              {(item.effectiveIrrigation ?? '')
                                .replace('Irrigation', '')
                                .trim()}
                            </span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={`px-2 py-2.5 whitespace-nowrap ${getRiskTextClass(item.rainfallStressLevel)}`}>
                        {item.rainfallStressLevel ?? '—'}
                      </td>
                      <td className={`px-2 py-2.5 whitespace-nowrap ${getRiskTextClass(item.heatStressLevel)}`}>
                        {item.heatStressLevel ?? '—'}
                      </td>
                      <td className={`px-2 py-2.5 whitespace-nowrap ${getRiskTextClass(item.overallRiskLevel)}`}>
                        {item.overallRiskLevel ?? '—'}
                      </td>
                      <td className="py-2.5 pr-3 pl-2 whitespace-nowrap text-[#4B5B51]">
                        <span>{item.confidenceLevel}</span>
                        <span className="block font-mono text-[10px] text-[#737D76]">
                          {item.dataCompletenessPct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Decision Sensitivity Analysis */}
      <div
        aria-label="Decision sensitivity analysis"
        className="rounded-2xl bg-[#F7F8F6] p-5"
      >
        <div className="flex flex-col gap-2 border-b border-[#E7EBE7] pb-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-1.5 font-display text-sm font-semibold text-[#18231E]">
              <span>Decision Sensitivity Analysis (Preference Impact)</span>
              <MetricTooltip
                label="Decision Sensitivity"
                description="Compares scenario rankings under your reference weights vs. current weights. Shows how changing decision priorities alters rank order without altering climate observations."
              />
            </h3>
            <p className="mt-0.5 text-[11px] text-[#737D76]">
              {sensitivity.summary}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReferenceWeights({ ...preferences.weights })}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#E7EBE7] bg-white px-3 text-xs font-medium text-[#18231E] hover:bg-[#EAF2EC]"
          >
            <span>Capture Current as Reference</span>
          </button>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl bg-white p-3 text-[11px] text-[#737D76]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#174C3C]" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-[#18231E]">Decision-Preference Analysis Only:</strong> Rank movements below reflect changes in your priority weights relative to the reference weights (
            <span className="font-mono tabular-nums">
              {sensitivity.previousWeights.effectivePct.climate.toFixed(0)}% /{' '}
              {sensitivity.previousWeights.effectivePct.water.toFixed(0)}% /{' '}
              {sensitivity.previousWeights.effectivePct.soil.toFixed(0)}% /{' '}
              {sensitivity.previousWeights.effectivePct.rotation.toFixed(0)}%
            </span>
            ), not changes in actual climate or soil conditions.
          </span>
        </div>

        {sensitivity.scenarioDiffs.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-xl border border-[#E7EBE7] bg-white">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#E7EBE7] bg-[#F7F8F6] text-[#737D76]">
                  <th className="px-3 py-2.5 font-medium">Scenario</th>
                  <th className="px-3 py-2.5 text-center font-medium">Previous Rank</th>
                  <th className="px-3 py-2.5 text-center font-medium">New Rank</th>
                  <th className="px-3 py-2.5 text-right font-medium">Score Change</th>
                  <th className="px-3 py-2.5 font-medium">Categories Responsible for Shift</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7EBE7]">
                {sensitivity.scenarioDiffs.map((diff) => (
                  <tr key={diff.id}>
                    <td className="px-3 py-2.5 font-semibold text-[#18231E]">
                      {diff.label}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono tabular-nums text-[#737D76]">
                      {diff.previousRank !== null ? `#${diff.previousRank}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono font-bold tabular-nums text-[#18231E]">
                      <span className="inline-flex items-center gap-1">
                        <span>{diff.currentRank !== null ? `#${diff.currentRank}` : '—'}</span>
                        {diff.rankDelta !== null && diff.rankDelta > 0 && (
                          <span className="inline-flex items-center text-[11px] text-[#174C3C]">
                            <ArrowUp className="h-3 w-3" aria-hidden="true" />
                            +{diff.rankDelta}
                          </span>
                        )}
                        {diff.rankDelta !== null && diff.rankDelta < 0 && (
                          <span className="inline-flex items-center text-[11px] text-[#B91C1C]">
                            <ArrowDown className="h-3 w-3" aria-hidden="true" />
                            {diff.rankDelta}
                          </span>
                        )}
                        {diff.rankDelta === 0 && (
                          <Minus className="h-3 w-3 text-[#737D76]" aria-hidden="true" />
                        )}
                      </span>
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono font-semibold tabular-nums ${
                        (diff.scoreDelta ?? 0) > 0
                          ? 'text-[#174C3C]'
                          : (diff.scoreDelta ?? 0) < 0
                            ? 'text-[#B91C1C]'
                            : 'text-[#737D76]'
                      }`}
                    >
                      {diff.scoreDelta !== null
                        ? `${diff.previousScore?.toFixed(1)} → ${diff.currentScore?.toFixed(1)} (${diff.scoreDelta >= 0 ? `+${diff.scoreDelta.toFixed(1)}` : diff.scoreDelta.toFixed(1)} pts)`
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-[#4B5B51]">
                      {diff.responsibleCategories.length === 0 ? (
                        <span>Unchanged from reference weights</span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          {diff.responsibleCategories.slice(0, 3).map((cat) => (
                            <span
                              key={cat.id}
                              className="inline-flex items-center gap-1 font-mono tabular-nums"
                            >
                              <span className="font-sans font-medium text-[#18231E]">
                                {cat.label}:
                              </span>
                              <span
                                className={
                                  cat.contributionDelta >= 0
                                    ? 'text-[#174C3C]'
                                    : 'text-[#B91C1C]'
                                }
                              >
                                {cat.contributionDelta >= 0
                                  ? `+${cat.contributionDelta.toFixed(1)}`
                                  : cat.contributionDelta.toFixed(1)}{' '}
                                pts
                              </span>
                              <span className="text-[#737D76]">
                                <ArrowRight className="inline h-2.5 w-2.5" aria-hidden="true" />{' '}
                                {cat.weightDeltaPct >= 0
                                  ? `+${cat.weightDeltaPct.toFixed(1)}`
                                  : cat.weightDeltaPct.toFixed(1)}
                                % wt
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
