import {
  Check,
  Copy,
  Edit3,
  FolderPlus,
  Layers,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { UseNasaPowerClimateResult } from '../../hooks/useNasaPowerClimate';
import {
  createRotationPlan,
  deleteRotationPlan,
  duplicateRotationPlan,
  evaluateRotationPlan,
  generateRecommendedSequence,
  loadPlansForFarm,
  MAX_COMPARISON_PLANS,
  renameRotationPlan,
  resolveRotationCropMeta,
  saveOrUpdateRotationPlan,
  setPrimaryRotationPlan,
} from '../../lib/rotationPlannerEngine';
import type {
  CropProfile,
  Farm,
  RotationPeriodMode,
  RotationSeasonSystem,
  RotationStep,
  SavedRotationPlan,
} from '../../types/rotatewise';
import { EmptyState } from '../common/StateFeedback';
import { RotationPlanComparisonPanel } from '../planner/RotationPlanComparisonPanel';
import { RotationScorePanel } from '../planner/RotationScorePanel';
import { RotationTimeline } from '../planner/RotationTimeline';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PageHeader } from '../ui/PageHeader';

interface RotationPlannerViewProps {
  farm: Farm | null;
  cropCatalog: CropProfile[];
  nasaClimate: UseNasaPowerClimateResult;
  unitSystem: 'imperial' | 'metric';
  savedPlans: SavedRotationPlan[];
  onUpdateSavedPlans: (
    updater: (prev: SavedRotationPlan[]) => SavedRotationPlan[]
  ) => void;
  onUpdateRotation: (farmId: string, newPlan: RotationStep[]) => void;
  onOpenAddFarm: () => void;
  onOpenEditFarm: (farm: Farm) => void;
  onToast?: (message: string, tone?: 'success' | 'info' | 'warning') => void;
}

export function RotationPlannerView({
  farm,
  cropCatalog,
  nasaClimate,
  unitSystem,
  savedPlans,
  onUpdateSavedPlans,
  onUpdateRotation,
  onOpenAddFarm,
  onOpenEditFarm,
  onToast,
}: RotationPlannerViewProps) {
  const farmPlans = useMemo(
    () => loadPlansForFarm(savedPlans, farm),
    [savedPlans, farm]
  );

  const primaryPlan =
    farmPlans.find((p) => p.isPrimary) ?? farmPlans[0] ?? null;

  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    primaryPlan?.id ?? ''
  );
  const [comparedPlanIds, setComparedPlanIds] = useState<string[]>(() =>
    farmPlans.slice(0, MAX_COMPARISON_PLANS).map((p) => p.id)
  );

  // Create plan form state
  const [createOpen, setCreateOpen] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [periodMode, setPeriodMode] = useState<RotationPeriodMode>('6-season');
  const [customStages, setCustomStages] = useState(4);
  const [seasonSystem, setSeasonSystem] = useState<RotationSeasonSystem>(
    'temperate-2'
  );
  const [startYear, setStartYear] = useState(2026);
  const [seedStrategy, setSeedStrategy] = useState<'optimized' | 'starter'>(
    'optimized'
  );

  // Inline rename & delete confirm state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [pendingDeletePlan, setPendingDeletePlan] =
    useState<SavedRotationPlan | null>(null);

  // Reset active selected & compared plans when active farm changes
  useEffect(() => {
    if (!farm) {
      setSelectedPlanId('');
      setComparedPlanIds([]);
      return;
    }
    const plansForNewFarm = loadPlansForFarm(savedPlans, farm);
    const nextPrimary =
      plansForNewFarm.find((p) => p.isPrimary) ?? plansForNewFarm[0];
    setSelectedPlanId(nextPrimary?.id ?? '');
    setComparedPlanIds(
      plansForNewFarm.slice(0, MAX_COMPARISON_PLANS).map((p) => p.id)
    );
    setRenamingId(null);
    setCreateOpen(false);
  }, [farm?.id]);

  // Keep selectedPlanId valid if plans list changes
  useEffect(() => {
    if (farmPlans.length === 0) return;
    if (!farmPlans.some((p) => p.id === selectedPlanId)) {
      setSelectedPlanId((farmPlans.find((p) => p.isPrimary) ?? farmPlans[0]).id);
    }
    setComparedPlanIds((prev) => {
      const valid = prev.filter((id) => farmPlans.some((p) => p.id === id));
      if (valid.length > 0) return valid;
      return farmPlans.slice(0, MAX_COMPARISON_PLANS).map((p) => p.id);
    });
  }, [farmPlans, selectedPlanId]);

  if (!farm) {
    return (
      <EmptyState
        title="No Active Farm for Rotation Planning"
        description="Add or select a farm parcel to sequence multi-year seasonal crops and evaluate agronomic compatibility."
        actionLabel="Add First Farm"
        onAction={onOpenAddFarm}
      />
    );
  }

  const activePlan =
    farmPlans.find((p) => p.id === selectedPlanId) ?? primaryPlan;

  const currentSteps = activePlan?.steps ?? farm.rotationPlan;
  const evaluation = useMemo(
    () => evaluateRotationPlan(currentSteps, farm, nasaClimate.data),
    [currentSteps, farm, nasaClimate.data]
  );

  // Ensure farm's default synthesized plan is persisted before mutating
  const ensureFarmPlansSeeded = (prev: SavedRotationPlan[]): SavedRotationPlan[] => {
    const hasForFarm = prev.some((p) => p.farmId === farm.id);
    if (hasForFarm) return prev;
    return [...prev, ...loadPlansForFarm([], farm)];
  };

  const commitStepsToActivePlan = (nextSteps: RotationStep[]) => {
    if (!activePlan) return;
    const updatedPlan: SavedRotationPlan = {
      ...activePlan,
      steps: nextSteps,
      updatedAt: new Date().toISOString(),
    };
    onUpdateSavedPlans((prev) =>
      saveOrUpdateRotationPlan(ensureFarmPlansSeeded(prev), updatedPlan)
    );
    if (activePlan.isPrimary) {
      onUpdateRotation(farm.id, nextSteps);
    }
  };

  const handleUpdateStepCrop = (stepId: string, cropId: string) => {
    const meta = resolveRotationCropMeta(cropId);
    const nextSteps = currentSteps.map((step) =>
      step.id === stepId
        ? {
            ...step,
            cropId: meta.id,
            cropName: meta.name,
            family: meta.family,
            nitrogenImpactKgHa: meta.nitrogenDeltaKgHa,
          }
        : step
    );
    commitStepsToActivePlan(nextSteps);
  };

  const handleUpdateStepSeason = (stepId: string, season: string) => {
    const nextSteps = currentSteps.map((step) =>
      step.id === stepId ? { ...step, season } : step
    );
    commitStepsToActivePlan(nextSteps);
  };

  const handleUpdateStepStatus = (
    stepId: string,
    status: RotationStep['status']
  ) => {
    const nextSteps = currentSteps.map((step) =>
      step.id === stepId ? { ...step, status } : step
    );
    commitStepsToActivePlan(nextSteps);
  };

  const handleMoveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= currentSteps.length) return;
    const copy = [...currentSteps];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    commitStepsToActivePlan(copy);
  };

  const handleRemoveStep = (stepId: string) => {
    commitStepsToActivePlan(currentSteps.filter((s) => s.id !== stepId));
  };

  const handleAddStep = (season: string, cropId: string) => {
    const meta = resolveRotationCropMeta(cropId);
    const nextStep: RotationStep = {
      id: `rot-step-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      season,
      cropId: meta.id,
      cropName: meta.name,
      family: meta.family,
      status: 'planned',
      expectedYieldIndex: meta.nitrogenDeltaKgHa > 0 ? 106 : 104,
      nitrogenImpactKgHa: meta.nitrogenDeltaKgHa,
    };
    commitStepsToActivePlan([...currentSteps, nextStep]);
  };

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    const defaultLabel =
      periodMode === '3-season'
        ? '3-Season Plan'
        : periodMode === '6-season'
          ? '6-Season (3-Year) Plan'
          : `${customStages}-Stage Custom Plan`;
    const planName = newPlanName.trim() || `${farm.name.replace(' (Demo)', '')} · ${defaultLabel}`;

    const initialCropIds =
      seedStrategy === 'starter'
        ? Array.from(
            { length: periodMode === '3-season' ? 3 : periodMode === '6-season' ? 6 : customStages },
            (_, idx) => (idx % 2 === 0 ? farm.currentCropId || 'maize' : 'soybean')
          )
        : undefined;

    const created = createRotationPlan({
      farm,
      name: planName,
      periodMode,
      startYear,
      seasonSystem,
      customStepsCount: customStages,
      initialCropIds,
      nasaData: nasaClimate.data,
      isPrimary: false,
    });

    onUpdateSavedPlans((prev) =>
      saveOrUpdateRotationPlan(ensureFarmPlansSeeded(prev), created)
    );
    setSelectedPlanId(created.id);
    setComparedPlanIds((prev) =>
      prev.length < MAX_COMPARISON_PLANS
        ? [...prev, created.id]
        : [prev[0], prev[1], created.id]
    );
    setNewPlanName('');
    setCreateOpen(false);
    onToast?.(`Created rotation plan "${created.name}".`, 'success');
  };

  const handleDuplicatePlan = (planId: string) => {
    let createdCopy: SavedRotationPlan | null = null;
    onUpdateSavedPlans((prev) => {
      const seeded = ensureFarmPlansSeeded(prev);
      const res = duplicateRotationPlan(seeded, planId);
      createdCopy = res.duplicated;
      return res.plans;
    });
    if (createdCopy) {
      const copy = createdCopy as SavedRotationPlan;
      setSelectedPlanId(copy.id);
      setComparedPlanIds((prev) =>
        prev.length < MAX_COMPARISON_PLANS ? [...prev, copy.id] : prev
      );
      onToast?.(`Duplicated plan as "${copy.name}".`, 'success');
    }
  };

  const handleStartRename = (plan: SavedRotationPlan) => {
    setRenamingId(plan.id);
    setRenameDraft(plan.name);
  };

  const handleConfirmRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingId || !renameDraft.trim()) return;
    onUpdateSavedPlans((prev) =>
      renameRotationPlan(ensureFarmPlansSeeded(prev), renamingId, renameDraft)
    );
    onToast?.(`Renamed rotation plan to "${renameDraft.trim()}".`, 'success');
    setRenamingId(null);
    setRenameDraft('');
  };

  const handleDeletePlan = (planId: string) => {
    const deleted = farmPlans.find((p) => p.id === planId);
    onUpdateSavedPlans((prev) => {
      const seeded = ensureFarmPlansSeeded(prev);
      return deleteRotationPlan(seeded, planId);
    });
    setComparedPlanIds((prev) => prev.filter((id) => id !== planId));
    setPendingDeletePlan(null);
    if (deleted) {
      onToast?.(`Deleted rotation plan "${deleted.name}".`, 'info');
    }
  };

  const handleSetPrimary = (plan: SavedRotationPlan) => {
    onUpdateSavedPlans((prev) =>
      setPrimaryRotationPlan(ensureFarmPlansSeeded(prev), farm.id, plan.id)
    );
    onUpdateRotation(farm.id, plan.steps);
    onToast?.(`Set "${plan.name}" as active plan for ${farm.name}.`, 'success');
  };

  const handleSuggestOptimizedSequence = () => {
    if (!activePlan) return;
    const completedOrActive = activePlan.steps.filter(
      (s) => s.status === 'completed' || s.status === 'active'
    );
    const plannedExisting = activePlan.steps.filter((s) => s.status === 'planned');
    const targetSeasons =
      plannedExisting.length > 0
        ? plannedExisting.map((s) => s.season)
        : ['Spring 2027', 'Autumn 2027', 'Spring 2028'];

    const generated = generateRecommendedSequence(
      farm,
      nasaClimate.data,
      targetSeasons
    );
    commitStepsToActivePlan([...completedOrActive, ...generated]);
    onToast?.('Updated planned stages with agronomically balanced crop sequence.', 'success');
  };

  const handleToggleCompare = (planId: string) => {
    setComparedPlanIds((prev) => {
      if (prev.includes(planId)) {
        return prev.filter((id) => id !== planId);
      }
      if (prev.length >= MAX_COMPARISON_PLANS) {
        return prev;
      }
      return [...prev, planId];
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Rotation Planner"
        title="Crop Rotation Planner"
        subtitle={`Design, score, and compare multi-season crop rotations for ${farm.name}.`}
        classification="rotation"
        metadata={
          <>
            <span>{farm.soilType}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              pH {farm.health.phLevel.toFixed(1)}
            </span>
            <span aria-hidden="true">·</span>
            <span>{farm.irrigation}</span>
          </>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => setCreateOpen((v) => !v)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#174C3C] bg-white px-3.5 text-sm font-semibold text-[#174C3C] hover:bg-[#EAF2EC] whitespace-nowrap"
            >
              <FolderPlus className="h-4 w-4" aria-hidden="true" />
              <span>New Plan</span>
            </button>

            <button
              type="button"
              onClick={handleSuggestOptimizedSequence}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#174C3C] px-4 text-sm font-medium text-white hover:bg-[#113A2E] whitespace-nowrap"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>Suggest Agronomic Sequence</span>
            </button>
          </>
        }
      />

      {/* Create New Plan Drawer */}
      {createOpen && (
        <section
          aria-label="Create new crop rotation plan"
          className="rounded-xl border border-[#C6DCD0] bg-[#F7FBF8] p-5"
        >
          <div className="flex items-center justify-between border-b border-[#DCEAE1] pb-3">
            <h2 className="font-display text-base font-bold text-[#14221A]">
              Create Multi-Season Rotation Plan
            </h2>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-md p-1 text-[#5F6E65] hover:bg-white hover:text-[#14221A]"
              aria-label="Close new plan form"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <form onSubmit={handleCreatePlan} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <label htmlFor="new-plan-name" className="block text-xs font-medium text-[#14221A]">
                Plan Name
              </label>
              <input
                id="new-plan-name"
                type="text"
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                placeholder="e.g. 3-Year Legume & Brassica Break"
                className="mt-1.5 h-10 w-full rounded-lg border border-[#D8D5CB] bg-white px-3 text-sm text-[#14221A] focus:border-[#154734] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="new-plan-horizon" className="block text-xs font-medium text-[#14221A]">
                Planning Horizon
              </label>
              <select
                id="new-plan-horizon"
                value={periodMode}
                onChange={(e) => setPeriodMode(e.target.value as RotationPeriodMode)}
                className="mt-1.5 h-10 w-full rounded-lg border border-[#D8D5CB] bg-white px-2.5 text-sm text-[#14221A]"
              >
                <option value="3-season">3-Season Plan</option>
                <option value="6-season">6-Season (Multi-Year)</option>
                <option value="custom">Custom Stages</option>
              </select>
            </div>

            {periodMode === 'custom' && (
              <div>
                <label htmlFor="new-plan-custom-count" className="block text-xs font-medium text-[#14221A]">
                  Number of Seasons (1–12)
                </label>
                <input
                  id="new-plan-custom-count"
                  type="number"
                  min={1}
                  max={12}
                  value={customStages}
                  onChange={(e) => setCustomStages(Number(e.target.value) || 4)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-[#D8D5CB] bg-white px-3 font-mono text-sm text-[#14221A]"
                />
              </div>
            )}

            <div>
              <label htmlFor="new-plan-calendar" className="block text-xs font-medium text-[#14221A]">
                Season Calendar
              </label>
              <select
                id="new-plan-calendar"
                value={seasonSystem}
                onChange={(e) => setSeasonSystem(e.target.value as RotationSeasonSystem)}
                className="mt-1.5 h-10 w-full rounded-lg border border-[#D8D5CB] bg-white px-2.5 text-sm text-[#14221A]"
              >
                <option value="temperate-2">Spring / Autumn (2/yr)</option>
                <option value="monsoon-3">Kharif / Rabi / Zaid (3/yr)</option>
              </select>
            </div>

            <div>
              <label htmlFor="new-plan-year" className="block text-xs font-medium text-[#14221A]">
                Start Year
              </label>
              <input
                id="new-plan-year"
                type="number"
                min={2024}
                max={2035}
                value={startYear}
                onChange={(e) => setStartYear(Number(e.target.value) || 2026)}
                className="mt-1.5 h-10 w-full rounded-lg border border-[#D8D5CB] bg-white px-3 font-mono text-sm text-[#14221A]"
              />
            </div>

            <div>
              <label htmlFor="new-plan-seed" className="block text-xs font-medium text-[#14221A]">
                Initial Crop Draft
              </label>
              <select
                id="new-plan-seed"
                value={seedStrategy}
                onChange={(e) =>
                  setSeedStrategy(e.target.value as 'optimized' | 'starter')
                }
                className="mt-1.5 h-10 w-full rounded-lg border border-[#D8D5CB] bg-white px-2.5 text-sm text-[#14221A]"
              >
                <option value="optimized">Agronomy-Balanced Draft</option>
                <option value="starter">Basic 2-Crop Alternation</option>
              </select>
            </div>

            <div className="flex items-end sm:col-span-2 lg:col-span-6">
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#154734] px-5 text-sm font-semibold text-white hover:bg-[#0F3527]"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                <span>Create &amp; Open Plan</span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Saved Plans Bar (Select, Rename, Duplicate, Delete, Set Primary) */}
      <section
        aria-label="Saved rotation plans for active farm"
        className="rounded-xl border border-[#E4E2DA] bg-white p-4 shadow-[0_1px_2px_rgba(18,43,29,0.03)]"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5F6E65]">
              <Layers className="h-3.5 w-3.5 text-[#154734]" aria-hidden="true" />
              <span>Saved Plans ({farmPlans.length}):</span>
            </span>

            {farmPlans.map((plan) => {
              const isSelected = activePlan?.id === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => {
                    setSelectedPlanId(plan.id);
                    setRenamingId(null);
                  }}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors ${
                    isSelected
                      ? 'border-[#154734] bg-[#154734] text-white'
                      : 'border-[#D8D5CB] bg-[#FAFAF7] text-[#14221A] hover:bg-white'
                  }`}
                >
                  <span>{plan.name}</span>
                  <span
                    className={`font-mono text-[11px] ${
                      isSelected ? 'text-[#CBE6D6]' : 'text-[#6B7970]'
                    }`}
                  >
                    ({plan.steps.length})
                  </span>
                  {plan.isPrimary && (
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide ${
                        isSelected ? 'text-[#CBE6D6]' : 'text-[#2E8B57]'
                      }`}
                    >
                      · Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {activePlan && (
            <div className="flex flex-wrap items-center gap-2">
              {renamingId === activePlan.id ? (
                <form onSubmit={handleConfirmRename} className="flex items-center gap-1.5">
                  <label htmlFor="rename-plan-input" className="sr-only">
                    Rename rotation plan
                  </label>
                  <input
                    id="rename-plan-input"
                    type="text"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    className="h-8 w-48 rounded-md border border-[#154734] bg-white px-2.5 text-xs text-[#14221A] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-8 items-center rounded-md bg-[#154734] px-2.5 text-xs font-semibold text-white hover:bg-[#0F3527]"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingId(null)}
                    className="inline-flex h-8 items-center rounded-md border border-[#D8D5CB] px-2 text-xs text-[#4B5B51] hover:bg-[#F6F5F0]"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  {!activePlan.isPrimary && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(activePlan)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#154734] bg-[#F2F8F4] px-2.5 text-xs font-semibold text-[#154734] hover:bg-[#E3F1E8]"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Set Active on Farm</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleStartRename(activePlan)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#D8D5CB] bg-white px-2.5 text-xs font-medium text-[#14221A] hover:bg-[#F6F5F0]"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-[#5F6E65]" aria-hidden="true" />
                    <span>Rename</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicatePlan(activePlan.id)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#D8D5CB] bg-white px-2.5 text-xs font-medium text-[#14221A] hover:bg-[#F6F5F0]"
                  >
                    <Copy className="h-3.5 w-3.5 text-[#5F6E65]" aria-hidden="true" />
                    <span>Duplicate</span>
                  </button>
                  {farmPlans.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPendingDeletePlan(activePlan)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E5C5C5] bg-white px-2.5 text-xs font-medium text-[#B91C1C] hover:bg-[#FEF2F2]"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Delete</span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Deterministic 0–100 Rotation Score & 5 Categories */}
      <RotationScorePanel
        evaluation={evaluation}
        farm={farm}
        nasaData={nasaClimate.data}
        nasaLoading={nasaClimate.status === 'loading'}
        nasaError={nasaClimate.error}
        unitSystem={unitSystem}
        onEditFarm={() => onOpenEditFarm(farm)}
      />

      {/* Interactive Visual Rotation Timeline + Inline Edits + Intelligent Alternatives */}
      <RotationTimeline
        steps={currentSteps}
        stepEvaluations={evaluation.stepEvaluations}
        cropCatalog={cropCatalog}
        unitSystem={unitSystem}
        onUpdateStepCrop={handleUpdateStepCrop}
        onUpdateStepSeason={handleUpdateStepSeason}
        onUpdateStepStatus={handleUpdateStepStatus}
        onMoveStep={handleMoveStep}
        onRemoveStep={handleRemoveStep}
        onAddStep={handleAddStep}
      />

      {/* Side-by-Side Comparison of Up to 3 Saved Plans */}
      <RotationPlanComparisonPanel
        plans={farmPlans}
        selectedPlanIds={comparedPlanIds}
        farm={farm}
        nasaData={nasaClimate.data}
        unitSystem={unitSystem}
        onTogglePlanComparison={handleToggleCompare}
        onDuplicateActivePlan={() => {
          if (activePlan) handleDuplicatePlan(activePlan.id);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDeletePlan)}
        title="Delete Rotation Plan"
        description={
          pendingDeletePlan
            ? `Are you sure you want to permanently delete "${pendingDeletePlan.name}"? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete Plan"
        onConfirm={() => {
          if (pendingDeletePlan) handleDeletePlan(pendingDeletePlan.id);
        }}
        onCancel={() => setPendingDeletePlan(null)}
      />
    </div>
  );
}
