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
      className="rounded-xl border border-[#E4E2DA] bg-white p-5 shadow-[0_1px_2px_rgba(18,43,29,0.03)]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#ECEAE3] pb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-[#154734]" aria-hidden="true" />
          <h2 className="font-display text-base font-bold text-[#14221A]">
            Scenario Configuration
          </h2>
        </div>
        <button
          type="button"
          onClick={onRestoreBaseline}
          className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-[#D8D5CB] bg-[#FAFAF7] px-2.5 text-xs font-medium text-[#14221A] hover:bg-[#F2F6F3]"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          <span>Restore Baseline</span>
        </button>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#E4E2DA] bg-[#FBFBF9] p-2.5 text-[11px] text-[#4B5B51]">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#154734]" aria-hidden="true" />
        <span>
          <strong>Hypothetical Stress Test:</strong> Controls adjust historical NASA POWER observations mathematically and do not predict actual future weather.
        </span>
      </div>

      <div className="mt-4 space-y-5">
        {/* Rainfall Scenario Controls */}
        <div>
          <div className="flex items-center justify-between text-xs">
            <label
              htmlFor="scenario-rainfall-slider"
              className="flex items-center gap-1.5 font-semibold text-[#14221A]"
            >
              <CloudRain className="h-3.5 w-3.5 text-[#154734]" aria-hidden="true" />
              <span>Rainfall Scenario</span>
            </label>
            <span className="font-mono font-bold tabular-nums text-[#154734]">
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
            className="mt-2 w-full accent-[#154734] disabled:opacity-50"
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {RAINFALL_ADJUSTMENT_OPTIONS.map((pct) => {
              const active = config.rainfallDeltaPct === pct;
              return (
                <button
                  key={pct}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChangeConfig({ ...config, rainfallDeltaPct: pct })}
                  className={`rounded px-2 py-1 font-mono text-[11px] font-medium transition-colors ${
                    active
                      ? 'bg-[#154734] text-white'
                      : 'border border-[#E4E2DA] bg-[#FAFAF7] text-[#4B5B51] hover:bg-[#F2F6F3]'
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
              className="flex items-center gap-1.5 font-semibold text-[#14221A]"
            >
              <Thermometer className="h-3.5 w-3.5 text-[#154734]" aria-hidden="true" />
              <span>Temperature Shift (°C)</span>
            </label>
            <span className="font-mono font-bold tabular-nums text-[#154734]">
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
            className="mt-2 w-full accent-[#154734] disabled:opacity-50"
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {TEMPERATURE_SHIFT_OPTIONS.map((deg) => {
              const active = config.temperatureShiftC === deg;
              return (
                <button
                  key={deg}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChangeConfig({ ...config, temperatureShiftC: deg })}
                  className={`rounded px-2 py-1 font-mono text-[11px] font-medium transition-colors ${
                    active
                      ? 'bg-[#154734] text-white'
                      : 'border border-[#E4E2DA] bg-[#FAFAF7] text-[#4B5B51] hover:bg-[#F2F6F3]'
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
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[#14221A]">
            <Droplets className="h-3.5 w-3.5 text-[#154734]" aria-hidden="true" />
            <span>Water &amp; Irrigation Strategy</span>
          </span>
          <p className="mt-0.5 text-[11px] text-[#6B7970]">
            Parcel baseline: <strong>{farm.irrigation}</strong>
          </p>
          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
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
                  className={`rounded-lg border p-2.5 text-left transition-colors ${
                    active
                      ? 'border-[#154734] bg-[#F2F8F4] text-[#154734]'
                      : 'border-[#E4E2DA] bg-[#FAFAF7] text-[#14221A] hover:bg-white'
                  }`}
                >
                  <span className="block text-xs font-semibold">{mode.shortLabel}</span>
                  <span className="block text-[11px] text-[#6B7970]">{mode.helper}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Crop Scenario Controls */}
        <div className="space-y-3 border-t border-[#ECEAE3] pt-4">
          <div>
            <label
              htmlFor="scenario-primary-crop"
              className="block text-xs font-semibold text-[#14221A]"
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
              className="mt-1.5 h-10 w-full rounded-lg border border-[#D8D5CB] bg-white px-3 text-sm font-medium text-[#14221A] focus:border-[#154734] focus:outline-none"
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
            <span className="block text-xs font-semibold text-[#14221A]">
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
                    className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors ${
                      selected
                        ? 'border-[#154734] bg-[#154734] text-white'
                        : 'border-[#D8D5CB] bg-[#FAFAF7] text-[#4B5B51] hover:bg-white disabled:opacity-45'
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
          className="space-y-2 border-t border-[#ECEAE3] pt-4"
        >
          <label
            htmlFor="save-scenario-name"
            className="block text-xs font-semibold text-[#14221A]"
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
              className="h-9 min-w-0 flex-1 rounded-lg border border-[#D8D5CB] bg-[#FAFAF7] px-2.5 text-xs text-[#14221A] focus:border-[#154734] focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#154734] px-3 text-xs font-semibold text-white hover:bg-[#0F3527]"
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
