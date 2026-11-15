import {
  NASA_POWER_PARAMETERS,
  parseNasaPowerResponse,
  type RawNasaPowerPayload,
  validateCoordinates,
  validateDateRange,
} from '../../src/lib/nasaPowerParser.ts';
import type { NasaPowerClimateDataset } from '../../src/types/rotatewise.ts';

export const NASA_POWER_ENDPOINT =
  'https://power.larc.nasa.gov/api/temporal/daily/point';

const CACHE_TTL_MS = 15 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 12_000;

interface CacheEntry {
  expiresAt: number;
  dataset: NasaPowerClimateDataset;
}

const nasaCache = new Map<string, CacheEntry>();

export class NasaPowerServiceError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 502, code = 'NASA_POWER_ERROR') {
    super(message);
    this.name = 'NasaPowerServiceError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface FetchNasaPowerParams {
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
  timeoutMs?: number;
  bypassCache?: boolean;
}

export function buildNasaPowerUrl(params: {
  latitude: number;
  longitude: number;
  startKey: string;
  endKey: string;
}): string {
  const query = new URLSearchParams({
    parameters: NASA_POWER_PARAMETERS.join(','),
    community: 'AG',
    longitude: params.longitude.toFixed(4),
    latitude: params.latitude.toFixed(4),
    start: params.startKey,
    end: params.endKey,
    format: 'JSON',
  });
  return `${NASA_POWER_ENDPOINT}?${query.toString()}`;
}

export async function fetchNasaPowerDailyClimate({
  latitude,
  longitude,
  startDate,
  endDate,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  bypassCache = false,
}: FetchNasaPowerParams): Promise<NasaPowerClimateDataset> {
  try {
    validateCoordinates(latitude, longitude);
  } catch (err) {
    throw new NasaPowerServiceError(
      err instanceof Error ? err.message : 'Invalid coordinates provided.',
      400,
      'INVALID_COORDINATES'
    );
  }

  let range: ReturnType<typeof validateDateRange>;
  try {
    range = validateDateRange(startDate, endDate);
  } catch (err) {
    throw new NasaPowerServiceError(
      err instanceof Error ? err.message : 'Invalid date range provided.',
      400,
      'INVALID_DATE_RANGE'
    );
  }

  // NASA POWER daily archive starts 1981-01-01
  if (range.startKey < '19810101') {
    throw new NasaPowerServiceError(
      'NASA POWER daily Agroclimatology records begin on 1981-01-01.',
      400,
      'DATE_OUT_OF_ARCHIVE'
    );
  }

  const cacheKey = `${latitude.toFixed(4)}:${longitude.toFixed(4)}:${range.startKey}:${range.endKey}`;
  if (!bypassCache) {
    const cached = nasaCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.dataset;
    }
  }

  const requestUrl = buildNasaPowerUrl({
    latitude,
    longitude,
    startKey: range.startKey,
    endKey: range.endKey,
  });

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'RotateWise-Agronomy-Platform/1.0',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === 'TimeoutError' || err.name === 'AbortError')
    ) {
      throw new NasaPowerServiceError(
        `NASA POWER API request timed out after ${Math.round(timeoutMs / 1000)}s. Please try again or shorten the date range.`,
        504,
        'NASA_POWER_TIMEOUT'
      );
    }
    throw new NasaPowerServiceError(
      `Unable to reach NASA POWER API: ${err instanceof Error ? err.message : 'Network error'}.`,
      502,
      'NASA_POWER_NETWORK_ERROR'
    );
  }

  let payload: RawNasaPowerPayload | null = null;
  try {
    payload = (await response.json()) as RawNasaPowerPayload;
  } catch {
    throw new NasaPowerServiceError(
      `NASA POWER returned an unreadable response (HTTP ${response.status}).`,
      502,
      'NASA_POWER_INVALID_JSON'
    );
  }

  if (!response.ok) {
    const apiMessage = Array.isArray(payload?.messages) && payload.messages.length > 0
      ? payload.messages.join(' ')
      : `NASA POWER returned HTTP ${response.status}.`;
    throw new NasaPowerServiceError(
      apiMessage,
      response.status >= 400 && response.status < 500 ? 400 : 502,
      'NASA_POWER_HTTP_ERROR'
    );
  }

  if (!payload) {
    throw new NasaPowerServiceError(
      'NASA POWER returned an empty payload.',
      502,
      'NASA_POWER_EMPTY_RESPONSE'
    );
  }

  try {
    const dataset = parseNasaPowerResponse(payload, {
      latitude: Number(latitude.toFixed(4)),
      longitude: Number(longitude.toFixed(4)),
      startDate: range.startIso,
      endDate: range.endIso,
    });

    if (dataset.summary.validDayCount === 0) {
      throw new NasaPowerServiceError(
        `NASA POWER returned fill values (-999) for all observations between ${range.startIso} and ${range.endIso}. Note that NASA POWER daily data typically lags real time by 5 to 8 days—select an earlier end date.`,
        422,
        'NASA_POWER_NO_VALID_OBSERVATIONS'
      );
    }

    nasaCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      dataset,
    });

    return dataset;
  } catch (err) {
    if (err instanceof NasaPowerServiceError) {
      throw err;
    }
    const apiMsg =
      Array.isArray(payload.messages) && payload.messages.length > 0
        ? ` (${payload.messages.join(' ')})`
        : '';
    throw new NasaPowerServiceError(
      `${err instanceof Error ? err.message : 'Failed to parse NASA POWER dataset.'}${apiMsg}`,
      502,
      'NASA_POWER_PARSE_ERROR'
    );
  }
}
