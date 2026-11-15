import {
  Check,
  CloudRain,
  Droplets,
  Info,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Thermometer,
} from 'lucide-react';
import { useState } from 'react';
import { CROP_KNOWLEDGE_DATABASE } from '../../data/cropKnowledgeDb';
import {
  IRRIGATION_MODE_LABELS,
  RAINFALL_ADJUSTMENT_OPTIONS,
  resolveKnowledgeCropId,
  TEMPERATURE_SHIFT_OPTIONS,
} from '../../lib/scenarioSimulationEngine';
import type {
  ClimateScenarioConfig,
  Farm,
  ScenarioIrrigationMode,
} from '../../types/rotatewise';

interface ScenarioControlsPanelProps {
  farm: Farm;
  config: ClimateScenarioConfig;
  disabled: boolean;
  onChangeConfig: (next: ClimateScenarioConfig) => void;
  onRestoreBaseline: () => void;
  onSaveAsNewScenario: (name: string) => void;
}

const IRRIGATION_MODES: Array<{
  id: ScenarioIrrigationMode;
  shortLabel: string;
  helper: string;
}> = [
  {
    id: 'current',
    shortLabel: 'Current Irrigation',
    helper: 'Keep parcel default',
  },
  {
    id: 'reduced',
    shortLabel: 'Reduced Irrigation',
    helper: 'Step down 1 delivery tier',
  },
  {
    id: 'improved',
    shortLabel: 'Improved Irrigation',
    helper: 'Upgrade parcel irrigation tier',
  },
  {
    id: 'rainwater_harvesting',
    shortLabel: 'Rainwater Harvesting',
    helper: '+~22% runoff capture (hypothetical)',
  },
];

export function ScenarioControlsPanel({
  farm,
  config,
  disabled,
  onChangeConfig,
  onRestoreBaseline,
  onSaveAsNewScenario,
}: ScenarioControlsPanelProps) {
  const [scenarioNameDraft, setScenarioNameDraft] = useState('');
  const farmKnowledgeCropId = resolveKnowledgeCropId(farm.currentCropId);

  const handleToggleAltCrop = (cropId: string) => {
    if (cropId === config.primaryCropId) return;
    const exists = config.comparedAlternativeCropIds.includes(cropId);
    const nextAlts = exists
      ? config.comparedAlternativeCropIds.filter((id) => id !== cropId)
      : config.comparedAlternativeCropIds.length < 4
        ? [...config.comparedAlternativeCropIds, cropId]
        : config.comparedAlternativeCropIds;
    onChangeConfig({ ...config, comparedAlternativeCropIds: nextAlts });
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rainLabel =
      config.rainfallDeltaPct === 0
        ? '0% Rain'
        : `${config.rainfallDeltaPct > 0 ? `+${config.rainfallDeltaPct}` : config.rainfallDeltaPct}% Rain`;
    const tempLabel =
      config.temperatureShiftC === 0
        ? '0°C'
        : `${config.temperatureShiftC > 0 ? `+${config.temperatureShiftC}` : config.temperatureShiftC}°C`;
    const fallbackName = `${rainLabel}, ${tempLabel} (${IRRIGATION_MODES.find((m) => m.id === config.irrigationMode)?.shortLabel ?? 'Current'})`;
    onSaveAsNewScenario(scenarioNameDraft.trim() || fallbackName);
    setScenarioNameDraft('');
  };

  return (
    <section
      aria-label="Hypothetical climate scenario configuration"
      className="rounded-2xl border border-[#E7EBE7] bg-white p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7EBE7] pb-3.5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-[#174C3C]" aria-hidden="true" />
          <h2 className="font-display text-sm font-semibold tracking-[-0.01em] text-[#18231E] whitespace-nowrap">
            Scenario Configuration
          </h2>
        </div>
        <button
          type="button"
          onClick={onRestoreBaseline}
          className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-[#E7EBE7] bg-white px-2.5 text-xs font-medium text-[#18231E] transition-colors hover:bg-[#F7F8F6]"
        >
          <RotateCcw className="h-3 w-3 text-[#737D76]" aria-hidden="true" />
          <span>Restore Baseline</span>
        </button>
      </div>

      <div className="mt-3.5 flex items-start gap-2 rounded-xl bg-[#F7F8F6] p-3 text-xs text-[#737D76]">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#174C3C]" aria-hidden="true" />
        <span>
          <strong className="font-semibold text-[#18231E]">Hypothetical Stress Test:</strong> Controls adjust historical NASA POWER observations mathematically and do not predict actual future weather.
        </span>
      </div>

      <div className="mt-4 space-y-5">
        {/* Rainfall Scenario Controls */}
        <div>
          <div className="flex items-center justify-between text-xs">
            <label
              htmlFor="scenario-rainfall-slider"
              className="flex items-center gap-1.5 font-semibold text-[#18231E]"
            >
              <CloudRain className="h-3.5 w-3.5 text-[#174C3C]" aria-hidden="true" />
              <span>Rainfall Scenario</span>
            </label>
            <span className="font-mono font-bold tabular-nums text-[#174C3C]">
              {config.rainfallDeltaPct === 0
                ? 'Normal (0%)'
                : config.rainfallDeltaPct > 0
                  ? `+${config.rainfallDeltaPct}%`
                  : `${config.rainfallDeltaPct}%`}
            </span>
          </div>
          <input
            id="scenario-rainfall-slider"
            type="range"
            min={-50}
            max={50}
            step={10}
            disabled={disabled}
            value={config.rainfallDeltaPct}
            onChange={(e) =>
              onChangeConfig({ ...config, rainfallDeltaPct: Number(e.target.value) })
            }
            className="mt-2.5 w-full accent-[#174C3C] disabled:opacity-50"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {RAINFALL_ADJUSTMENT_OPTIONS.map((pct) => {
              const active = config.rainfallDeltaPct === pct;
              return (
                <button
                  key={pct}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChangeConfig({ ...config, rainfallDeltaPct: pct })}
                  className={`rounded-lg px-2 py-1 font-mono text-[11px] font-medium transition-colors ${
                    active
                      ? 'bg-[#174C3C] text-white'
                      : 'bg-[#F7F8F6] text-[#737D76] hover:bg-[#EAF2EC] hover:text-[#18231E]'
                  }`}
                >
                  {pct === 0 ? '0%' : pct > 0 ? `+${pct}%` : `${pct}%`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Temperature Scenario Controls */}
        <div>
          <div className="flex items-center justify-between text-xs">
            <label
              htmlFor="scenario-temp-slider"
              className="flex items-center gap-1.5 font-semibold text-[#18231E]"
            >
              <Thermometer className="h-3.5 w-3.5 text-[#174C3C]" aria-hidden="true" />
              <span>Temperature Shift (°C)</span>
            </label>
            <span className="font-mono font-bold tabular-nums text-[#174C3C]">
              {config.temperatureShiftC === 0
                ? 'Baseline (0°C)'
                : config.temperatureShiftC > 0
                  ? `+${config.temperatureShiftC}°C`
                  : `${config.temperatureShiftC}°C`}
            </span>
          </div>
          <input
            id="scenario-temp-slider"
            type="range"
            min={-2}
            max={4}
            step={1}
            disabled={disabled}
            value={config.temperatureShiftC}
            onChange={(e) =>
              onChangeConfig({ ...config, temperatureShiftC: Number(e.target.value) })
            }
            className="mt-2.5 w-full accent-[#174C3C] disabled:opacity-50"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TEMPERATURE_SHIFT_OPTIONS.map((deg) => {
              const active = config.temperatureShiftC === deg;
              return (
                <button
                  key={deg}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChangeConfig({ ...config, temperatureShiftC: deg })}
                  className={`rounded-lg px-2 py-1 font-mono text-[11px] font-medium transition-colors ${
                    active
                      ? 'bg-[#174C3C] text-white'
                      : 'bg-[#F7F8F6] text-[#737D76] hover:bg-[#EAF2EC] hover:text-[#18231E]'
                  }`}
                >
                  {deg === 0 ? '0°C' : deg > 0 ? `+${deg}°C` : `${deg}°C`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Water & Irrigation Controls */}
        <div>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[#18231E]">
            <Droplets className="h-3.5 w-3.5 text-[#174C3C]" aria-hidden="true" />
            <span>Water &amp; Irrigation Strategy</span>
          </span>
          <p className="mt-0.5 text-[11px] text-[#737D76]">
            Parcel baseline: <strong className="text-[#18231E]">{farm.irrigation}</strong>
          </p>
          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {IRRIGATION_MODES.map((mode) => {
              const active = config.irrigationMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    onChangeConfig({ ...config, irrigationMode: mode.id })
                  }
                  aria-pressed={active}
                  title={IRRIGATION_MODE_LABELS[mode.id]}
                  className={`rounded-xl border p-2.5 text-left transition-colors ${
                    active
                      ? 'border-[#174C3C] bg-[#EAF2EC] text-[#174C3C]'
                      : 'border-[#E7EBE7] bg-[#F7F8F6] text-[#18231E] hover:bg-white'
                  }`}
                >
                  <span className="block text-xs font-semibold">{mode.shortLabel}</span>
                  <span className="block text-[11px] text-[#737D76]">{mode.helper}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Crop Scenario Controls */}
        <div className="space-y-3 border-t border-[#E7EBE7] pt-4">
          <div>
            <label
              htmlFor="scenario-primary-crop"
              className="block text-xs font-semibold text-[#18231E]"
            >
              Primary Crop Evaluated
            </label>
            <select
              id="scenario-primary-crop"
              value={config.primaryCropId}
              onChange={(e) => {
                const nextPrimary = e.target.value;
                onChangeConfig({
                  ...config,
                  primaryCropId: nextPrimary,
                  comparedAlternativeCropIds:
                    config.comparedAlternativeCropIds.filter(
                      (id) => id !== nextPrimary
                    ),
                });
              }}
              className="mt-1.5 h-10 w-full rounded-xl border border-[#E7EBE7] bg-white px-3 text-sm font-medium text-[#18231E] focus:border-[#174C3C] focus:outline-none"
            >
              {CROP_KNOWLEDGE_DATABASE.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.family})
                  {c.id === farmKnowledgeCropId ? ' — Current Farm Crop' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-xs font-semibold text-[#18231E]">
              Compare Alternative Crops Under Scenario (up to 4)
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CROP_KNOWLEDGE_DATABASE.filter(
                (c) => c.id !== config.primaryCropId
              ).map((c) => {
                const selected = config.comparedAlternativeCropIds.includes(c.id);
                const maxReached =
                  !selected && config.comparedAlternativeCropIds.length >= 4;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={maxReached}
                    onClick={() => handleToggleAltCrop(c.id)}
                    className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-medium transition-colors ${
                      selected
                        ? 'bg-[#174C3C] text-white'
                        : 'bg-[#F7F8F6] text-[#737D76] hover:bg-[#EAF2EC] hover:text-[#18231E] disabled:opacity-45'
                    }`}
                  >
                    {selected && <Check className="h-3 w-3" aria-hidden="true" />}
                    <span>{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Save Current Scenario Form */}
        <form
          onSubmit={handleSaveSubmit}
          className="space-y-2 border-t border-[#E7EBE7] pt-4"
        >
          <label
            htmlFor="save-scenario-name"
            className="block text-xs font-semibold text-[#18231E]"
          >
            Save Scenario to {farm.name}
          </label>
          <div className="flex gap-2">
            <input
              id="save-scenario-name"
              type="text"
              value={scenarioNameDraft}
              onChange={(e) => setScenarioNameDraft(e.target.value)}
              placeholder="e.g. Severe Drought -40% +3°C"
              className="h-9 min-w-0 flex-1 rounded-xl border border-[#E7EBE7] bg-[#F7F8F6] px-3 text-xs text-[#18231E] focus:border-[#174C3C] focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#174C3C] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#133F32]"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Save</span>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
