import { ArrowLeft, Edit3, RefreshCw, Satellite } from 'lucide-react';
import { useMemo } from 'react';
import { CROP_KNOWLEDGE_DATABASE } from '../../data/cropKnowledgeDb';
import type { UseNasaPowerClimateResult } from '../../hooks/useNasaPowerClimate';
import { formatRainfall, formatTemp } from '../../lib/agronomy';
import { evaluateCropsForFarm } from '../../lib/cropSuitabilityEngine';
import type {
  CropKnowledgeEntry,
  CropProfile,
  Farm,
  NavSection,
} from '../../types/rotatewise';
import { knowledgeEntryToCropProfile } from '../../lib/cropSuitabilityEngine';
import { EmptyState } from '../common/StateFeedback';
import { CropComparisonPanel } from '../crops/CropComparisonPanel';
import { Button } from '../ui/Button';
import { DataClassificationBadge } from '../ui/DataClassificationBadge';
import { PageHeader } from '../ui/PageHeader';

interface CropComparisonViewProps {
  farm: Farm | null;
  nasaClimate: UseNasaPowerClimateResult;
  unitSystem: 'imperial' | 'metric';
  comparedCropIds: string[];
  onToggleCompare: (cropId: string) => void;
  onRemoveCompare: (cropId: string) => void;
  onClearCompare: () => void;
  onAddToRotation: (crop: CropProfile) => void;
  onOpenAddFarm: () => void;
  onOpenEditFarm: (farm: Farm) => void;
  onNavigate: (section: NavSection) => void;
}

export function CropComparisonView({
  farm,
  nasaClimate,
  unitSystem,
  comparedCropIds,
  onToggleCompare,
  onRemoveCompare,
  onClearCompare,
  onAddToRotation,
  onOpenAddFarm,
  onOpenEditFarm,
  onNavigate,
}: CropComparisonViewProps) {
  const nasaDataset = nasaClimate.status === 'success' ? nasaClimate.data : null;

  const evaluations = useMemo(
    () => evaluateCropsForFarm(farm, nasaDataset, CROP_KNOWLEDGE_DATABASE),
    [farm, nasaDataset]
  );

  if (!farm) {
    return (
      <EmptyState
        title="No Active Farm Selected"
        description="Select or add a farm parcel to compare up to four candidate crops side by side against soil, NASA POWER climate, and rotation rules."
        actionLabel="Add First Farm"
        onAction={onOpenAddFarm}
      />
    );
  }

  const handleSchedule = (entry: CropKnowledgeEntry) => {
    onAddToRotation(knowledgeEntryToCropProfile(entry));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Crop Comparison"
        title="Side-by-Side Crop Comparison"
        subtitle={`Compare up to 4 candidate crops across climate, soil, water demand, and rotation compatibility for ${farm.name}.`}
        classification={nasaDataset ? 'suitability' : 'insufficient'}
        metadata={
          <>
            <span className="font-mono tabular-nums text-[#17231E]">
              {farm.coordinates.lat.toFixed(4)}°, {farm.coordinates.lng.toFixed(4)}°
            </span>
            <span aria-hidden="true">·</span>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('crops')}
            >
              <ArrowLeft className="h-3.5 w-3.5 text-[#174C3C]" aria-hidden="true" />
              <span>Crop Directory</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenEditFarm(farm)}
            >
              <Edit3 className="h-3.5 w-3.5 text-[#174C3C]" aria-hidden="true" />
              <span>Edit Soil / Crop</span>
            </Button>
          </>
        }
      />

      {/* Climate Anchor Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#E1E8E2] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5 text-xs">
          <Satellite
            className="mt-0.5 h-4 w-4 shrink-0 text-[#174C3C]"
            aria-hidden="true"
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[#17231E]">
                {nasaDataset
                  ? `NASA POWER (${nasaDataset.startDate} to ${nasaDataset.endDate})`
                  : nasaClimate.status === 'loading'
                    ? 'Synchronizing NASA POWER observations...'
                    : 'NASA POWER observations unavailable'}
              </span>
              <DataClassificationBadge
                category={nasaDataset ? 'nasa' : 'insufficient'}
              />
            </div>
            <p className="mt-1 text-[#65736B]">
              {nasaDataset
                ? `Mean ${formatTemp(nasaDataset.summary.meanTempC ?? 0, unitSystem)} · Rainfall ${formatRainfall(nasaDataset.summary.totalRainfallMm ?? 0, unitSystem)} (${nasaDataset.summary.validDayCount} observed days)`
                : 'Climate & rainfall comparison factors remain unverified until NASA POWER observations load.'}
            </p>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={nasaClimate.refresh}>
          <RefreshCw
            className={`h-3.5 w-3.5 ${
              nasaClimate.status === 'loading' ? 'animate-spin' : ''
            }`}
            aria-hidden="true"
          />
          <span>Refresh NASA</span>
        </Button>
      </div>

      <CropComparisonPanel
        farm={farm}
        nasaData={nasaDataset}
        evaluations={evaluations}
        selectedCropIds={comparedCropIds}
        unitSystem={unitSystem}
        onToggleCrop={onToggleCompare}
        onRemoveCrop={onRemoveCompare}
        onClearAll={onClearCompare}
        onEditFarm={() => onOpenEditFarm(farm)}
        onAddToRotation={handleSchedule}
      />
    </div>
  );
}
