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

const COMPARE_COLORS = ['#154734', '#2E8B57', '#C27803'];

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
      className="rounded-xl border border-[#E4E2DA] bg-white p-5 shadow-[0_1px_2px_rgba(18,43,29,0.03)]"
    >
      <div className="flex flex-col gap-3 border-b border-[#ECEAE3] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-[#14221A]">
            <GitCompareArrows className="h-4 w-4 text-[#154734]" aria-hidden="true" />
            <span>Compare Rotation Plans ({entries.length}/{MAX_COMPARISON_PLANS})</span>
          </h2>
          <p className="mt-0.5 text-xs text-[#6B7970]">
            Select up to {MAX_COMPARISON_PLANS} saved plans for {farm.name} to compare rotation scores, family diversity, nutrients, pest breaks, seasonal fit, water requirements, and risks.
          </p>
        </div>

        {plans.length < 2 && (
          <button
            type="button"
            onClick={onDuplicateActivePlan}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#D8D5CB] bg-[#FAFAF7] px-3 text-xs font-semibold text-[#154734] hover:bg-[#F2F8F4]"
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
              className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                isSelected
                  ? 'border-[#154734] bg-[#F2F8F4] text-[#154734]'
                  : 'border-[#D8D5CB] bg-[#FAFAF7] text-[#4B5B51] hover:bg-white disabled:cursor-not-allowed disabled:opacity-45'
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
        <div className="py-10 text-center text-xs text-[#6B7970]">
          Select 1 to {MAX_COMPARISON_PLANS} saved plans above to inspect side-by-side metrics.
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {/* Grouped Recharts BarChart */}
          <div>
            <p className="text-xs font-semibold text-[#14221A]">
              Category &amp; Overall Score Comparison (0–100)
            </p>
            <div className="mt-3 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECEAE3" vertical={false} />
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
                  {entries.map((entry, idx) => (
                    <Bar
                      key={entry.plan.id}
                      dataKey={entry.plan.id}
                      name={entry.plan.name}
                      fill={COMPARE_COLORS[idx % COMPARE_COLORS.length]}
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Side-by-Side Comparison Matrix */}
          <div className="overflow-x-auto rounded-lg border border-[#ECEAE3]">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#ECEAE3] bg-[#FAFAF7] text-[#6B7970]">
                  <th className="min-w-[175px] px-4 py-3 font-medium">Comparison Dimension</th>
                  {entries.map((entry) => (
                    <th key={entry.plan.id} className="min-w-[200px] px-4 py-3 font-semibold text-[#14221A]">
                      {entry.plan.name}
                      <span className="block text-[11px] font-normal text-[#6B7970]">
                        {entry.plan.steps.length} stages · {entry.plan.periodMode}
                        {entry.plan.isPrimary ? ' · Active on Farm' : ''}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEAE3]">
                <tr>
                  <td className="px-4 py-2.5 font-medium text-[#4B5B51]">Overall Rotation Score</td>
                  {entries.map((entry) => (
                    <td key={entry.plan.id} className="px-4 py-2.5 font-mono font-bold tabular-nums text-[#154734]">
                      {entry.evaluation.overallScore}/100 ({entry.evaluation.scoreLabel})
                      <span className="block font-sans text-[11px] font-normal text-[#6B7970]">
                        Confidence: {entry.evaluation.confidenceLevel}
                      </span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-[#4B5B51]">Crop-Family Diversity</td>
                  {entries.map((entry) => {
                    const cat = entry.evaluation.categories.find((c) => c.id === 'family_diversity');
                    return (
                      <td key={entry.plan.id} className="px-4 py-2.5 text-[#14221A]">
                        <span className="font-mono font-semibold tabular-nums">
                          {cat?.score ?? 0}/100 (+{cat?.contribution ?? 0}/{cat?.weight ?? 25})
                        </span>
                        <span className="block text-[11px] text-[#6B7970]">
                          {entry.evaluation.uniqueFamilies.length} families: {entry.evaluation.uniqueFamilies.join(', ') || 'None'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-[#4B5B51]">Nutrient Management</td>
                  {entries.map((entry) => {
                    const cat = entry.evaluation.categories.find((c) => c.id === 'nutrient_management');
                    return (
                      <td key={entry.plan.id} className="px-4 py-2.5 text-[#14221A]">
                        <span className="font-mono font-semibold tabular-nums">
                          {cat?.score ?? 0}/100 (+{cat?.contribution ?? 0}/{cat?.weight ?? 20})
                        </span>
                        <span className="block font-mono text-[11px] text-[#6B7970]">
                          Net N: {entry.evaluation.netNitrogenKgHa >= 0 ? `+${entry.evaluation.netNitrogenKgHa}` : entry.evaluation.netNitrogenKgHa} kg/ha
                        </span>
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-[#4B5B51]">Pest &amp; Disease Break</td>
                  {entries.map((entry) => {
                    const cat = entry.evaluation.categories.find((c) => c.id === 'pest_break');
                    return (
                      <td key={entry.plan.id} className="px-4 py-2.5 text-[#14221A]">
                        <span className="font-mono font-semibold tabular-nums">
                          {cat?.score ?? 0}/100 (+{cat?.contribution ?? 0}/{cat?.weight ?? 20})
                        </span>
                        <span className="block text-[11px] text-[#6B7970]">{cat?.detail}</span>
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-[#4B5B51]">Seasonal &amp; Climate Fit</td>
                  {entries.map((entry) => {
                    const cat = entry.evaluation.categories.find((c) => c.id === 'seasonal_climate');
                    return (
                      <td key={entry.plan.id} className="px-4 py-2.5 text-[#14221A]">
                        <span className="font-mono font-semibold tabular-nums">
                          {cat?.score ?? 0}/100 (+{cat?.contribution ?? 0}/{cat?.weight ?? 20})
                        </span>
                        <span className="block text-[11px] text-[#6B7970]">{cat?.detail}</span>
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-[#4B5B51]">Water Requirements</td>
                  {entries.map((entry) => (
                    <td key={entry.plan.id} className="px-4 py-2.5 font-mono tabular-nums text-[#14221A]">
                      {formatRainfall(entry.evaluation.totalWaterNeedMm[0], unitSystem)} –{' '}
                      {formatRainfall(entry.evaluation.totalWaterNeedMm[1], unitSystem)}
                      <span className="block font-sans text-[11px] text-[#6B7970]">
                        Cumulative across {entry.plan.steps.length} stage(s)
                      </span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-[#4B5B51]">Identified Agronomic Risks</td>
                  {entries.map((entry) => (
                    <td key={entry.plan.id} className="px-4 py-2.5 text-[#4B5B51]">
                      {entry.evaluation.identifiedRisks.length === 0 ? (
                        <span className="font-medium text-[#154734]">No conflicts flagged</span>
                      ) : (
                        <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-[#92400E]">
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
