import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatNasaDateKey,
  parseNasaPowerResponse,
  sanitizeNasaValue,
  validateCoordinates,
  validateDateRange,
} from './nasaPowerParser';

test('validateCoordinates rejects out-of-range or NaN coordinates', () => {
  assert.throws(() => validateCoordinates(95, -93), /Latitude/);
  assert.throws(() => validateCoordinates(42, 185), /Longitude/);
  assert.throws(() => validateCoordinates(Number.NaN, 10), /Latitude/);
  assert.doesNotThrow(() => validateCoordinates(42.0308, -93.6319));
});

test('validateDateRange validates ordering, calendar dates, and 366-day cap', () => {
  const valid = validateDateRange('2026-10-01', '2026-10-31');
  assert.equal(valid.startKey, '20261001');
  assert.equal(valid.endKey, '20261031');

  assert.throws(() => validateDateRange('2026-11-01', '2026-10-01'), /Start date/);
  assert.throws(() => validateDateRange('2025-01-01', '2026-06-01'), /366 days/);
  assert.throws(() => validateDateRange('2026-02-30', '2026-03-01'), /Invalid calendar/);
});

test('formatNasaDateKey converts YYYYMMDD into ISO and readable date strings', () => {
  const parsed = formatNasaDateKey('20260603');
  assert.equal(parsed.isoDate, '2026-06-03');
  assert.equal(parsed.shortDate, 'Jun 3');
  assert.equal(parsed.displayDate, 'Jun 3, 2026');
});

test('sanitizeNasaValue handles NASA -999 fill values cleanly', () => {
  assert.equal(sanitizeNasaValue(-999, -999), null);
  assert.equal(sanitizeNasaValue(-999.0, -999), null);
  assert.equal(sanitizeNasaValue(undefined, -999), null);
  assert.equal(sanitizeNasaValue(21.646, -999), 21.65);
});

test('parseNasaPowerResponse parses all 7 parameters and excludes missing values from summary', () => {
  const samplePayload = {
    geometry: { coordinates: [-93.632, 42.031, 310.22] },
    header: { fill_value: -999 },
    parameters: {
      T2M: { units: 'C' },
      T2M_MAX: { units: 'C' },
      T2M_MIN: { units: 'C' },
      PRECTOTCORR: { units: 'mm/day' },
      RH2M: { units: '%' },
      WS10M: { units: 'm/s' },
      ALLSKY_SFC_SW_DWN: { units: 'MJ/m^2/day' },
    },
    properties: {
      parameter: {
        T2M: { '20261001': 17.12, '20261002': -999 },
        T2M_MAX: { '20261001': 23.4, '20261002': -999 },
        T2M_MIN: { '20261001': 10.5, '20261002': -999 },
        PRECTOTCORR: { '20261001': 4.5, '20261002': 0 },
        RH2M: { '20261001': 68.2, '20261002': 71.8 },
        WS10M: { '20261001': 3.4, '20261002': 4.6 },
        ALLSKY_SFC_SW_DWN: { '20261001': 16.5, '20261002': -999 },
      },
    },
  };

  const parsed = parseNasaPowerResponse(samplePayload, {
    latitude: 42.0308,
    longitude: -93.6319,
    startDate: '2026-10-01',
    endDate: '2026-10-02',
  });

  assert.equal(parsed.source, 'NASA POWER');
  assert.equal(parsed.community, 'AG');
  assert.equal(parsed.classification, 'HISTORICAL');
  assert.equal(parsed.elevationM, 310.2);
  assert.equal(parsed.observations.length, 2);
  assert.equal(parsed.observations[0].isoDate, '2026-10-01');
  assert.equal(parsed.observations[1].t2m, null);
  assert.equal(parsed.summary.meanTempC, 17.12);
  assert.equal(parsed.summary.totalRainfallMm, 4.5);
  assert.equal(parsed.summary.avgHumidityPct, 70);
  assert.equal(parsed.summary.avgWindSpeedMs, 4);
  assert.equal(parsed.summary.avgSolarRadiationMj, 16.5);
  assert.equal(parsed.summary.missingValueCount, 4);
});
