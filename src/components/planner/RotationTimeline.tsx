import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Calendar,
  CheckCircle2,
  Clock,
  Droplets,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { formatRainfall } from '../../lib/agronomy';
import type {
  CropProfile,
  RotationStep,
  RotationStepEvaluation,
} from '../../types/rotatewise';

interface RotationTimelineProps {
  steps: RotationStep[];
  stepEvaluations: RotationStepEvaluation[];
  cropCatalog: CropProfile[];
  unitSystem: 'imperial' | 'metric';
  onUpdateStepCrop: (stepId: string, cropId: string) => void;
  onUpdateStepSeason: (stepId: string, season: string) => void;
  onUpdateStepStatus: (stepId: string, status: RotationStep['status']) => void;
  onMoveStep: (index: number, direction: -1 | 1) => void;
  onRemoveStep: (stepId: string) => void;
  onAddStep: (season: string, cropId: string) => void;
}

const QUICK_SEASON_PRESETS = [
  'Kharif 2026',
  'Rabi 2026-27',
  'Zaid 2027',
  'Kharif 2027',
  'Rabi 2027-28',
  'Zaid 2028',
  'Spring 2026',
  'Autumn 2026',
  'Spring 2027',
  'Autumn 2027',
  'Spring 2028',
  'Autumn 2028',
  'Spring 2029',
];

export function RotationTimeline({
  steps,
  stepEvaluations,
  cropCatalog,
  unitSystem,
  onUpdateStepCrop,
  onUpdateStepSeason,
  onUpdateStepStatus,
  onMoveStep,
  onRemoveStep,
  onAddStep,
}: RotationTimelineProps) {
  const [newSeason, setNewSeason] = useState('Spring 2028');
  const [newCropId, setNewCropId] = useState('soybean');

  const evalByStepId = new Map(stepEvaluations.map((e) => [e.stepId, e]));

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeason.trim() || !newCropId) return;
    onAddStep(newSeason.trim(), newCropId);
  };

  return (
    <section
      aria-label="Visual crop rotation timeline"
      className="rounded-2xl border border-[#E7EBE7] bg-white p-5 sm:p-6"
    >
      <div className="flex flex-col gap-3 border-b border-[#E7EBE7] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-[17px] font-semibold tracking-[-0.015em] text-[#18231E]">
            Visual Rotation Timeline ({steps.length} {steps.length === 1 ? 'stage' : 'stages'})
          </h2>
          <p className="mt-1 text-xs text-[#737D76]">
            Edit planned crops, seasons, or stage statuses inline. Conflicts trigger compatibility alerts and up to 3 agronomic alternatives without overriding your choice.
          </p>
        </div>

        {/* Inline Add Stage Form */}
        <form onSubmit={handleAddSubmit} className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label htmlFor="timeline-add-season" className="sr-only">
            New stage season
          </label>
          <input
            id="timeline-add-season"
            type="text"
            list="season-preset-options"
            value={newSeason}
            onChange={(e) => setNewSeason(e.target.value)}
            placeholder="e.g. Kharif 2028"
            className="h-9 min-w-0 flex-1 rounded-xl border border-[#E7EBE7] bg-[#F7F8F6] px-3 text-xs font-medium text-[#18231E] focus:border-[#174C3C] focus:bg-white focus:outline-none sm:w-36 sm:flex-none"
          />
          <datalist id="season-preset-options">
            {QUICK_SEASON_PRESETS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          <label htmlFor="timeline-add-crop" className="sr-only">
            New stage crop
          </label>
          <select
            id="timeline-add-crop"
            value={newCropId}
            onChange={(e) => setNewCropId(e.target.value)}
            className="h-9 min-w-0 max-w-full flex-1 rounded-xl border border-[#E7EBE7] bg-[#F7F8F6] px-2.5 text-xs font-medium text-[#18231E] focus:border-[#174C3C] focus:bg-white focus:outline-none sm:flex-none"
          >
            {cropCatalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.family})
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#174C3C] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#133F32]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Add Stage</span>
          </button>
        </form>
      </div>

      {steps.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#737D76]">
          No seasonal stages in this plan yet. Add a stage above or create a 3-season / 6-season plan.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {steps.map((step, index) => {
            const se = evalByStepId.get(step.id);
            const hasConflict = se?.hasConflict ?? false;
            const highSeverity = se?.warnings.some((w) => w.severity === 'high') ?? false;

            const cardBgClass = highSeverity
              ? 'border-[#EBC4C4] bg-[#FEF8F8]'
              : hasConflict
                ? 'border-[#E6D1A5] bg-[#FEFBF3]'
                : 'border-[#E7EBE7] bg-[#F7F8F6]/70';

            return (
              <div key={step.id} className="relative flex gap-3 sm:gap-4">
                {/* Timeline Step Marker & Connector */}
                <div className="flex flex-col items-center">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-semibold tabular-nums ${
                      highSeverity
                        ? 'bg-[#FEE2E2] text-[#991B1B]'
                        : hasConflict
                          ? 'bg-[#FEF3C7] text-[#9A5B00]'
                          : 'bg-[#174C3C] text-white'
                    }`}
                  >
                    {index + 1}
                  </span>
                  {index < steps.length - 1 && (
                    <div className="my-1.5 w-px flex-1 bg-[#E7EBE7]" aria-hidden="true" />
                  )}
                </div>

                {/* Stage Row */}
                <div className={`min-w-0 flex-1 rounded-2xl border p-4 sm:p-5 ${cardBgClass}`}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-[#737D76]" aria-hidden="true" />
                          <label htmlFor={`stage-season-${step.id}`} className="sr-only">
                            Season and year for stage {index + 1}
                          </label>
                          <input
                            id={`stage-season-${step.id}`}
                            type="text"
                            value={step.season}
                            onChange={(e) => onUpdateStepSeason(step.id, e.target.value)}
                            className="h-7 w-36 rounded-lg border border-[#E7EBE7] bg-white px-2 text-xs font-semibold text-[#18231E] focus:border-[#174C3C] focus:outline-none"
                          />
                        </div>

                        <label htmlFor={`stage-status-${step.id}`} className="sr-only">
                          Status for {step.season}
                        </label>
                        <select
                          id={`stage-status-${step.id}`}
                          value={step.status}
                          onChange={(e) =>
                            onUpdateStepStatus(
                              step.id,
                              e.target.value as RotationStep['status']
                            )
                          }
                          className="h-7 rounded-lg border border-[#E7EBE7] bg-white px-2 text-xs font-medium text-[#18231E] focus:border-[#174C3C] focus:outline-none"
                        >
                          <option value="completed">Completed</option>
                          <option value="active">Active</option>
                          <option value="planned">Planned (Future)</option>
                        </select>

                        {(() => {
                          const s = step.season.toLowerCase();
                          const seasonTone = s.includes('kharif') || s.includes('spring')
                            ? 'bg-[#EAF2EC] text-[#174C3C]'
                            : s.includes('rabi') || s.includes('autumn') || s.includes('winter')
                              ? 'bg-[#EEF2F7] text-[#35557A]'
                              : 'bg-[#FDF6E7] text-[#8A5A00]';
                          const seasonTag = s.includes('kharif')
                            ? 'Monsoon / Warm Wet'
                            : s.includes('rabi')
                              ? 'Cool / Winter'
                              : s.includes('zaid')
                                ? 'Dry / Summer'
                                : s.includes('spring')
                                  ? 'Spring Planting'
                                  : s.includes('autumn') || s.includes('fall')
                                    ? 'Autumn / Overwinter'
                                    : 'Seasonal Stage';
                          return (
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${seasonTone}`}
                            >
                              {seasonTag}
                            </span>
                          );
                        })()}

                        {se?.previousCropName ? (
                          <span className="text-[11px] text-[#737D76]">
                            Previous crop:{' '}
                            <strong className="text-[#18231E]">
                              {se.previousCropName}
                            </strong>{' '}
                            ({se.previousCropFamily ?? 'Recorded'})
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#737D76]">
                            Initial rotation baseline stage
                          </span>
                        )}
                      </div>

                      {/* Crop Inline Selector + Key Attributes */}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                        <div className="sm:w-72">
                          <label htmlFor={`stage-crop-${step.id}`} className="sr-only">
                            Planned crop for {step.season}
                          </label>
                          <select
                            id={`stage-crop-${step.id}`}
                            value={step.cropId}
                            onChange={(e) => onUpdateStepCrop(step.id, e.target.value)}
                            className="h-9 w-full rounded-xl border border-[#E7EBE7] bg-white px-3 text-sm font-semibold text-[#18231E] focus:border-[#174C3C] focus:outline-none"
                          >
                            {cropCatalog.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} — {c.family}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#737D76]">
                          <span>
                            Family:{' '}
                            <strong className="text-[#18231E]">
                              {se?.family ?? step.family}
                            </strong>
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                            <Clock className="h-3 w-3 text-[#737D76]" aria-hidden="true" />
                            {se?.growingDurationDays
                              ? `${se.growingDurationDays[0]}–${se.growingDurationDays[1]} d`
                              : 'Duration unknown'}
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                            <Droplets className="h-3 w-3 text-[#287A5A]" aria-hidden="true" />
                            {se?.waterNeedMm
                              ? `${formatRainfall(se.waterNeedMm[0], unitSystem)}–${formatRainfall(se.waterNeedMm[1], unitSystem)}`
                              : 'Water unknown'}
                            <span className="font-sans text-[11px] text-[#737D76]">
                              ({se?.irrigationDependency ?? 'Moderate'})
                            </span>
                          </span>
                          <span
                            className={`font-mono font-semibold tabular-nums ${
                              (se?.nitrogenDeltaKgHa ?? step.nitrogenImpactKgHa) >= 0
                                ? 'text-[#174C3C]'
                                : 'text-[#445149]'
                            }`}
                          >
                            N:{' '}
                            {(se?.nitrogenDeltaKgHa ?? step.nitrogenImpactKgHa) >= 0
                              ? `+${se?.nitrogenDeltaKgHa ?? step.nitrogenImpactKgHa}`
                              : se?.nitrogenDeltaKgHa ?? step.nitrogenImpactKgHa}{' '}
                            kg/ha
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Stage Ordering & Delete */}
                    <div className="flex items-center gap-1 self-end lg:self-start">
                      <button
                        type="button"
                        onClick={() => onMoveStep(index, -1)}
                        disabled={index === 0}
                        aria-label={`Move stage ${index + 1} (${step.season}) earlier`}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#E7EBE7] bg-white text-[#737D76] transition-colors hover:bg-[#F7F8F6] hover:text-[#18231E] disabled:opacity-40"
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveStep(index, 1)}
                        disabled={index === steps.length - 1}
                        aria-label={`Move stage ${index + 1} (${step.season}) later`}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#E7EBE7] bg-white text-[#737D76] transition-colors hover:bg-[#F7F8F6] hover:text-[#18231E] disabled:opacity-40"
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveStep(step.id)}
                        aria-label={`Remove ${step.season} ${step.cropName}`}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#E7EBE7] bg-white text-[#B91C1C] transition-colors hover:bg-[#FEF2F2]"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Clean or Warning Status */}
                  {se && !se.hasConflict && (
                    <div className="mt-3 flex items-center gap-2 border-t border-[#E7EBE7] pt-2.5 text-[11px] text-[#174C3C]">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{se.seasonFitNote} Root depth: {se.rootDepth}.</span>
                    </div>
                  )}

                  {/* Conflict Warnings + Up to 3 Intelligent Alternatives */}
                  {se && se.hasConflict && (
                    <div className="mt-3 space-y-3 border-t border-[#E7EBE7] pt-3">
                      <div className="space-y-1.5">
                        {se.warnings.map((w) => (
                          <div
                            key={w.id}
                            className={`rounded-xl px-3.5 py-2.5 text-xs ${
                              w.severity === 'high'
                                ? 'bg-[#FEF2F2] text-[#991B1B]'
                                : 'bg-[#FDF6E7] text-[#8A5A00]'
                            }`}
                          >
                            <div className="flex flex-wrap items-center gap-2 font-semibold">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span>{w.title}</span>
                              {w.responsiblePreviousCrop && (
                                <span className="font-normal">
                                  · Preceding crop: <strong>{w.responsiblePreviousCrop}</strong>
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] leading-relaxed">{w.explanation}</p>
                          </div>
                        ))}
                      </div>

                      {se.alternatives.length > 0 && (
                        <div className="rounded-xl bg-[#EAF2EC]/60 p-3.5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#174C3C]">
                            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>
                              Compatible Alternatives for {step.season} (Scored via Crop Intelligence Engine)
                            </span>
                          </div>
                          <div className="mt-2.5 grid grid-cols-1 gap-2.5 md:grid-cols-3">
                            {se.alternatives.map((alt) => (
                              <div
                                key={alt.cropId}
                                className="flex flex-col justify-between rounded-xl bg-white p-3.5 shadow-[0_1px_2px_rgba(20,37,29,0.04)]"
                              >
                                <div>
                                  <div className="flex items-baseline justify-between gap-2">
                                    <span className="text-xs font-semibold text-[#18231E]">
                                      {alt.cropName}
                                    </span>
                                    <span className="font-mono text-xs font-semibold tabular-nums text-[#174C3C]">
                                      {alt.suitabilityScore}/100
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-[#737D76]">{alt.family}</p>
                                  <p className="mt-1 font-mono text-[11px] tabular-nums text-[#445149]">
                                    {alt.growingDurationDays[0]}–{alt.growingDurationDays[1]}d ·{' '}
                                    {formatRainfall(alt.waterNeedMm[0], unitSystem)}–
                                    {formatRainfall(alt.waterNeedMm[1], unitSystem)} · N:{' '}
                                    {alt.nitrogenDeltaKgHa >= 0
                                      ? `+${alt.nitrogenDeltaKgHa}`
                                      : alt.nitrogenDeltaKgHa}{' '}
                                    kg/ha
                                  </p>
                                  <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[11px] text-[#737D76]">
                                    {alt.whyBetter.map((reason) => (
                                      <li key={reason}>{reason}</li>
                                    ))}
                                  </ul>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => onUpdateStepCrop(step.id, alt.cropId)}
                                  className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-xl bg-[#174C3C] px-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#133F32]"
                                >
                                  <span>Replace with {alt.cropName}</span>
                                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
