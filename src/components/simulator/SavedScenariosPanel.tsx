import {
  Copy,
  Edit3,
  GitCompareArrows,
  Layers,
  Trash2,
  X,
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
import { CROP_KNOWLEDGE_DATABASE } from '../../data/cropKnowledgeDb';
import { formatRainfall, formatTemp } from '../../lib/agronomy';
import {
  compareSavedScenarios,
  IRRIGATION_MODE_LABELS,
  MAX_COMPARISON_SCENARIOS,
} from '../../lib/scenarioSimulationEngine';
import type {
  Farm,
  NasaPowerClimateDataset,
  SavedClimateScenario,
} from '../../types/rotatewise';

interface SavedScenariosPanelProps {
  farm: Farm;
  nasaData: NasaPowerClimateDataset | null;
  scenarios: SavedClimateScenario[];
  activeScenarioId: string | null;
  comparedScenarioIds: string[];
  unitSystem: 'imperial' | 'metric';
  onLoadScenario: (scenario: SavedClimateScenario) => void;
  onRenameScenario: (scenarioId: string, newName: string) => void;
  onDuplicateScenario: (scenarioId: string) => void;
  onDeleteScenario: (scenarioId: string) => void;
  onToggleCompareScenario: (scenarioId: string) => void;
}

const COMPARE_COLORS = ['#154734', '#2E8B57', '#C27803'];

export function SavedScenariosPanel({
  farm,
  nasaData,
  scenarios,
  activeScenarioId,
  comparedScenarioIds,
  unitSystem,
  onLoadScenario,
  onRenameScenario,
  onDuplicateScenario,
  onDeleteScenario,
  onToggleCompareScenario,
}: SavedScenariosPanelProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const comparison = compareSavedScenarios(
    scenarios,
    comparedScenarioIds,
    farm,
    nasaData
  );
  const { entries, chartData } = comparison;

  const handleConfirmRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingId || !renameDraft.trim()) return;
    onRenameScenario(renamingId, renameDraft.trim());
    setRenamingId(null);
    setRenameDraft('');
  };

  return (
    <section
      aria-label="Saved scenarios and multi-scenario comparison"
      className="rounded-xl border border-[#E4E2DA] bg-white p-5 shadow-[0_1px_2px_rgba(18,43,29,0.03)]"
    >
      <div className="flex flex-col gap-2 border-b border-[#ECEAE3] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-[#14221A]">
            <Layers className="h-4 w-4 text-[#154734]" aria-hidden="true" />
            <span>Saved Scenarios &amp; Side-by-Side Comparison ({entries.length}/{MAX_COMPARISON_SCENARIOS})</span>
          </h2>
          <p className="mt-0.5 text-xs text-[#6B7970]">
            Load, rename, duplicate, delete, or compare up to {MAX_COMPARISON_SCENARIOS} hypothetical scenarios for {farm.name}.
          </p>
        </div>
      </div>

      {/* Saved Scenarios List */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {scenarios.map((scen) => {
          const isLoaded = activeScenarioId === scen.id;
          const compIdx = comparedScenarioIds.indexOf(scen.id);
          const isCompared = compIdx !== -1;
          const disableAddCompare =
            !isCompared && comparedScenarioIds.length >= MAX_COMPARISON_SCENARIOS;

          return (
            <div
              key={scen.id}
              className={`flex flex-col justify-between rounded-lg border p-3.5 transition-colors ${
                isLoaded
                  ? 'border-[#154734] bg-[#F5FAF7]'
                  : 'border-[#E4E2DA] bg-[#FAFAF7]'
              }`}
            >
              <div>
                {renamingId === scen.id ? (
                  <form onSubmit={handleConfirmRename} className="flex items-center gap-1.5">
                    <label htmlFor={`rename-scen-${scen.id}`} className="sr-only">
                      Rename scenario
                    </label>
                    <input
                      id={`rename-scen-${scen.id}`}
                      type="text"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      className="h-8 min-w-0 flex-1 rounded border border-[#154734] bg-white px-2 text-xs text-[#14221A]"
                    />
                    <button
                      type="submit"
                      aria-label="Confirm scenario rename"
                      className="h-8 rounded bg-[#154734] px-2.5 text-xs font-semibold text-white"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingId(null)}
                      className="h-8 rounded border border-[#D8D5CB] bg-white px-2 text-xs text-[#4B5B51]"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onLoadScenario(scen)}
                      className="text-left text-xs font-bold text-[#14221A] hover:text-[#154734] hover:underline"
                    >
                      {scen.name}
                    </button>
                    {isLoaded && (
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#154734]">
                        Loaded
                      </span>
                    )}
                  </div>
                )}

                <p className="mt-1 font-mono text-[11px] tabular-nums text-[#4B5B51]">
                  Rain: {scen.config.rainfallDeltaPct >= 0 ? `+${scen.config.rainfallDeltaPct}` : scen.config.rainfallDeltaPct}% · Temp:{' '}
                  {scen.config.temperatureShiftC >= 0 ? `+${scen.config.temperatureShiftC}` : scen.config.temperatureShiftC}°C
                </p>
                <p className="text-[11px] text-[#65736B]">
                  {IRRIGATION_MODE_LABELS[scen.config.irrigationMode]} · Crop:{' '}
                  {CROP_KNOWLEDGE_DATABASE.find((c) => c.id === scen.config.primaryCropId)?.name ??
                    scen.config.primaryCropId.replace(/_/g, ' ')}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[#ECEAE3] pt-2.5">
                <button
                  type="button"
                  onClick={() => onLoadScenario(scen)}
                  className="inline-flex h-7 items-center rounded border border-[#D8D5CB] bg-white px-2 text-[11px] font-medium text-[#14221A] hover:bg-[#F2F6F3]"
                >
                  Load
                </button>
                <button
                  type="button"
                  disabled={disableAddCompare}
                  onClick={() => onToggleCompareScenario(scen.id)}
                  className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-[11px] font-medium ${
                    isCompared
                      ? 'border-[#154734] bg-[#154734] text-white'
                      : 'border-[#D8D5CB] bg-white text-[#14221A] hover:bg-[#F2F6F3] disabled:opacity-45'
                  }`}
                >
                  <GitCompareArrows className="h-3 w-3" aria-hidden="true" />
                  <span>{isCompared ? 'Comparing' : 'Compare'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRenamingId(scen.id);
                    setRenameDraft(scen.name);
                  }}
                  aria-label={`Rename ${scen.name}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#D8D5CB] bg-white text-[#4B5B51] hover:bg-[#F6F5F0]"
                >
                  <Edit3 className="h-3 w-3" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicateScenario(scen.id)}
                  aria-label={`Duplicate ${scen.name}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#D8D5CB] bg-white text-[#4B5B51] hover:bg-[#F6F5F0]"
                >
                  <Copy className="h-3 w-3" aria-hidden="true" />
                </button>
                {scenarios.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteScenario(scen.id)}
                    aria-label={`Delete ${scen.name}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#E5C5C5] bg-white text-[#B91C1C] hover:bg-[#FEF2F2]"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Multi-Scenario Comparison Chart & Table */}
      {entries.length > 0 && (
        <div className="mt-6 space-y-5 border-t border-[#ECEAE3] pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#14221A]">
              Comparing ({entries.length}/{MAX_COMPARISON_SCENARIOS}):
            </span>
            {entries.map((entry, idx) => (
              <button
                key={entry.scenario.id}
                type="button"
                onClick={() => onToggleCompareScenario(entry.scenario.id)}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#D8D5CB] bg-[#FAFAF7] px-2.5 text-xs font-medium text-[#14221A] hover:bg-[#FEE2E2]"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: COMPARE_COLORS[idx % COMPARE_COLORS.length],
                  }}
                  aria-hidden="true"
                />
                <span>{entry.scenario.name}</span>
                <X className="h-3 w-3 text-[#6B7970]" aria-hidden="true" />
              </button>
            ))}
          </div>

          {entries.every((e) => e.result.status === 'ready') ? (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ECEAE3" vertical={false} />
                    <XAxis dataKey="metric" tick={{ fontSize: 11, fill: '#5F6E65' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#5F6E65' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(val) => [`${val ?? 0}/100`]}
                      contentStyle={{ borderRadius: '10px', border: '1px solid #E4E2DA', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    {entries.map((entry, idx) => (
                      <Bar
                        key={entry.scenario.id}
                        dataKey={entry.scenario.id}
                        name={entry.scenario.name}
                        fill={COMPARE_COLORS[idx % COMPARE_COLORS.length]}
                        radius={[4, 4, 0, 0]}
                        isAnimationActive={false}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto rounded-lg border border-[#ECEAE3]">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#ECEAE3] bg-[#FAFAF7] text-[#6B7970]">
                      <th className="min-w-[155px] px-4 py-3 font-medium">Scenario Attribute</th>
                      {entries.map((e) => (
                        <th key={e.scenario.id} className="min-w-[190px] px-4 py-3 font-semibold text-[#14221A]">
                          {e.scenario.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECEAE3]">
                    <tr>
                      <td className="px-4 py-2.5 font-medium text-[#4B5B51]">Perturbations</td>
                      {entries.map((e) => (
                        <td key={e.scenario.id} className="px-4 py-2.5 font-mono tabular-nums text-[#14221A]">
                          Rain {e.scenario.config.rainfallDeltaPct >= 0 ? `+${e.scenario.config.rainfallDeltaPct}` : e.scenario.config.rainfallDeltaPct}% · Temp{' '}
                          {e.scenario.config.temperatureShiftC >= 0 ? `+${e.scenario.config.temperatureShiftC}` : e.scenario.config.temperatureShiftC}°C
                          <span className="block font-sans text-[11px] text-[#6B7970]">
                            {IRRIGATION_MODE_LABELS[e.scenario.config.irrigationMode]}
                          </span>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-medium text-[#4B5B51]">Simulated Mean Temp &amp; Rain</td>
                      {entries.map((e) => (
                        <td key={e.scenario.id} className="px-4 py-2.5 font-mono tabular-nums text-[#14221A]">
                          {e.result.simulatedClimate
                            ? `${formatTemp(e.result.simulatedClimate.meanTempC, unitSystem)} · ${formatRainfall(e.result.simulatedClimate.totalRainfallMm, unitSystem)}`
                            : 'Unavailable'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-medium text-[#4B5B51]">Primary Crop Suitability</td>
                      {entries.map((e) => {
                        const baseScore = e.result.primaryBaselineEval?.overallScore ?? 0;
                        const simScore = e.result.primarySimulatedEval?.overallScore ?? 0;
                        const delta = simScore - baseScore;
                        return (
                          <td key={e.scenario.id} className="px-4 py-2.5 text-[#14221A]">
                            <span className="font-mono font-bold tabular-nums text-[#154734]">
                              {e.result.primarySimulatedEval?.crop.name}: {simScore}/100
                            </span>
                            <span className="block font-mono text-[11px] text-[#6B7970]">
                              Baseline {baseScore} ({delta >= 0 ? `+${delta}` : delta} pts)
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-medium text-[#4B5B51]">Peak Risk Level</td>
                      {entries.map((e) => (
                        <td key={e.scenario.id} className="px-4 py-2.5 font-semibold text-[#14221A]">
                          {e.result.highestRiskLevel}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-xs text-[#92400E]">
              Retrieve NASA POWER baseline climate observations above to compare saved scenarios quantitatively.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
