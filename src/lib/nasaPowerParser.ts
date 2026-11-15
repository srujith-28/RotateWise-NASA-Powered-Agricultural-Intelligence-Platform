import type {
  NasaPowerClimateDataset,
  NasaPowerClimateSummary,
  NasaPowerDailyObservation,
} from '../types/rotatewise';

export const NASA_POWER_PARAMETERS = [
  'T2M',
  'T2M_MAX',
  'T2M_MIN',
  'PRECTOTCORR',
  'RH2M',
  'WS10M',
  'ALLSKY_SFC_SW_DWN',
] as const;

export interface RawNasaPowerPayload {
  geometry?: {
    coordinates?: number[];
  };
  header?: {
    fill_value?: number;
    start?: string;
    end?: string;
  };
  properties?: {
    parameter?: Record<string, Record<string, number | null | undefined>>;
  };
  parameters?: Record<string, { units?: string; longname?: string }>;
  messages?: string[];
}

const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function validateCoordinates(lat: number, lng: number): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error(`Invalid latitude (${lat}). Latitude must be between -90 and 90.`);
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error(`Invalid longitude (${lng}). Longitude must be between -180 and 180.`);
  }
}

export function normalizeDateInput(input: string): {
  isoDate: string;
  nasaKey: string;
} {
  const trimmed = input.trim();
  let isoDate = '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    isoDate = trimmed;
  } else if (/^\d{8}$/.test(trimmed)) {
    isoDate = `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  } else {
    throw new Error(`Invalid date format "${input}". Expected YYYY-MM-DD or YYYYMMDD.`);
  }

  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== isoDate) {
    throw new Error(`Invalid calendar date "${input}".`);
  }

  return {
    isoDate,
    nasaKey: isoDate.replaceAll('-', ''),
  };
}

export function validateDateRange(startInput: string, endInput: string): {
  startIso: string;
  endIso: string;
  startKey: string;
  endKey: string;
} {
  const start = normalizeDateInput(startInput);
  const end = normalizeDateInput(endInput);

  if (start.nasaKey > end.nasaKey) {
    throw new Error('Start date must be on or before end date.');
  }

  const startMs = Date.parse(`${start.isoDate}T00:00:00Z`);
  const endMs = Date.parse(`${end.isoDate}T00:00:00Z`);
  const daySpan = Math.round((endMs - startMs) / 86_400_000) + 1;
  if (daySpan > 366) {
    throw new Error('Date range cannot exceed 366 days per NASA POWER daily query.');
  }

  return {
    startIso: start.isoDate,
    endIso: end.isoDate,
    startKey: start.nasaKey,
    endKey: end.nasaKey,
  };
}

export function formatNasaDateKey(dateKey: string): {
  isoDate: string;
  displayDate: string;
  shortDate: string;
} {
  if (!/^\d{8}$/.test(dateKey)) {
    throw new Error(`Unexpected NASA POWER date key "${dateKey}".`);
  }
  const year = dateKey.slice(0, 4);
  const monthIdx = Number(dateKey.slice(4, 6)) - 1;
  const dayNum = Number(dateKey.slice(6, 8));
  const monthName = MONTH_ABBR[monthIdx] ?? 'Unk';
  const isoDate = `${year}-${dateKey.slice(4, 6)}-${dateKey.slice(6, 8)}`;
  return {
    isoDate,
    shortDate: `${monthName} ${dayNum}`,
    displayDate: `${monthName} ${dayNum}, ${year}`,
  };
}

export function sanitizeNasaValue(
  raw: number | null | undefined,
  fillValue = -999
): number | null {
  if (raw === null || raw === undefined || !Number.isFinite(raw)) {
    return null;
  }
  if (raw === fillValue || raw <= -990) {
    return null;
  }
  return Number(raw.toFixed(2));
}

function averageOrNull(values: Array<number | null>): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  const avg = valid.reduce((acc, v) => acc + v, 0) / valid.length;
  return Number(avg.toFixed(2));
}

function sumOrNull(values: Array<number | null>): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  const total = valid.reduce((acc, v) => acc + v, 0);
  return Number(total.toFixed(2));
}

function maxOrNull(values: Array<number | null>): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return Math.max(...valid);
}

function minOrNull(values: Array<number | null>): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return Math.min(...valid);
}

export function parseNasaPowerResponse(
  raw: RawNasaPowerPayload,
  meta: {
    latitude: number;
    longitude: number;
    startDate: string;
    endDate: string;
  }
): NasaPowerClimateDataset {
  const paramMap = raw?.properties?.parameter;
  if (!paramMap || typeof paramMap !== 'object') {
    throw new Error('NASA POWER response is missing properties.parameter data.');
  }

  const fillValue =
    typeof raw.header?.fill_value === 'number' ? raw.header.fill_value : -999;

  const dateKeySet = new Set<string>();
  for (const param of NASA_POWER_PARAMETERS) {
    const series = paramMap[param];
    if (series && typeof series === 'object') {
      for (const key of Object.keys(series)) {
        if (/^\d{8}$/.test(key)) {
          dateKeySet.add(key);
        }
      }
    }
  }

  const sortedKeys = Array.from(dateKeySet).sort();
  if (sortedKeys.length === 0) {
    throw new Error('NASA POWER returned no daily observation keys for the requested range.');
  }

  let missingValueCount = 0;

  const observations: NasaPowerDailyObservation[] = sortedKeys.map((dateKey) => {
    const formatted = formatNasaDateKey(dateKey);
    const t2m = sanitizeNasaValue(paramMap.T2M?.[dateKey], fillValue);
    const t2mMax = sanitizeNasaValue(paramMap.T2M_MAX?.[dateKey], fillValue);
    const t2mMin = sanitizeNasaValue(paramMap.T2M_MIN?.[dateKey], fillValue);
    const precipitationMm = sanitizeNasaValue(paramMap.PRECTOTCORR?.[dateKey], fillValue);
    const humidityPct = sanitizeNasaValue(paramMap.RH2M?.[dateKey], fillValue);
    const windSpeedMs = sanitizeNasaValue(paramMap.WS10M?.[dateKey], fillValue);
    const solarRadiationMj = sanitizeNasaValue(
      paramMap.ALLSKY_SFC_SW_DWN?.[dateKey],
      fillValue
    );

    const rowValues = [
      t2m,
      t2mMax,
      t2mMin,
      precipitationMm,
      humidityPct,
      windSpeedMs,
      solarRadiationMj,
    ];
    missingValueCount += rowValues.filter((v) => v === null).length;

    return {
      dateKey,
      isoDate: formatted.isoDate,
      displayDate: formatted.displayDate,
      shortDate: formatted.shortDate,
      t2m,
      t2mMax,
      t2mMin,
      precipitationMm,
      humidityPct,
      windSpeedMs,
      solarRadiationMj,
    };
  });

  const validDayCount = observations.filter(
    (o) =>
      o.t2m !== null ||
      o.precipitationMm !== null ||
      o.humidityPct !== null ||
      o.solarRadiationMj !== null
  ).length;

  const summary: NasaPowerClimateSummary = {
    meanTempC: averageOrNull(observations.map((o) => o.t2m)),
    maxTempC: maxOrNull(observations.map((o) => o.t2mMax)),
    minTempC: minOrNull(observations.map((o) => o.t2mMin)),
    totalRainfallMm: sumOrNull(observations.map((o) => o.precipitationMm)),
    avgHumidityPct: averageOrNull(observations.map((o) => o.humidityPct)),
    avgWindSpeedMs: averageOrNull(observations.map((o) => o.windSpeedMs)),
    avgSolarRadiationMj: averageOrNull(observations.map((o) => o.solarRadiationMj)),
    validDayCount,
    missingValueCount,
  };

  const units: Record<string, string> = {};
  for (const param of NASA_POWER_PARAMETERS) {
    units[param] = raw.parameters?.[param]?.units ?? '';
  }

  const coords = raw.geometry?.coordinates;
  const elevationM =
    Array.isArray(coords) && typeof coords[2] === 'number' && coords[2] > -990
      ? Number(coords[2].toFixed(1))
      : null;

  return {
    source: 'NASA POWER',
    community: 'AG',
    classification: 'HISTORICAL',
    latitude: meta.latitude,
    longitude: meta.longitude,
    elevationM,
    startDate: meta.startDate,
    endDate: meta.endDate,
    retrievedAt: new Date().toISOString(),
    units,
    observations,
    summary,
  };
}
