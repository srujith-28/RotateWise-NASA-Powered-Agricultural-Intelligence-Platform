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

const COMPARE_COLORS = ['#174C3C', '#287A5A', '#B45309'];

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
      className="rounded-2xl border border-[#E7EBE7] bg-white p-5 sm:p-6"
    >
      <div className="flex flex-col gap-2 border-b border-[#E7EBE7] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-[-0.015em] text-[#18231E]">
            <Layers className="h-4 w-4 text-[#174C3C]" aria-hidden="true" />
            <span>Saved Scenarios &amp; Side-by-Side Comparison ({entries.length}/{MAX_COMPARISON_SCENARIOS})</span>
          </h2>
          <p className="mt-0.5 text-xs text-[#737D76]">
            Load, rename, duplicate, delete, or compare up to {MAX_COMPARISON_SCENARIOS} hypothetical scenarios for {farm.name}.
          </p>
        </div>
      </div>

      {/* Saved Scenarios List */}
      <div className="mt-4 grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {scenarios.map((scen) => {
          const isLoaded = activeScenarioId === scen.id;
          const compIdx = comparedScenarioIds.indexOf(scen.id);
          const isCompared = compIdx !== -1;
          const disableAddCompare =
            !isCompared && comparedScenarioIds.length >= MAX_COMPARISON_SCENARIOS;

          return (
            <div
              key={scen.id}
              className={`flex flex-col justify-between rounded-xl p-4 transition-colors ${
                isLoaded
                  ? 'bg-[#EAF2EC] ring-1 ring-[#174C3C]/30'
                  : 'bg-[#F7F8F6]'
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
                      className="h-8 min-w-0 flex-1 rounded-lg border border-[#174C3C] bg-white px-2.5 text-xs text-[#18231E]"
                    />
                    <button
                      type="submit"
                      aria-label="Confirm scenario rename"
                      className="h-8 rounded-lg bg-[#174C3C] px-2.5 text-xs font-semibold text-white"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingId(null)}
                      className="h-8 rounded-lg border border-[#E7EBE7] bg-white px-2 text-xs text-[#737D76]"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onLoadScenario(scen)}
                      className="text-left text-xs font-semibold text-[#18231E] hover:text-[#174C3C] hover:underline"
                    >
                      {scen.name}
                    </button>
                    {isLoaded && (
                      <span className="shrink-0 text-[11px] font-semibold text-[#174C3C]">
                        Loaded
                      </span>
                    )}
                  </div>
                )}

                <p className="mt-1.5 font-mono text-[11px] tabular-nums text-[#4B5B51]">
                  Rain: {scen.config.rainfallDeltaPct >= 0 ? `+${scen.config.rainfallDeltaPct}` : scen.config.rainfallDeltaPct}% · Temp:{' '}
                  {scen.config.temperatureShiftC >= 0 ? `+${scen.config.temperatureShiftC}` : scen.config.temperatureShiftC}°C
                </p>
                <p className="text-[11px] text-[#737D76]">
                  {IRRIGATION_MODE_LABELS[scen.config.irrigationMode]} · Crop:{' '}
                  {CROP_KNOWLEDGE_DATABASE.find((c) => c.id === scen.config.primaryCropId)?.name ??
                    scen.config.primaryCropId.replace(/_/g, ' ')}
                </p>
              </div>

              <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-black/8 pt-3">
                <button
                  type="button"
                  onClick={() => onLoadScenario(scen)}
                  className="inline-flex h-8 items-center rounded-lg border border-[#E7EBE7] bg-white px-2.5 text-[11px] font-medium text-[#18231E] hover:bg-[#EAF2EC]"
                >
                  Load
                </button>
                <button
                  type="button"
                  disabled={disableAddCompare}
                  onClick={() => onToggleCompareScenario(scen.id)}
                  className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-medium transition-colors ${
                    isCompared
                      ? 'bg-[#174C3C] text-white'
                      : 'border border-[#E7EBE7] bg-white text-[#18231E] hover:bg-[#EAF2EC] disabled:opacity-45'
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
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E7EBE7] bg-white text-[#737D76] hover:bg-white hover:text-[#18231E]"
                >
                  <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicateScenario(scen.id)}
                  aria-label={`Duplicate ${scen.name}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E7EBE7] bg-white text-[#737D76] hover:bg-white hover:text-[#18231E]"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                {scenarios.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteScenario(scen.id)}
                    aria-label={`Delete ${scen.name}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#EBD2D2] bg-white text-[#B91C1C] hover:bg-[#FEF2F2]"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Multi-Scenario Comparison Chart & Table */}
      {entries.length > 0 && (
        <div className="mt-6 space-y-5 border-t border-[#E7EBE7] pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#18231E]">
              Comparing ({entries.length}/{MAX_COMPARISON_SCENARIOS}):
            </span>
            {entries.map((entry, idx) => (
              <button
                key={entry.scenario.id}
                type="button"
                onClick={() => onToggleCompareScenario(entry.scenario.id)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#F7F8F6] px-2.5 text-xs font-medium text-[#18231E] transition-colors hover:bg-[#FEE2E2]"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: COMPARE_COLORS[idx % COMPARE_COLORS.length],
                  }}
                  aria-hidden="true"
                />
                <span>{entry.scenario.name}</span>
                <X className="h-3 w-3 text-[#737D76]" aria-hidden="true" />
              </button>
            ))}
          </div>

          {entries.every((e) => e.result.status === 'ready') ? (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="#EEF1EE" vertical={false} />
                    <XAxis dataKey="metric" tick={{ fontSize: 11, fill: '#737D76' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#737D76' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(val) => [`${val ?? 0}/100`]}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #E7EBE7', fontSize: '12px' }}
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

              <div className="overflow-x-auto rounded-xl border border-[#E7EBE7]">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E7EBE7] bg-[#F7F8F6] text-[#737D76]">
                      <th className="min-w-[155px] px-4 py-3 font-medium">Scenario Attribute</th>
                      {entries.map((e) => (
                        <th key={e.scenario.id} className="min-w-[190px] px-4 py-3 font-semibold text-[#18231E]">
                          {e.scenario.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7EBE7]">
                    <tr>
                      <td className="px-4 py-2.5 font-medium text-[#737D76]">Perturbations</td>
                      {entries.map((e) => (
                        <td key={e.scenario.id} className="px-4 py-2.5 font-mono tabular-nums text-[#18231E]">
                          Rain {e.scenario.config.rainfallDeltaPct >= 0 ? `+${e.scenario.config.rainfallDeltaPct}` : e.scenario.config.rainfallDeltaPct}% · Temp{' '}
                          {e.scenario.config.temperatureShiftC >= 0 ? `+${e.scenario.config.temperatureShiftC}` : e.scenario.config.temperatureShiftC}°C
                          <span className="block font-sans text-[11px] text-[#737D76]">
                            {IRRIGATION_MODE_LABELS[e.scenario.config.irrigationMode]}
                          </span>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-medium text-[#737D76]">Simulated Mean Temp &amp; Rain</td>
                      {entries.map((e) => (
                        <td key={e.scenario.id} className="px-4 py-2.5 font-mono tabular-nums text-[#18231E]">
                          {e.result.simulatedClimate
                            ? `${formatTemp(e.result.simulatedClimate.meanTempC, unitSystem)} · ${formatRainfall(e.result.simulatedClimate.totalRainfallMm, unitSystem)}`
                            : 'Unavailable'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-medium text-[#737D76]">Primary Crop Suitability</td>
                      {entries.map((e) => {
                        const baseScore = e.result.primaryBaselineEval?.overallScore ?? 0;
                        const simScore = e.result.primarySimulatedEval?.overallScore ?? 0;
                        const delta = simScore - baseScore;
                        return (
                          <td key={e.scenario.id} className="px-4 py-2.5 text-[#18231E]">
                            <span className="font-mono font-bold tabular-nums text-[#174C3C]">
                              {e.result.primarySimulatedEval?.crop.name}: {simScore}/100
                            </span>
                            <span className="block font-mono text-[11px] text-[#737D76]">
                              Baseline {baseScore} ({delta >= 0 ? `+${delta}` : delta} pts)
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-medium text-[#737D76]">Peak Risk Level</td>
                      {entries.map((e) => (
                        <td key={e.scenario.id} className="px-4 py-2.5 font-semibold text-[#18231E]">
                          {e.result.highestRiskLevel}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-xs text-[#9A5B00]">
              Retrieve NASA POWER baseline climate observations above to compare saved scenarios quantitatively.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
