import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Farm, NasaPowerClimateDataset } from '../types/rotatewise';

export type NasaPresetId = '30d' | '90d' | 'growing2026' | 'season2025' | 'custom';

function shiftDaysIso(daysOffset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

export function getNasaPresetDates(preset: Exclude<NasaPresetId, 'custom'>): {
  startDate: string;
  endDate: string;
} {
  if (preset === '30d') {
    return {
      startDate: shiftDaysIso(-38),
      endDate: shiftDaysIso(-8),
    };
  }
  if (preset === '90d') {
    return {
      startDate: shiftDaysIso(-98),
      endDate: shiftDaysIso(-8),
    };
  }
  if (preset === 'growing2026') {
    return {
      startDate: '2026-04-01',
      endDate: '2026-10-31',
    };
  }
  return {
    startDate: '2025-05-01',
    endDate: '2025-09-30',
  };
}

export interface UseNasaPowerClimateResult {
  preset: NasaPresetId;
  draftStartDate: string;
  draftEndDate: string;
  appliedStartDate: string;
  appliedEndDate: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  data: NasaPowerClimateDataset | null;
  error: string | null;
  lastRetrievedAt: string | null;
  setDraftStartDate: (val: string) => void;
  setDraftEndDate: (val: string) => void;
  selectPreset: (preset: Exclude<NasaPresetId, 'custom'>) => void;
  applyCustomRange: (startDate: string, endDate: string) => void;
  refresh: () => void;
}

export function useNasaPowerClimate(farm: Farm | null): UseNasaPowerClimateResult {
  const initialRange = useMemo(() => getNasaPresetDates('30d'), []);
  const [preset, setPreset] = useState<NasaPresetId>('30d');
  const [draftStartDate, setDraftStartDate] = useState(initialRange.startDate);
  const [draftEndDate, setDraftEndDate] = useState(initialRange.endDate);
  const [appliedRange, setAppliedRange] = useState(initialRange);

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [data, setData] = useState<NasaPowerClimateDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRetrievedAt, setLastRetrievedAt] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const farmId = farm?.id ?? null;
  const farmLat = farm?.coordinates.lat ?? null;
  const farmLng = farm?.coordinates.lng ?? null;

  useEffect(() => {
    if (farmId === null || farmLat === null || farmLng === null) {
      setStatus('idle');
      setData(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setStatus('loading');
    setError(null);

    const query = new URLSearchParams({
      lat: String(farmLat),
      lng: String(farmLng),
      start: appliedRange.startDate,
      end: appliedRange.endDate,
    });
    if (refreshToken > 0) {
      query.set('refresh', '1');
    }

    fetch(`/api/climate/nasa-power?${query.toString()}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as {
          data?: NasaPowerClimateDataset;
          error?: string;
        } | null;

        if (!res.ok || !payload?.data) {
          throw new Error(
            payload?.error ??
              `NASA POWER telemetry request failed with HTTP ${res.status}.`
          );
        }
        return payload.data;
      })
      .then((dataset) => {
        setData(dataset);
        setLastRetrievedAt(dataset.retrievedAt);
        setStatus('success');
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setData(null);
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to retrieve NASA POWER observations.'
        );
        setStatus('error');
      });

    return () => {
      controller.abort();
    };
  }, [farmId, farmLat, farmLng, appliedRange.startDate, appliedRange.endDate, refreshToken]);

  const selectPreset = useCallback((nextPreset: Exclude<NasaPresetId, 'custom'>) => {
    const nextDates = getNasaPresetDates(nextPreset);
    setPreset(nextPreset);
    setDraftStartDate(nextDates.startDate);
    setDraftEndDate(nextDates.endDate);
    setAppliedRange(nextDates);
  }, []);

  const applyCustomRange = useCallback((startDate: string, endDate: string) => {
    setPreset('custom');
    setDraftStartDate(startDate);
    setDraftEndDate(endDate);
    setAppliedRange({ startDate, endDate });
  }, []);

  const refresh = useCallback(() => {
    setRefreshToken((n) => n + 1);
  }, []);

  return {
    preset,
    draftStartDate,
    draftEndDate,
    appliedStartDate: appliedRange.startDate,
    appliedEndDate: appliedRange.endDate,
    status,
    data,
    error,
    lastRetrievedAt,
    setDraftStartDate,
    setDraftEndDate,
    selectPreset,
    applyCustomRange,
    refresh,
  };
}
