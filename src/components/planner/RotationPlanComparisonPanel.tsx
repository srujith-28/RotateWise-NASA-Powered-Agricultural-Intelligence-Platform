import { GitCompareArrows, Plus, X } from 'lucide-react';
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
  compareRotationPlans,
  MAX_COMPARISON_PLANS,
} from '../../lib/rotationPlannerEngine';
import type {
  Farm,
  NasaPowerClimateDataset,
  SavedRotationPlan,
} from '../../types/rotatewise';

interface RotationPlanComparisonPanelProps {
  plans: SavedRotationPlan[];
  selectedPlanIds: string[];
  farm: Farm;
  nasaData: NasaPowerClimateDataset | null;
  unitSystem: 'imperial' | 'metric';
  onTogglePlanComparison: (planId: string) => void;
  onDuplicateActivePlan: () => void;
}

const COMPARE_COLORS = ['#174C3C', '#287A5A', '#B45309'];

export function RotationPlanComparisonPanel({
  plans,
  selectedPlanIds,
  farm,
  nasaData,
  unitSystem,
  onTogglePlanComparison,
  onDuplicateActivePlan,
}: RotationPlanComparisonPanelProps) {
  const comparison = compareRotationPlans(plans, selectedPlanIds, farm, nasaData);
  const { entries, chartData } = comparison;

  return (
    <section
      aria-label="Side-by-side rotation plan comparison"
      className="rounded-2xl border border-[#E7EBE7] bg-white p-5 sm:p-6"
    >
      <div className="flex flex-col gap-3 border-b border-[#E7EBE7] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-[17px] font-semibold tracking-[-0.015em] text-[#18231E]">
            <GitCompareArrows className="h-4 w-4 text-[#174C3C]" aria-hidden="true" />
            <span>Compare Rotation Plans ({entries.length}/{MAX_COMPARISON_PLANS})</span>
          </h2>
          <p className="mt-1 text-xs text-[#737D76]">
            Select up to {MAX_COMPARISON_PLANS} saved plans for {farm.name} to compare rotation scores, family diversity, nutrients, pest breaks, seasonal fit, water requirements, and risks.
          </p>
        </div>

        {plans.length < 2 && (
          <button
            type="button"
            onClick={onDuplicateActivePlan}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E7EBE7] bg-[#F7F8F6] px-3 text-xs font-semibold text-[#174C3C] transition-colors hover:bg-[#EAF2EC]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Duplicate Plan to Compare</span>
          </button>
        )}
      </div>

      {/* Plan Selection Strip */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {plans.map((plan) => {
          const idx = selectedPlanIds.indexOf(plan.id);
          const isSelected = idx !== -1;
          const disableAdd = !isSelected && selectedPlanIds.length >= MAX_COMPARISON_PLANS;

          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onTogglePlanComparison(plan.id)}
              disabled={disableAdd}
              className={`inline-flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${
                isSelected
                  ? 'border-[#174C3C] bg-[#EAF2EC]/70 text-[#174C3C]'
                  : 'border-[#E7EBE7] bg-[#F7F8F6] text-[#737D76] hover:bg-white hover:text-[#18231E] disabled:cursor-not-allowed disabled:opacity-45'
              }`}
            >
              {isSelected && (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: COMPARE_COLORS[idx % COMPARE_COLORS.length] }}
                  aria-hidden="true"
                />
              )}
              <span>
                {plan.name} ({plan.steps.length} stages)
              </span>
              {isSelected && <X className="h-3 w-3" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {entries.length === 0 ? (
        <div className="py-10 text-center text-xs text-[#737D76]">
          Select 1 to {MAX_COMPARISON_PLANS} saved plans above to inspect side-by-side metrics.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div>
            <p className="text-xs font-semibold text-[#18231E]">
              Category &amp; Overall Score Comparison (0–100)
            </p>
            <div className="mt-3 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 12, left: -14, bottom: 0 }}>
                  <CartesianGrid stroke="#EEF1EE" vertical={false} />
                  <XAxis
                    dataKey="metric"
                    tick={{ fontSize: 11, fill: '#737D76' }}
                    axisLine={false}
                    tickLine={false}
                    dy={6}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: '#737D76' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value) => [`${value ?? 0}/100`]}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #E7EBE7',
                      boxShadow: '0 10px 26px rgba(20, 37, 29, 0.10)',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  {entries.map((entry, idx) => (
                    <Bar
                      key={entry.plan.id}
                      dataKey={entry.plan.id}
                      name={entry.plan.name}
                      fill={COMPARE_COLORS[idx % COMPARE_COLORS.length]}
                      radius={[5, 5, 0, 0]}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#E7EBE7]">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#E7EBE7] bg-[#F7F8F6] text-[#737D76]">
                  <th className="min-w-[175px] px-4 py-3 font-medium">Comparison Dimension</th>
                  {entries.map((entry) => (
                    <th key={entry.plan.id} className="min-w-[200px] px-4 py-3 font-semibold text-[#18231E]">
                      {entry.plan.name}
                      <span className="block text-[11px] font-normal text-[#737D76]">
                        {entry.plan.steps.length} stages · {entry.plan.periodMode}
                        {entry.plan.isPrimary ? ' · Active on Farm' : ''}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7EBE7]">
                <tr>
                  <td className="px-4 py-2.5 font-medium text-[#445149]">Overall Rotation Score</td>
                  {entries.map((entry) => (
                    <td key={entry.plan.id} className="px-4 py-2.5 font-mono font-semibold tabular-nums text-[#174C3C]">
                      {entry.evaluation.overallScore}/100 ({entry.evaluation.scoreLabel})
                      <span className="block font-sans text-[11px] font-normal text-[#737D76]">
                        Confidence: {entry.evaluation.confidenceLevel}
                      </span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-[#445149]">Crop-Family Diversity</td>
                  {entries.map((entry) => {
                    const cat = entry.evaluation.categories.find((c) => c.id === 'family_diversity');
                    return (
                      <td key={entry.plan.id} className="px-4 py-2.5 text-[#18231E]">
                        <span className="font-mono font-semibold tabular-nums">
                          {cat?.score ?? 0}/100 (+{cat?.contribution ?? 0}/{cat?.weight ?? 25})
                        </span>
                        <span className="block text-[11px] text-[#737D76]">
                          {entry.evaluation.uniqueFamilies.length} families: {entry.evaluation.uniqueFamilies.join(', ') || 'None'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-[#445149]">Nutrient Management</td>
                  {entries.map((entry) => {
                    const cat = entry.evaluation.categories.find((c) => c.id === 'nutrient_management');
                    return (
                      <td key={entry.plan.id} className="px-4 py-2.5 text-[#18231E]">
                        <span className="font-mono font-semibold tabular-nums">
                          {cat?.score ?? 0}/100 (+{cat?.contribution ?? 0}/{cat?.weight ?? 20})
                        </span>
                        <span className="block font-mono text-[11px] text-[#737D76]">
                          Net N: {entry.evaluation.netNitrogenKgHa >= 0 ? `+${entry.evaluation.netNitrogenKgHa}` : entry.evaluation.netNitrogenKgHa} kg/ha
                        </span>
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-[#445149]">Pest &amp; Disease Break</td>
                  {entries.map((entry) => {
                    const cat = entry.evaluation.categories.find((c) => c.id === 'pest_break');
                    return (
                      <td key={entry.plan.id} className="px-4 py-2.5 text-[#18231E]">
                        <span className="font-mono font-semibold tabular-nums">
                          {cat?.score ?? 0}/100 (+{cat?.contribution ?? 0}/{cat?.weight ?? 20})
                        </span>
                        <span className="block text-[11px] text-[#737D76]">{cat?.detail}</span>
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-[#445149]">Seasonal &amp; Climate Fit</td>
                  {entries.map((entry) => {
                    const cat = entry.evaluation.categories.find((c) => c.id === 'seasonal_climate');
                    return (
                      <td key={entry.plan.id} className="px-4 py-2.5 text-[#18231E]">
                        <span className="font-mono font-semibold tabular-nums">
                          {cat?.score ?? 0}/100 (+{cat?.contribution ?? 0}/{cat?.weight ?? 20})
                        </span>
                        <span className="block text-[11px] text-[#737D76]">{cat?.detail}</span>
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-[#445149]">Water Requirements</td>
                  {entries.map((entry) => (
                    <td key={entry.plan.id} className="px-4 py-2.5 font-mono tabular-nums text-[#18231E]">
                      {formatRainfall(entry.evaluation.totalWaterNeedMm[0], unitSystem)} –{' '}
                      {formatRainfall(entry.evaluation.totalWaterNeedMm[1], unitSystem)}
                      <span className="block font-sans text-[11px] text-[#737D76]">
                        Cumulative across {entry.plan.steps.length} stage(s)
                      </span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-[#445149]">Identified Agronomic Risks</td>
                  {entries.map((entry) => (
                    <td key={entry.plan.id} className="px-4 py-2.5 text-[#445149]">
                      {entry.evaluation.identifiedRisks.length === 0 ? (
                        <span className="font-medium text-[#174C3C]">No conflicts flagged</span>
                      ) : (
                        <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-[#9A5B00]">
                          {entry.evaluation.identifiedRisks.slice(0, 4).map((risk) => (
                            <li key={risk}>{risk}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
