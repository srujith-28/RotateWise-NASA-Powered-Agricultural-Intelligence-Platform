import { useCallback, useEffect, useMemo, useState } from 'react';
import { FarmFormModal } from './components/farms/FarmFormModal';
import { Sidebar } from './components/layout/Sidebar';
import { TopNav } from './components/layout/TopNav';
import { ToastContainer, type ToastItem } from './components/ui/ToastContainer';
import { AiAdvisorView } from './components/views/AiAdvisorView';
import { ClimateInsightsView } from './components/views/ClimateInsightsView';
import { CropComparisonView } from './components/views/CropComparisonView';
import { CropIntelligenceView } from './components/views/CropIntelligenceView';
import { DashboardView } from './components/views/DashboardView';
import { FarmsView } from './components/views/FarmsView';
import { ReportsView } from './components/views/ReportsView';
import { RotationPlannerView } from './components/views/RotationPlannerView';
import { ScenarioSimulatorView } from './components/views/ScenarioSimulatorView';
import { SettingsView } from './components/views/SettingsView';
import { CROP_KNOWLEDGE_DATABASE } from './data/cropKnowledgeDb';
import {
  createFallbackClimateForFarm,
  DEMO_ACTIVITIES,
  DEMO_CLIMATE_PROFILES,
  DEMO_CROPS,
  DEMO_FARMS,
  DEMO_REPORTS,
} from './data/demoData';
import { useNasaPowerClimate } from './hooks/useNasaPowerClimate';
import { usePersistentState } from './hooks/usePersistentState';
import {
  calculateClimateSuitability,
  calculateRotationEfficiency,
  getPresetMonthBounds,
  getRecommendedNextCrops,
  type ClimateDateRange,
} from './lib/agronomy';
import {
  evaluateCropsForFarm,
  knowledgeEntryToCropProfile,
  MAX_COMPARISON_CROPS,
} from './lib/cropSuitabilityEngine';
import { DECISION_PREFS_STORAGE_KEY } from './lib/decisionScoringEngine';
import {
  buildDefaultPlanFromFarm,
  saveOrUpdateRotationPlan,
} from './lib/rotationPlannerEngine';
import type {
  ActivityItem,
  AppSettings,
  CropProfile,
  Farm,
  FarmClimateProfile,
  FarmDecisionPreferences,
  IrrigationType,
  NavSection,
  ReportRecord,
  RotationStep,
  SavedClimateScenario,
  SavedRotationPlan,
  SoilType,
} from './types/rotatewise';

const DEFAULT_SETTINGS: AppSettings = {
  unitSystem: 'imperial',
  managerName: '',
  organization: '',
  moistureWarningThreshold: 65,
  rotationTargetScore: 82,
};

const UNIFIED_CROP_CATALOG: CropProfile[] = [
  ...DEMO_CROPS,
  ...CROP_KNOWLEDGE_DATABASE.filter(
    (entry) => !DEMO_CROPS.some((c) => c.id === entry.id)
  ).map(knowledgeEntryToCropProfile),
];

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState<boolean>(
    'rotatewise_sidebar_collapsed_v1',
    false
  );

  const [farms, setFarms] = usePersistentState<Farm[]>('rotatewise_farms_v1', DEMO_FARMS);
  const [activeFarmId, setActiveFarmId] = usePersistentState<string>(
    'rotatewise_active_farm_v1',
    DEMO_FARMS[0].id
  );
  const [settings, setSettings] = usePersistentState<AppSettings>(
    'rotatewise_settings_v1',
    DEFAULT_SETTINGS
  );
  const [activities, setActivities] = usePersistentState<ActivityItem[]>(
    'rotatewise_activities_v1',
    DEMO_ACTIVITIES
  );
  const [reports, setReports] = usePersistentState<ReportRecord[]>(
    'rotatewise_reports_v1',
    DEMO_REPORTS
  );
  const [savedRotationPlans, setSavedRotationPlans] = usePersistentState<SavedRotationPlan[]>(
    'rotatewise_rotation_plans_v1',
    []
  );
  const [savedClimateScenarios, setSavedClimateScenarios] = usePersistentState<
    SavedClimateScenario[]
  >('rotatewise_climate_scenarios_v1', []);
  const [decisionPreferencesByFarm, setDecisionPreferencesByFarm] = usePersistentState<
    Record<string, FarmDecisionPreferences>
  >(DECISION_PREFS_STORAGE_KEY, {});

  const [dateRange, setDateRange] = useState<ClimateDateRange>(() => ({
    preset: '12m',
    ...getPresetMonthBounds('12m'),
  }));

  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [farmModalOpen, setFarmModalOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [comparedCropIds, setComparedCropIds] = useState<string[]>([]);
  const [compareTouched, setCompareTouched] = useState(false);

  const activeFarm = farms.find((f) => f.id === activeFarmId) ?? farms[0] ?? null;
  const nasaClimate = useNasaPowerClimate(activeFarm);

  const nasaDataset = nasaClimate.status === 'success' ? nasaClimate.data : null;
  const cropEvaluations = useMemo(
    () => evaluateCropsForFarm(activeFarm, nasaDataset, CROP_KNOWLEDGE_DATABASE),
    [activeFarm, nasaDataset]
  );

  useEffect(() => {
    if (cropEvaluations.length === 0) return;
    if (!compareTouched) {
      setComparedCropIds(cropEvaluations.slice(0, 3).map((e) => e.crop.id));
    }
  }, [cropEvaluations, compareTouched]);

  const addToast = useCallback(
    (message: string, tone: ToastItem['tone'] = 'success') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const [climateProfile, setClimateProfile] = useState<FarmClimateProfile | null>(() =>
    activeFarm
      ? DEMO_CLIMATE_PROFILES[activeFarm.id] ?? createFallbackClimateForFarm(activeFarm)
      : null
  );
  const [climateLoading, setClimateLoading] = useState(false);
  const [climateError, setClimateError] = useState<string | null>(null);

  const loadClimateForFarm = useCallback(async (farm: Farm | null) => {
    if (!farm) {
      setClimateProfile(null);
      setClimateError(null);
      setClimateLoading(false);
      return;
    }

    setClimateLoading(true);
    setClimateError(null);
    const localFallback =
      DEMO_CLIMATE_PROFILES[farm.id] ?? createFallbackClimateForFarm(farm);

    try {
      const res = await fetch(`/api/climate/${encodeURIComponent(farm.id)}`);
      if (res.ok) {
        const data = (await res.json()) as { climate?: FarmClimateProfile };
        if (data?.climate) {
          setClimateProfile(data.climate);
          setClimateLoading(false);
          return;
        }
      }
      setClimateProfile(localFallback);
    } catch {
      setClimateProfile(localFallback);
      setClimateError(
        'Could not reach climate endpoint; displaying local demonstration climate model.'
      );
    } finally {
      setClimateLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClimateForFarm(activeFarm);
  }, [activeFarm?.id, loadClimateForFarm]);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.geminiConfigured === 'boolean') {
          setGeminiConfigured(data.geminiConfigured);
        }
      })
      .catch(() => {
        // Local fallback remains active
      });
  }, []);

  const appendActivity = (
    farmId: string,
    farmName: string,
    action: string,
    detail: string,
    category: ActivityItem['category']
  ) => {
    const entry: ActivityItem = {
      id: `act-${Date.now()}`,
      farmId,
      farmName,
      action,
      detail,
      timestamp: 'Just now',
      category,
    };
    setActivities((prev) => [entry, ...prev]);
  };

  const handleToggleCompareCrop = (cropId: string) => {
    setCompareTouched(true);
    setComparedCropIds((prev) => {
      if (prev.includes(cropId)) {
        return prev.filter((id) => id !== cropId);
      }
      if (prev.length >= MAX_COMPARISON_CROPS) {
        addToast(`Comparison limit reached (${MAX_COMPARISON_CROPS} crops max).`, 'warning');
        return prev;
      }
      return [...prev, cropId];
    });
  };

  const handleSaveFarmForm = (data: {
    name: string;
    location: string;
    coordinates: { lat: number; lng: number };
    landAreaAcres: number;
    soilType: SoilType;
    phLevel: number;
    irrigation: IrrigationType;
    currentCropId: string;
  }) => {
    const crop = DEMO_CROPS.find((c) => c.id === data.currentCropId) ?? DEMO_CROPS[0];

    if (editingFarm) {
      const updatedFarm: Farm = {
        ...editingFarm,
        name: data.name,
        location: data.location,
        coordinates: data.coordinates,
        landAreaAcres: data.landAreaAcres,
        soilType: data.soilType,
        irrigation: data.irrigation,
        currentCropId: crop.id,
        currentCropName: crop.name,
        health: {
          ...editingFarm.health,
          phLevel: data.phLevel,
        },
        updatedAt: new Date().toISOString(),
      };
      setFarms((prev) => prev.map((f) => (f.id === editingFarm.id ? updatedFarm : f)));
      appendActivity(
        updatedFarm.id,
        updatedFarm.name,
        'Farm profile updated',
        `${updatedFarm.landAreaAcres.toFixed(1)} ac · ${updatedFarm.soilType} (pH ${data.phLevel.toFixed(1)}) · ${updatedFarm.currentCropName}`,
        'farm'
      );
      addToast(`Updated farm "${updatedFarm.name}".`, 'success');

      void fetch(`/api/farms/${editingFarm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFarm),
      }).catch(() => {});
    } else {
      const newFarm: Farm = {
        id: `farm-${Date.now()}`,
        name: data.name,
        location: data.location,
        coordinates: data.coordinates,
        landAreaAcres: data.landAreaAcres,
        soilType: data.soilType,
        irrigation: data.irrigation,
        currentCropId: crop.id,
        currentCropName: crop.name,
        plantingStage: 'Active Season',
        imageUrl: '/src/assets/images/farm_midwest_fields_1794581720817.jpg',
        health: {
          soilHealthScore: 81,
          organicMatterPct: 3.5,
          phLevel: data.phLevel,
          nitrogenBalanceScore: 76,
          moistureRetentionScore: data.irrigation === 'Dryland (Rainfed Only)' ? 68 : 84,
          pestBreakScore: 78,
        },
        rotationPlan: [
          {
            id: `rot-${Date.now()}-1`,
            season: 'Spring 2026',
            cropId: crop.id,
            cropName: crop.name,
            family: crop.family,
            status: 'active',
            expectedYieldIndex: 102,
            nitrogenImpactKgHa: crop.nitrogenDeltaKgHa,
          },
          {
            id: `rot-${Date.now()}-2`,
            season: 'Spring 2027',
            cropId: crop.id === 'soybeans' ? 'corn' : 'soybeans',
            cropName: crop.id === 'soybeans' ? 'Dent Corn' : 'Soybeans',
            family: crop.id === 'soybeans' ? 'Poaceae (Grass)' : 'Fabaceae (Legume)',
            status: 'planned',
            expectedYieldIndex: 106,
            nitrogenImpactKgHa: crop.id === 'soybeans' ? -95 : 52,
          },
        ],
        updatedAt: new Date().toISOString(),
        isDemo: false,
      };
      setFarms((prev) => [newFarm, ...prev]);
      setActiveFarmId(newFarm.id);
      appendActivity(
        newFarm.id,
        newFarm.name,
        'New farm registered',
        `${newFarm.location} · ${newFarm.landAreaAcres.toFixed(1)} ac · ${newFarm.currentCropName}`,
        'farm'
      );
      addToast(`Added farm "${newFarm.name}".`, 'success');

      void fetch('/api/farms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFarm),
      }).catch(() => {});
    }

    setFarmModalOpen(false);
    setEditingFarm(null);
  };

  const handleDeleteFarm = (farmId: string) => {
    const target = farms.find((f) => f.id === farmId);
    const nextFarms = farms.filter((f) => f.id !== farmId);
    setFarms(nextFarms);
    setSavedRotationPlans((prev) => prev.filter((p) => p.farmId !== farmId));
    setSavedClimateScenarios((prev) => prev.filter((s) => s.farmId !== farmId));
    setDecisionPreferencesByFarm((prev) => {
      if (!(farmId in prev)) return prev;
      const next = { ...prev };
      delete next[farmId];
      return next;
    });
    if (activeFarmId === farmId) {
      setActiveFarmId(nextFarms[0]?.id ?? '');
    }
    if (target) {
      appendActivity(
        target.id,
        target.name,
        'Farm deleted',
        `${target.location} removed from workspace.`,
        'farm'
      );
      addToast(`Deleted farm "${target.name}".`, 'info');
    }
    void fetch(`/api/farms/${farmId}`, { method: 'DELETE' }).catch(() => {});
  };

  const handleUpdateRotation = (farmId: string, newPlan: RotationStep[]) => {
    const target = farms.find((f) => f.id === farmId);
    setFarms((prev) =>
      prev.map((f) =>
        f.id === farmId
          ? { ...f, rotationPlan: newPlan, updatedAt: new Date().toISOString() }
          : f
      )
    );
    if (target) {
      setSavedRotationPlans((prev) => {
        const existingPrimary =
          prev.find((p) => p.farmId === farmId && p.isPrimary) ??
          prev.find((p) => p.farmId === farmId) ??
          buildDefaultPlanFromFarm(target);
        return saveOrUpdateRotationPlan(prev, {
          ...existingPrimary,
          steps: newPlan,
          isPrimary: true,
        });
      });
      appendActivity(
        target.id,
        target.name,
        'Rotation sequence updated',
        `Plan now includes ${newPlan.length} seasonal stages.`,
        'rotation'
      );
    }
  };

  const handleAddCropToRotation = (crop: CropProfile) => {
    if (!activeFarm) return;
    const nextStep: RotationStep = {
      id: `rot-${Date.now()}`,
      season: `Season ${activeFarm.rotationPlan.length + 1}`,
      cropId: crop.id,
      cropName: crop.name,
      family: crop.family,
      status: 'planned',
      expectedYieldIndex: 106,
      nitrogenImpactKgHa: crop.nitrogenDeltaKgHa,
    };
    handleUpdateRotation(activeFarm.id, [...activeFarm.rotationPlan, nextStep]);
    addToast(`Scheduled ${crop.name} in ${activeFarm.name} rotation plan.`, 'success');
    setActiveSection('planner');
  };

  const handleSaveScenarioReport = (
    summary: string,
    targetCropName: string,
    meta?: { scenarioTitle?: string; climateSuitability?: number }
  ) => {
    if (!activeFarm) return;
    const currentCrop =
      DEMO_CROPS.find((c) => c.id === activeFarm.currentCropId) ?? DEMO_CROPS[0];
    const evalResult = calculateRotationEfficiency(activeFarm.rotationPlan, DEMO_CROPS, activeFarm);
    const fallbackClimateScore = climateProfile
      ? calculateClimateSuitability(currentCrop, climateProfile, activeFarm.irrigation)
      : 75;
    const recs = climateProfile
      ? getRecommendedNextCrops(activeFarm, climateProfile, DEMO_CROPS)
      : [];

    const report: ReportRecord = {
      id: `rep-sim-${Date.now()}`,
      title:
        meta?.scenarioTitle ??
        `${activeFarm.name} · ${targetCropName} Climate Scenario`,
      farmId: activeFarm.id,
      farmName: activeFarm.name,
      createdAt: new Date().toISOString().slice(0, 10),
      rotationEfficiency: evalResult.efficiencyScore,
      climateSuitability: meta?.climateSuitability ?? fallbackClimateScore,
      soilHealthScore: activeFarm.health.soilHealthScore,
      recommendedCrop: targetCropName || recs[0]?.crop.name || currentCrop.name,
      summary,
    };

    setReports((prev) => [report, ...prev]);
    appendActivity(
      activeFarm.id,
      activeFarm.name,
      'Scenario report saved',
      `Evaluated ${targetCropName} resilience under hypothetical climate sensitivity inputs.`,
      'simulation'
    );
  };

  const handleResetDemoData = () => {
    setFarms(DEMO_FARMS);
    setActiveFarmId(DEMO_FARMS[0].id);
    setActivities(DEMO_ACTIVITIES);
    setReports(DEMO_REPORTS);
    setSavedRotationPlans([]);
    setSavedClimateScenarios([]);
    setDecisionPreferencesByFarm({});
  };

  const openAddFarm = () => {
    setEditingFarm(null);
    setFarmModalOpen(true);
  };

  return (
    <div className="flex min-h-screen bg-[#F5F7F5] text-[#17231E]">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        farmCount={farms.length}
        comparedCount={comparedCropIds.length}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav
          farms={farms}
          activeFarm={activeFarm}
          onSelectFarm={(id) => {
            setActiveFarmId(id);
            const target = farms.find((f) => f.id === id);
            if (target) {
              addToast(`Switched active farm to ${target.name}.`, 'info');
            }
          }}
          onOpenAddFarm={openAddFarm}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          nasaStatus={nasaClimate.status}
          unitSystem={settings.unitSystem}
          onNavigate={setActiveSection}
        />

        <main className="mx-auto w-full max-w-[1360px] flex-1 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8 lg:pb-8">
          {activeSection === 'dashboard' && (
            <DashboardView
              farm={activeFarm}
              climate={climateProfile}
              climateLoading={climateLoading}
              climateError={climateError}
              onRetryClimate={() => void loadClimateForFarm(activeFarm)}
              onDismissClimateError={() => setClimateError(null)}
              nasaClimate={nasaClimate}
              dateRange={dateRange}
              onChangeDateRange={setDateRange}
              cropCatalog={DEMO_CROPS}
              savedRotationPlans={savedRotationPlans}
              savedScenarios={savedClimateScenarios}
              activities={activities}
              unitSystem={settings.unitSystem}
              onNavigate={setActiveSection}
              onAddRecommendedToRotation={handleAddCropToRotation}
              onOpenAddFarm={openAddFarm}
            />
          )}

          {activeSection === 'farms' && (
            <FarmsView
              farms={farms}
              activeFarmId={activeFarm?.id ?? ''}
              unitSystem={settings.unitSystem}
              onSelectFarm={(id) => setActiveFarmId(id)}
              onOpenAdd={openAddFarm}
              onOpenEdit={(farmToEdit) => {
                setEditingFarm(farmToEdit);
                setFarmModalOpen(true);
              }}
              onDeleteFarm={handleDeleteFarm}
            />
          )}

          {activeSection === 'climate' && (
            <ClimateInsightsView
              farm={activeFarm}
              climate={climateProfile}
              climateLoading={climateLoading}
              climateError={climateError}
              onRetryClimate={() => void loadClimateForFarm(activeFarm)}
              onDismissClimateError={() => setClimateError(null)}
              dateRange={dateRange}
              onChangeDateRange={setDateRange}
              nasaClimate={nasaClimate}
              unitSystem={settings.unitSystem}
              onOpenAddFarm={openAddFarm}
            />
          )}

          {activeSection === 'crops' && (
            <CropIntelligenceView
              farm={activeFarm}
              nasaClimate={nasaClimate}
              unitSystem={settings.unitSystem}
              comparedCropIds={comparedCropIds}
              onToggleCompare={handleToggleCompareCrop}
              onAddToRotation={handleAddCropToRotation}
              onOpenAddFarm={openAddFarm}
              onOpenEditFarm={(farmToEdit) => {
                setEditingFarm(farmToEdit);
                setFarmModalOpen(true);
              }}
              onNavigate={setActiveSection}
            />
          )}

          {activeSection === 'comparison' && (
            <CropComparisonView
              farm={activeFarm}
              nasaClimate={nasaClimate}
              unitSystem={settings.unitSystem}
              comparedCropIds={comparedCropIds}
              onToggleCompare={handleToggleCompareCrop}
              onRemoveCompare={(id) => {
                setCompareTouched(true);
                setComparedCropIds((prev) => prev.filter((item) => item !== id));
              }}
              onClearCompare={() => {
                setCompareTouched(true);
                setComparedCropIds([]);
              }}
              onAddToRotation={handleAddCropToRotation}
              onOpenAddFarm={openAddFarm}
              onOpenEditFarm={(farmToEdit) => {
                setEditingFarm(farmToEdit);
                setFarmModalOpen(true);
              }}
              onNavigate={setActiveSection}
            />
          )}

          {activeSection === 'planner' && (
            <RotationPlannerView
              farm={activeFarm}
              cropCatalog={UNIFIED_CROP_CATALOG}
              nasaClimate={nasaClimate}
              unitSystem={settings.unitSystem}
              savedPlans={savedRotationPlans}
              onUpdateSavedPlans={setSavedRotationPlans}
              onUpdateRotation={handleUpdateRotation}
              onOpenAddFarm={openAddFarm}
              onOpenEditFarm={(farmToEdit) => {
                setEditingFarm(farmToEdit);
                setFarmModalOpen(true);
              }}
              onToast={addToast}
            />
          )}

          {activeSection === 'simulator' && (
            <ScenarioSimulatorView
              farm={activeFarm}
              nasaClimate={nasaClimate}
              unitSystem={settings.unitSystem}
              savedScenarios={savedClimateScenarios}
              onUpdateSavedScenarios={setSavedClimateScenarios}
              decisionPreferencesByFarm={decisionPreferencesByFarm}
              onUpdateDecisionPreferences={setDecisionPreferencesByFarm}
              onAddToRotation={handleAddCropToRotation}
              onSaveScenarioReport={handleSaveScenarioReport}
              onOpenAddFarm={openAddFarm}
              onOpenEditFarm={(farmToEdit) => {
                setEditingFarm(farmToEdit);
                setFarmModalOpen(true);
              }}
              onToast={addToast}
            />
          )}

          {activeSection === 'advisor' && (
            <AiAdvisorView
              farm={activeFarm}
              geminiConfigured={geminiConfigured}
              onLogActivity={(action, detail) => {
                if (activeFarm) {
                  appendActivity(activeFarm.id, activeFarm.name, action, detail, 'advisor');
                }
              }}
            />
          )}

          {activeSection === 'reports' && (
            <ReportsView
              farm={activeFarm}
              climate={climateProfile}
              cropCatalog={DEMO_CROPS}
              reports={reports}
              onCreateReport={(rep) => setReports((prev) => [rep, ...prev])}
              onToast={addToast}
            />
          )}

          {activeSection === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={setSettings}
              onResetDemoData={handleResetDemoData}
              onToast={addToast}
            />
          )}
        </main>
      </div>

      <FarmFormModal
        open={farmModalOpen}
        editingFarm={editingFarm}
        cropCatalog={DEMO_CROPS}
        unitSystem={settings.unitSystem}
        onClose={() => {
          setFarmModalOpen(false);
          setEditingFarm(null);
        }}
        onSubmit={handleSaveFarmForm}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
