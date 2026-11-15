import { RotateCcw, Save } from 'lucide-react';
import { useState } from 'react';
import type { AppSettings } from '../../types/rotatewise';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PageHeader } from '../ui/PageHeader';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
  onResetDemoData: () => void;
  onToast?: (message: string, tone?: 'success' | 'info' | 'warning') => void;
}

export function SettingsView({
  settings,
  onUpdateSettings,
  onResetDemoData,
  onToast,
}: SettingsViewProps) {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(draft);
    onToast?.('Workspace unit and agronomy preferences saved.', 'success');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Settings"
        title="Workspace & Unit Settings"
        subtitle="Configure measurement units, agronomy alert thresholds, and local browser demonstration records."
      />

      <form
        onSubmit={handleSave}
        className="max-w-2xl rounded-xl border border-[#E1E8E2] bg-white p-6"
      >
        <h2 className="font-display text-base font-semibold text-[#17231E]">
          Regional Units &amp; Agronomy Thresholds
        </h2>
        <p className="mt-0.5 text-xs text-[#65736B]">
          Preferences persist locally in your browser without requiring user login.
        </p>

        <div className="mt-5 space-y-5">
          <div>
            <span className="block text-xs font-medium text-[#17231E]">
              Measurement Unit System
            </span>
            <p className="mt-0.5 text-xs text-[#65736B]">
              Updates land area, temperature, precipitation, and wind units across all charts and tables.
            </p>
            <div className="mt-2.5 inline-flex flex-wrap rounded-lg bg-[#E6ECE7] p-1">
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => ({ ...d, unitSystem: 'imperial' }))
                }
                className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  draft.unitSystem === 'imperial'
                    ? 'bg-white text-[#17231E] shadow-sm'
                    : 'text-[#65736B] hover:text-[#17231E]'
                }`}
              >
                Imperial (Acres · °F · in)
              </button>
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, unitSystem: 'metric' }))}
                className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  draft.unitSystem === 'metric'
                    ? 'bg-white text-[#17231E] shadow-sm'
                    : 'text-[#65736B] hover:text-[#17231E]'
                }`}
              >
                Metric (Hectares · °C · mm)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="settings-rotation-target"
                className="block text-xs font-medium text-[#17231E]"
              >
                Target Rotation Efficiency Score
              </label>
              <input
                id="settings-rotation-target"
                type="number"
                min={50}
                max={99}
                value={draft.rotationTargetScore}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    rotationTargetScore: Number(e.target.value),
                  }))
                }
                className="mt-1.5 h-10 w-full rounded-lg border border-[#D4DDD6] bg-white px-3 font-mono text-sm tabular-nums text-[#17231E] focus:border-[#174C3C] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="settings-moisture-threshold"
                className="block text-xs font-medium text-[#17231E]"
              >
                Moisture Stress Alert Threshold (%)
              </label>
              <input
                id="settings-moisture-threshold"
                type="number"
                min={20}
                max={95}
                value={draft.moistureWarningThreshold}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    moistureWarningThreshold: Number(e.target.value),
                  }))
                }
                className="mt-1.5 h-10 w-full rounded-lg border border-[#D4DDD6] bg-white px-3 font-mono text-sm tabular-nums text-[#17231E] focus:border-[#174C3C] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E1E8E2] pt-5">
            <Button
              variant="outline"
              onClick={() => setConfirmResetOpen(true)}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>Restore Demo Dataset</span>
            </Button>

            <Button type="submit" variant="primary">
              <Save className="h-4 w-4" aria-hidden="true" />
              <span>Save Preferences</span>
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmResetOpen}
        title="Restore Demonstration Dataset"
        description="Reset farms, custom rotation plans, and saved climate scenarios back to the initial demonstration parcels? Any custom farms or plans stored in this browser will be replaced."
        confirmLabel="Restore Demo Dataset"
        onConfirm={() => {
          onResetDemoData();
          setConfirmResetOpen(false);
          onToast?.('Demonstration parcels and baseline records restored.', 'info');
        }}
        onCancel={() => setConfirmResetOpen(false)}
      />
    </div>
  );
}
