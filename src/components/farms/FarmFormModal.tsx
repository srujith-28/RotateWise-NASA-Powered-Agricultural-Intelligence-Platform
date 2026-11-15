import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { validateFarmInput } from '../../lib/agronomy';
import type {
  CropProfile,
  Farm,
  FarmFormInput,
  IrrigationType,
  SoilType,
} from '../../types/rotatewise';

interface FarmFormModalProps {
  open: boolean;
  editingFarm: Farm | null;
  cropCatalog: CropProfile[];
  unitSystem: 'imperial' | 'metric';
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    location: string;
    coordinates: { lat: number; lng: number };
    landAreaAcres: number;
    soilType: SoilType;
    phLevel: number;
    irrigation: IrrigationType;
    currentCropId: string;
  }) => void;
}

const SOIL_TYPES: SoilType[] = [
  'Silty Clay Loam',
  'Loam',
  'Sandy Loam',
  'Clay Loam',
  'Silt Loam',
  'Peat Loam',
];

const IRRIGATION_OPTIONS: IrrigationType[] = [
  'Full Center-Pivot',
  'Drip Irrigation',
  'Supplemental Rainfed',
  'Dryland (Rainfed Only)',
];

export function FarmFormModal({
  open,
  editingFarm,
  cropCatalog,
  unitSystem,
  onClose,
  onSubmit,
}: FarmFormModalProps) {
  const [form, setForm] = useState<FarmFormInput>({
    name: '',
    location: '',
    lat: '',
    lng: '',
    landArea: '',
    soilType: 'Loam',
    phLevel: '6.5',
    irrigation: 'Supplemental Rainfed',
    currentCropId: cropCatalog[0]?.id ?? 'corn',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (editingFarm) {
      const displayArea =
        unitSystem === 'metric'
          ? (editingFarm.landAreaAcres * 0.404686).toFixed(1)
          : String(editingFarm.landAreaAcres);
      setForm({
        name: editingFarm.name,
        location: editingFarm.location,
        lat: String(editingFarm.coordinates.lat),
        lng: String(editingFarm.coordinates.lng),
        landArea: displayArea,
        soilType: editingFarm.soilType,
        phLevel: editingFarm.health.phLevel.toFixed(1),
        irrigation: editingFarm.irrigation,
        currentCropId: editingFarm.currentCropId,
      });
    } else {
      setForm({
        name: '',
        location: '',
        lat: '',
        lng: '',
        landArea: '',
        soilType: 'Loam',
        phLevel: '6.5',
        irrigation: 'Supplemental Rainfed',
        currentCropId: cropCatalog[0]?.id ?? 'corn',
      });
    }
    setErrors({});
  }, [open, editingFarm, cropCatalog, unitSystem]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateFarmInput(form, unitSystem);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const numericArea = Number(form.landArea);
    const landAreaAcres =
      unitSystem === 'metric' ? Number((numericArea / 0.404686).toFixed(1)) : numericArea;
    const parsedPh =
      form.phLevel && form.phLevel.trim() !== ''
        ? Number(Number(form.phLevel).toFixed(1))
        : 6.5;

    onSubmit({
      name: form.name.trim(),
      location: form.location.trim(),
      coordinates: {
        lat: Number(Number(form.lat).toFixed(4)),
        lng: Number(Number(form.lng).toFixed(4)),
      },
      landAreaAcres,
      soilType: form.soilType,
      phLevel: parsedPh,
      irrigation: form.irrigation,
      currentCropId: form.currentCropId,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#17231E]/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="farm-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#E1E8E2] bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E1E8E2] pb-4">
          <div>
            <h2 id="farm-modal-title" className="font-display text-lg font-semibold text-[#17231E]">
              {editingFarm ? 'Edit Farm Details' : 'Add New Farm'}
            </h2>
            <p className="mt-0.5 text-xs text-[#65736B]">
              Enter parcel boundaries, soil profile, irrigation, and active crop.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close farm dialog"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#65736B] hover:bg-[#F7F8F5]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          <div>
            <label htmlFor="farm-name" className="block text-xs font-medium text-[#17231E]">
              Farm Name
            </label>
            <input
              id="farm-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g., North Ridge Parcel"
              className="mt-1.5 h-10 w-full rounded-lg border border-[#D4DDD6] bg-white px-3 text-sm text-[#17231E] focus:border-[#174C3C] focus:outline-none"
            />
            {errors.name && <p className="mt-1 text-xs text-[#B91C1C]">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="farm-location" className="block text-xs font-medium text-[#17231E]">
              Location (City, County, State/Region)
            </label>
            <input
              id="farm-location"
              type="text"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="e.g., Boone, Story County, IA"
              className="mt-1.5 h-10 w-full rounded-lg border border-[#D4DDD6] bg-white px-3 text-sm text-[#17231E] focus:border-[#174C3C] focus:outline-none"
            />
            {errors.location && <p className="mt-1 text-xs text-[#B91C1C]">{errors.location}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="farm-lat" className="block text-xs font-medium text-[#17231E]">
                Latitude
              </label>
              <input
                id="farm-lat"
                type="number"
                step="0.0001"
                value={form.lat}
                onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                placeholder="42.0308"
                className="mt-1.5 h-10 w-full rounded-lg border border-[#D4DDD6] bg-white px-3 font-mono text-sm tabular-nums text-[#17231E] focus:border-[#174C3C] focus:outline-none"
              />
              {errors.lat && <p className="mt-1 text-xs text-[#B91C1C]">{errors.lat}</p>}
            </div>
            <div>
              <label htmlFor="farm-lng" className="block text-xs font-medium text-[#17231E]">
                Longitude
              </label>
              <input
                id="farm-lng"
                type="number"
                step="0.0001"
                value={form.lng}
                onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                placeholder="-93.6319"
                className="mt-1.5 h-10 w-full rounded-lg border border-[#D4DDD6] bg-white px-3 font-mono text-sm tabular-nums text-[#17231E] focus:border-[#174C3C] focus:outline-none"
              />
              {errors.lng && <p className="mt-1 text-xs text-[#B91C1C]">{errors.lng}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="farm-area" className="block text-xs font-medium text-[#17231E]">
                Land Area ({unitSystem === 'metric' ? 'Hectares' : 'Acres'})
              </label>
              <input
                id="farm-area"
                type="number"
                step="0.1"
                value={form.landArea}
                onChange={(e) => setForm((f) => ({ ...f, landArea: e.target.value }))}
                placeholder="240"
                className="mt-1.5 h-10 w-full rounded-lg border border-[#D4DDD6] bg-white px-3 font-mono text-sm tabular-nums text-[#17231E] focus:border-[#174C3C] focus:outline-none"
              />
              {errors.landArea && <p className="mt-1 text-xs text-[#B91C1C]">{errors.landArea}</p>}
            </div>

            <div>
              <label htmlFor="farm-soil" className="block text-xs font-medium text-[#17231E]">
                Soil Type
              </label>
              <select
                id="farm-soil"
                value={form.soilType}
                onChange={(e) => setForm((f) => ({ ...f, soilType: e.target.value as SoilType }))}
                className="mt-1.5 h-10 w-full rounded-lg border border-[#D4DDD6] bg-white px-3 text-sm text-[#17231E] focus:border-[#174C3C] focus:outline-none"
              >
                {SOIL_TYPES.map((soil) => (
                  <option key={soil} value={soil}>
                    {soil}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="farm-ph" className="block text-xs font-medium text-[#17231E]">
              Topsoil pH (3.5–9.5)
            </label>
            <input
              id="farm-ph"
              type="number"
              step="0.1"
              min="3.5"
              max="9.5"
              value={form.phLevel ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, phLevel: e.target.value }))}
              placeholder="6.5"
              className="mt-1.5 h-10 w-full rounded-lg border border-[#D4DDD6] bg-white px-3 font-mono text-sm tabular-nums text-[#17231E] focus:border-[#174C3C] focus:outline-none sm:w-48"
            />
            {errors.phLevel && <p className="mt-1 text-xs text-[#B91C1C]">{errors.phLevel}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="farm-irrigation" className="block text-xs font-medium text-[#17231E]">
                Irrigation Availability
              </label>
              <select
                id="farm-irrigation"
                value={form.irrigation}
                onChange={(e) =>
                  setForm((f) => ({ ...f, irrigation: e.target.value as IrrigationType }))
                }
                className="mt-1.5 h-10 w-full rounded-lg border border-[#D4DDD6] bg-white px-3 text-sm text-[#17231E] focus:border-[#174C3C] focus:outline-none"
              >
                {IRRIGATION_OPTIONS.map((irr) => (
                  <option key={irr} value={irr}>
                    {irr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="farm-crop" className="block text-xs font-medium text-[#17231E]">
                Current Crop
              </label>
              <select
                id="farm-crop"
                value={form.currentCropId}
                onChange={(e) => setForm((f) => ({ ...f, currentCropId: e.target.value }))}
                className="mt-1.5 h-10 w-full rounded-lg border border-[#D4DDD6] bg-white px-3 text-sm text-[#17231E] focus:border-[#174C3C] focus:outline-none"
              >
                {cropCatalog.map((crop) => (
                  <option key={crop.id} value={crop.id}>
                    {crop.name} ({crop.family})
                  </option>
                ))}
              </select>
              {errors.currentCropId && (
                <p className="mt-1 text-xs text-[#B91C1C]">{errors.currentCropId}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#E1E8E2] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg border border-[#D4DDD6] bg-white px-4 text-sm font-medium text-[#17231E] hover:bg-[#F7F8F5]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-10 rounded-lg bg-[#174C3C] px-5 text-sm font-medium text-white hover:bg-[#113A2E]"
            >
              {editingFarm ? 'Save Changes' : 'Add Farm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
