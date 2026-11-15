import { Check, Edit3, Plus, Search, Sprout, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { formatArea } from '../../lib/agronomy';
import type { Farm } from '../../types/rotatewise';
import { EmptyState } from '../common/StateFeedback';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { DataClassificationBadge } from '../ui/DataClassificationBadge';
import { PageHeader } from '../ui/PageHeader';

interface FarmsViewProps {
  farms: Farm[];
  activeFarmId: string;
  unitSystem: 'imperial' | 'metric';
  onSelectFarm: (farmId: string) => void;
  onOpenAdd: () => void;
  onOpenEdit: (farm: Farm) => void;
  onDeleteFarm: (farmId: string) => void;
}

export function FarmsView({
  farms,
  activeFarmId,
  unitSystem,
  onSelectFarm,
  onOpenAdd,
  onOpenEdit,
  onDeleteFarm,
}: FarmsViewProps) {
  const [search, setSearch] = useState('');
  const [pendingDeleteFarm, setPendingDeleteFarm] = useState<Farm | null>(null);

  const filtered = farms.filter((f) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      f.name.toLowerCase().includes(q) ||
      f.location.toLowerCase().includes(q) ||
      f.soilType.toLowerCase().includes(q) ||
      f.currentCropName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="My Farms"
        title="My Farms"
        subtitle="Manage agricultural parcels, coordinates, soil profiles, and active crops."
        actions={
          <Button variant="primary" onClick={onOpenAdd}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add Farm</span>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#737D76]"
            aria-hidden="true"
          />
          <label htmlFor="farm-search-input" className="sr-only">
            Search farms
          </label>
          <input
            id="farm-search-input"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name, location, soil, or crop..."
            className="h-10 w-full rounded-xl border border-[#E7EBE7] bg-white pr-3.5 pl-10 text-sm text-[#18231E] focus:border-[#174C3C] focus:outline-none"
          />
        </div>
        <p className="font-mono text-xs tabular-nums text-[#737D76]">
          Showing {filtered.length} of {farms.length} farms
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={
            farms.length === 0
              ? 'No farms registered yet'
              : 'No farms match your search'
          }
          description={
            farms.length === 0
              ? 'Add your first farm parcel to begin rotation planning and climate modeling.'
              : 'Clear your search query or add a new farm parcel.'
          }
          actionLabel={farms.length === 0 ? 'Add First Farm' : 'Clear Search'}
          onAction={farms.length === 0 ? onOpenAdd : () => setSearch('')}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((farm) => {
            const isActive = farm.id === activeFarmId;
            return (
              <article
                key={farm.id}
                className={`flex flex-col overflow-hidden rounded-2xl border bg-white transition-colors ${
                  isActive
                    ? 'border-[#174C3C] ring-1 ring-[#174C3C]/15'
                    : 'border-[#E7EBE7] hover:border-[#C5D1C8]'
                }`}
              >
                <div className="relative h-40 w-full overflow-hidden bg-[#EAF2EC]">
                  {farm.imageUrl ? (
                    <img
                      src={farm.imageUrl}
                      alt={`${farm.name} agricultural field`}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#174C3C]">
                      <Sprout className="h-10 w-10" aria-hidden="true" />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-display text-base font-semibold text-[#18231E]">
                        {farm.name}
                      </h2>
                      <p className="mt-0.5 text-xs text-[#737D76]">
                        {farm.location}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {isActive && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#174C3C] whitespace-nowrap">
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Active</span>
                        </span>
                      )}
                      {farm.isDemo && (
                        <DataClassificationBadge
                          category="demo"
                          customLabel="Demo Parcel"
                        />
                      )}
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-[#E7EBE7] pt-4 text-xs">
                    <div>
                      <dt className="text-[#737D76]">Land Area</dt>
                      <dd className="mt-0.5 font-mono font-semibold tabular-nums text-[#18231E]">
                        {formatArea(farm.landAreaAcres, unitSystem)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#737D76]">Current Crop</dt>
                      <dd className="mt-0.5 font-semibold text-[#18231E]">
                        {farm.currentCropName}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#737D76]">Soil Type &amp; pH</dt>
                      <dd className="mt-0.5 text-[#18231E]">
                        {farm.soilType} ({farm.health.phLevel.toFixed(1)})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#737D76]">Irrigation</dt>
                      <dd className="mt-0.5 text-[#18231E]">
                        {farm.irrigation}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[#737D76]">Coordinates</dt>
                      <dd className="mt-0.5 font-mono tabular-nums text-[#737D76]">
                        {farm.coordinates.lat.toFixed(4)}°,{' '}
                        {farm.coordinates.lng.toFixed(4)}°
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-5 flex items-center justify-between gap-2 border-t border-[#E7EBE7] pt-4">
                    <button
                      type="button"
                      onClick={() => onSelectFarm(farm.id)}
                      className={`h-9 rounded-xl px-3.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-[#EAF2EC] text-[#174C3C]'
                          : 'bg-[#174C3C] text-white hover:bg-[#133F32]'
                      }`}
                    >
                      {isActive ? 'Selected Farm' : 'Set Active'}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenEdit(farm)}
                        aria-label={`Edit ${farm.name}`}
                        className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#E7EBE7] bg-white px-3 text-xs font-medium text-[#18231E] transition-colors hover:bg-[#F7F8F6]"
                      >
                        <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPendingDeleteFarm(farm)}
                        aria-label={`Delete ${farm.name}`}
                        className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#EBD2D2] bg-white px-2.5 text-xs font-medium text-[#B91C1C] transition-colors hover:bg-[#FEF2F2]"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteFarm)}
        title="Delete Farm Parcel"
        description={
          pendingDeleteFarm
            ? `Permanently delete "${pendingDeleteFarm.name}" and all its saved rotation plans and climate scenarios?`
            : ''
        }
        confirmLabel="Delete Farm"
        onConfirm={() => {
          if (pendingDeleteFarm) {
            onDeleteFarm(pendingDeleteFarm.id);
            setPendingDeleteFarm(null);
          }
        }}
        onCancel={() => setPendingDeleteFarm(null)}
      />
    </div>
  );
}
