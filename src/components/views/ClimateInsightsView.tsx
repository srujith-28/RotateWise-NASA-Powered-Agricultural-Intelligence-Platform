import {
  AlertTriangle,
  Calendar,
  Info,
  RefreshCw,
  Satellite,
} from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { UseNasaPowerClimateResult } from '../../hooks/useNasaPowerClimate';
import {
  convertRainfallValue,
  convertTempValue,
  filterClimateByRange,
  formatRainfall,
  formatRangeLabel,
  formatTemp,
  summarizeClimate,
  type ClimateDateRange,
} from '../../lib/agronomy';
import type {
  Farm,
  FarmClimateProfile,
} from '../../types/rotatewise';
import { DateRangeFilter } from '../common/DateRangeFilter';
import { MetricTooltip } from '../common/MetricTooltip';
import {
  DashboardLoadingSkeleton,
  EmptyState,
  ErrorBanner,
} from '../common/StateFeedback';
import { DataClassificationBadge } from '../ui/DataClassificationBadge';
import { PageHeader } from '../ui/PageHeader';

interface ClimateInsightsViewProps {
  farm: Farm | null;
  climate: FarmClimateProfile | null;
  climateLoading: boolean;
  climateError: string | null;
  onRetryClimate: () => void;
  onDismissClimateError: () => void;
  dateRange: ClimateDateRange;
  onChangeDateRange: (next: ClimateDateRange) => void;
  nasaClimate: UseNasaPowerClimateResult;
  unitSystem: 'imperial' | 'metric';
  onOpenAddFarm: () => void;
}

const CHART_TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: '1px solid #E7EBE7',
  backgroundColor: '#FFFFFF',
  boxShadow: '0 10px 26px rgba(20, 37, 29, 0.10)',
  fontSize: '12px',
  color: '#18231E',
};

function formatWindSpeed(ms: number | null, unitSystem: 'imperial' | 'metric'): string {
  if (ms === null) return '—';
  if (unitSystem === 'imperial') {
    return `${(ms * 2.23694).toFixed(1)} mph`;
  }
  return `${ms.toFixed(1)} m/s`;
}

function convertWindValue(ms: number | null, unitSystem: 'imperial' | 'metric'): number | null {
  if (ms === null) return null;
  if (unitSystem === 'imperial') {
    return Number((ms * 2.23694).toFixed(1));
  }
  return Number(ms.toFixed(1));
}

function NasaLoadingState({
  farmName,
  lat,
  lng,
  startDate,
  endDate,
}: {
  farmName: string;
  lat: number;
  lng: number;
  startDate: string;
  endDate: string;
}) {
  return (
    <div
      role="status"
      aria-label="Loading NASA POWER daily meteorological observations"
      className="space-y-5 rounded-2xl border border-[#E7EBE7] bg-white p-6"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5 text-sm font-medium text-[#174C3C]">
          <RefreshCw className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
          <span>
            Retrieving daily meteorological observations from NASA POWER (AG) for{' '}
            <span className="font-semibold">{farmName}</span>...
          </span>
        </div>
        <span className="font-mono text-xs tabular-nums text-[#737D76]">
          {lat.toFixed(4)}°, {lng.toFixed(4)}° · {startDate} to {endDate}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 border-t border-[#E7EBE7] pt-5 sm:grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((idx) => (
          <div key={idx} className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-[#E7EBE7]" />
            <div className="h-7 w-20 animate-pulse rounded bg-[#DCE5DF]" />
            <div className="h-3 w-28 animate-pulse rounded bg-[#EFF2EE]" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {[1, 2].map((idx) => (
          <div key={idx} className="h-64 animate-pulse rounded-2xl bg-[#F7F8F6]" />
        ))}
      </div>
    </div>
  );
}

export function ClimateInsightsView({
  farm,
  climate,
  climateLoading,
  climateError,
  onRetryClimate,
  onDismissClimateError,
  dateRange,
  onChangeDateRange,
  nasaClimate,
  unitSystem,
  onOpenAddFarm,
}: ClimateInsightsViewProps) {
  const {
    preset,
    draftStartDate,
    draftEndDate,
    appliedStartDate,
    appliedEndDate,
    status: nasaStatus,
    data: nasaData,
    error: nasaError,
    setDraftStartDate,
    setDraftEndDate,
    selectPreset: handleSelectPreset,
    applyCustomRange,
    refresh: refreshNasa,
  } = nasaClimate;

  const handleApplyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    applyCustomRange(draftStartDate, draftEndDate);
  };

  if (climateLoading) {
    return <DashboardLoadingSkeleton />;
  }

  if (!farm || !climate) {
    return (
      <EmptyState
        title="No Farm Climate Profile Available"
        description="Select or add a farm to inspect NASA POWER historical observations and seasonal water balance."
        actionLabel="Add First Farm"
        onAction={onOpenAddFarm}
      />
    );
  }

  const tempUnit = unitSystem === 'imperial' ? '°F' : '°C';
  const rainUnit = unitSystem === 'imperial' ? 'in' : 'mm';
  const windUnit = unitSystem === 'imperial' ? 'mph' : 'm/s';

  const nasaChartRows = (nasaData?.observations ?? []).map((obs) => ({
    date: obs.shortDate,
    isoDate: obs.isoDate,
    t2m: obs.t2m !== null ? convertTempValue(obs.t2m, unitSystem) : null,
    t2mMax: obs.t2mMax !== null ? convertTempValue(obs.t2mMax, unitSystem) : null,
    t2mMin: obs.t2mMin !== null ? convertTempValue(obs.t2mMin, unitSystem) : null,
    rainfall:
      obs.precipitationMm !== null
        ? convertRainfallValue(obs.precipitationMm, unitSystem)
        : null,
    humidity: obs.humidityPct,
    windSpeed: convertWindValue(obs.windSpeedMs, unitSystem),
    solar: obs.solarRadiationMj,
  }));

  const filteredMonthly = filterClimateByRange(climate.monthly, dateRange);
  const rangeLabel = formatRangeLabel(dateRange);
  const summary = summarizeClimate(filteredMonthly);
  const totalGdd = filteredMonthly.reduce((acc, m) => acc + m.gdd, 0);

  const seasonalChartRows = filteredMonthly.map((m) => ({
    month: m.month,
    rainfall: convertRainfallValue(m.rainfallMm, unitSystem),
    et0: convertRainfallValue(m.evapotranspirationMm, unitSystem),
    gdd: m.gdd,
  }));

  return (
    <div className="space-y-8">
      {climateError && (
        <ErrorBanner
          title="Seasonal Climate Fallback Active"
          message={climateError}
          onRetry={onRetryClimate}
          onDismiss={onDismissClimateError}
        />
      )}

      <PageHeader
        breadcrumb="Climate Insights"
        title="Climate Insights"
        subtitle={`Historical daily meteorological observations from NASA POWER and seasonal water balance for ${farm.name}.`}
        classification={nasaStatus === 'success' ? 'nasa' : 'insufficient'}
        metadata={
          <>
            <span className="font-medium text-[#18231E]">{farm.location}</span>
            <span className="text-[#C5CEC7]" aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-[#18231E]">
              {farm.coordinates.lat.toFixed(4)}°, {farm.coordinates.lng.toFixed(4)}°
            </span>
            <span className="text-[#C5CEC7]" aria-hidden="true">·</span>
            <span>NASA POWER Agroclimatology (AG)</span>
          </>
        }
      />

      {/* NASA POWER Query Bar */}
      <section
        aria-label="NASA POWER date range controls"
        className="rounded-2xl border border-[#E7EBE7] bg-white p-4 sm:px-5 sm:py-4"
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#18231E]">
              <Satellite className="h-3.5 w-3.5 text-[#174C3C]" aria-hidden="true" />
              <span>NASA Window:</span>
            </span>
            <div className="flex flex-wrap items-center gap-1 rounded-xl bg-[#EEF1EE] p-1">
              {(
                [
                  { id: '30d', label: '30 Days' },
                  { id: '90d', label: '90 Days' },
                  { id: 'growing2026', label: '2026 Season' },
                  { id: 'season2025', label: '2025 Season' },
                ] as const
              ).map((btn) => {
                const active = preset === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => handleSelectPreset(btn.id)}
                    className={`h-7 rounded-lg px-2.5 text-xs font-medium transition-all whitespace-nowrap ${
                      active
                        ? 'bg-white text-[#18231E] shadow-[0_1px_2px_rgba(20,37,29,0.08)]'
                        : 'text-[#737D76] hover:text-[#18231E]'
                    }`}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>
          </div>

          <form
            onSubmit={handleApplyCustomRange}
            className="flex flex-wrap items-center gap-2"
          >
            <label className="flex items-center gap-1.5 text-xs text-[#737D76]">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Start</span>
              <input
                type="date"
                value={draftStartDate}
                min="1981-01-01"
                onChange={(e) => setDraftStartDate(e.target.value)}
                className="h-8 rounded-lg border border-[#E7EBE7] bg-[#F7F8F6] px-2 font-mono text-xs text-[#18231E] focus:border-[#174C3C] focus:bg-white focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[#737D76]">
              <span>End</span>
              <input
                type="date"
                value={draftEndDate}
                min="1981-01-01"
                onChange={(e) => setDraftEndDate(e.target.value)}
                className="h-8 rounded-lg border border-[#E7EBE7] bg-[#F7F8F6] px-2 font-mono text-xs text-[#18231E] focus:border-[#174C3C] focus:bg-white focus:outline-none"
              />
            </label>
            <button
              type="submit"
              className="h-8 rounded-lg bg-[#174C3C] px-3 text-xs font-medium text-white transition-colors hover:bg-[#133F32] whitespace-nowrap"
            >
              Fetch Range
            </button>
            <button
              type="button"
              onClick={refreshNasa}
              aria-label="Refresh NASA POWER observations"
              title="Force fresh request to NASA POWER API"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E7EBE7] bg-white px-2.5 text-xs font-medium text-[#737D76] transition-colors hover:bg-[#F7F8F6] hover:text-[#18231E]"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${nasaStatus === 'loading' ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Refresh</span>
            </button>
          </form>
        </div>
      </section>

      {/* NASA POWER State 1: Loading */}
      {nasaStatus === 'loading' && (
        <NasaLoadingState
          farmName={farm.name}
          lat={farm.coordinates.lat}
          lng={farm.coordinates.lng}
          startDate={appliedStartDate}
          endDate={appliedEndDate}
        />
      )}

      {/* NASA POWER State 2: Failure */}
      {nasaStatus === 'error' && (
        <section
          role="alert"
          aria-label="NASA POWER retrieval error"
          className="rounded-2xl border border-[#F2C6C6] bg-[#FEF4F4] p-6 text-[#991B1B]"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#B91C1C]" aria-hidden="true" />
              <div>
                <h2 className="font-display text-base font-semibold text-[#7F1D1D]">
                  NASA POWER Observations Unavailable
                </h2>
                <p className="mt-1 text-sm text-[#991B1B]">{nasaError}</p>
                <p className="mt-2 font-mono text-xs tabular-nums text-[#7F1D1D]">
                  Target: {farm.coordinates.lat.toFixed(4)}°, {farm.coordinates.lng.toFixed(4)}° ·
                  Range: {appliedStartDate} to {appliedEndDate} · Source: NASA POWER (AG)
                </p>
                <p className="mt-1 text-xs text-[#7F1D1D]">
                  No demonstration weather values are substituted when NASA POWER fails. Adjust the date range or retry the request.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={refreshNasa}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[#DC2626]/30 bg-white px-4 text-xs font-semibold text-[#991B1B] hover:bg-[#FEE2E2] whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Retry NASA POWER</span>
            </button>
          </div>
        </section>
      )}

      {/* NASA POWER State 3: Success */}
      {nasaStatus === 'success' && nasaData && (
        <section aria-label="NASA POWER historical daily telemetry" className="space-y-6">
          {/* Attribution Banner */}
          <div className="flex flex-col gap-2 rounded-2xl bg-[#EAF2EC]/70 px-5 py-3.5 text-xs text-[#18231E] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <Satellite className="mt-0.5 h-4 w-4 shrink-0 text-[#174C3C]" aria-hidden="true" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[#18231E]">
                    {nasaData.source} · Community: {nasaData.community}
                  </span>
                  <DataClassificationBadge category="nasa" />
                </div>
                <p className="mt-0.5 text-[#3B5245]">
                  Observed daily meteorological record for{' '}
                  <span className="font-mono tabular-nums">
                    {nasaData.latitude.toFixed(4)}°, {nasaData.longitude.toFixed(4)}°
                  </span>
                  {nasaData.elevationM !== null && (
                    <span className="font-mono tabular-nums">
                      {' '}
                      · Elev {nasaData.elevationM} m
                    </span>
                  )}{' '}
                  · {nasaData.startDate} to {nasaData.endDate} ({nasaData.summary.validDayCount} days)
                  {nasaData.summary.missingValueCount > 0 &&
                    ` · ${nasaData.summary.missingValueCount} fill values (-999) excluded`}
                </p>
              </div>
            </div>
            <span className="shrink-0 font-mono text-[11px] font-medium text-[#174C3C]">
              7 AG Parameters
            </span>
          </div>

          {/* Unified 5-Readout Scientific Strip (hairline dividers instead of 5 separate card boxes) */}
          <div className="grid grid-cols-1 divide-y divide-[#E7EBE7] rounded-2xl border border-[#E7EBE7] bg-white sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
            <div className="p-5">
              <span className="flex items-center gap-1 text-xs font-medium text-[#737D76]">
                <span>Mean Daily Temp</span>
                <MetricTooltip
                  label="NASA POWER Daily Temperature"
                  description="Daily mean 2-meter air temperature (T2M) with period minimum (T2M_MIN) and maximum (T2M_MAX) extremes from NASA POWER."
                />
              </span>
              <p className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em] tabular-nums text-[#18231E]">
                {nasaData.summary.meanTempC !== null
                  ? formatTemp(nasaData.summary.meanTempC, unitSystem)
                  : '—'}
              </p>
              <p className="mt-1 font-mono text-[11px] text-[#737D76]">
                {nasaData.summary.minTempC !== null && nasaData.summary.maxTempC !== null
                  ? `${formatTemp(nasaData.summary.minTempC, unitSystem)} to ${formatTemp(
                      nasaData.summary.maxTempC,
                      unitSystem
                    )}`
                  : 'T2M / T2M_MIN / T2M_MAX'}
              </p>
            </div>

            <div className="p-5">
              <span className="flex items-center gap-1 text-xs font-medium text-[#737D76]">
                <span>Period Rainfall</span>
                <MetricTooltip
                  label="Bias-Corrected Precipitation"
                  description="Bias-corrected cumulative precipitation (PRECTOTCORR) across the selected NASA POWER historical date window."
                />
              </span>
              <p className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em] tabular-nums text-[#174C3C]">
                {nasaData.summary.totalRainfallMm !== null
                  ? formatRainfall(nasaData.summary.totalRainfallMm, unitSystem)
                  : '—'}
              </p>
              <p className="mt-1 text-[11px] text-[#737D76]">
                {nasaData.summary.validDayCount} observed days · PRECTOTCORR
              </p>
            </div>

            <div className="p-5">
              <span className="flex items-center gap-1 text-xs font-medium text-[#737D76]">
                <span>Mean Humidity</span>
                <MetricTooltip
                  label="Relative Humidity (RH2M)"
                  description="Average 2-meter relative humidity (RH2M), indicating fungal disease pressure and evaporative demand."
                />
              </span>
              <p className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em] tabular-nums text-[#18231E]">
                {nasaData.summary.avgHumidityPct !== null
                  ? `${nasaData.summary.avgHumidityPct.toFixed(1)}%`
                  : '—'}
              </p>
              <p className="mt-1 text-[11px] text-[#737D76]">2m Relative Humidity · RH2M</p>
            </div>

            <div className="p-5">
              <span className="flex items-center gap-1 text-xs font-medium text-[#737D76]">
                <span>Solar Radiation</span>
                <MetricTooltip
                  label="All-Sky Shortwave Irradiance"
                  description="Mean daily total photosynthetically active surface shortwave downward irradiance (ALLSKY_SFC_SW_DWN, MJ/m²/day)."
                />
              </span>
              <p className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em] tabular-nums text-[#18231E]">
                {nasaData.summary.avgSolarRadiationMj !== null
                  ? nasaData.summary.avgSolarRadiationMj.toFixed(1)
                  : '—'}
                {nasaData.summary.avgSolarRadiationMj !== null && (
                  <span className="ml-1 text-xs font-normal text-[#737D76]">MJ/m²</span>
                )}
              </p>
              <p className="mt-1 text-[11px] text-[#737D76]">Daily All-Sky · SW_DWN</p>
            </div>

            <div className="p-5">
              <span className="flex items-center gap-1 text-xs font-medium text-[#737D76]">
                <span>Mean Wind Speed</span>
                <MetricTooltip
                  label="10m Wind Velocity"
                  description="Average 10-meter wind speed (WS10M), relevant to spray drift windows and canopy evapotranspiration."
                />
              </span>
              <p className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em] tabular-nums text-[#18231E]">
                {formatWindSpeed(nasaData.summary.avgWindSpeedMs, unitSystem)}
              </p>
              <p className="mt-1 text-[11px] text-[#737D76]">10m Velocity · WS10M</p>
            </div>
          </div>

          {/* Historical Daily Charts */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#E7EBE7] bg-white p-5 sm:p-6">
              <div className="border-b border-[#E7EBE7] pb-4">
                <h2 className="flex items-center gap-1.5 font-display text-[17px] font-semibold tracking-[-0.015em] text-[#18231E]">
                  <span>Daily Temperature Envelope ({tempUnit})</span>
                  <MetricTooltip
                    label="NASA POWER Daily Temperature"
                    description="Daily mean (T2M), daytime high (T2M_MAX), and overnight low (T2M_MIN) 2-meter air temperature."
                  />
                </h2>
                <p className="mt-0.5 text-xs text-[#737D76]">
                  T2M, T2M_MAX, T2M_MIN · Historical · {nasaData.startDate} to {nasaData.endDate}
                </p>
              </div>
              <div className="mt-5 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={nasaChartRows}
                    margin={{ top: 10, right: 12, left: -14, bottom: 0 }}
                  >
                    <CartesianGrid stroke="#EEF1EE" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#737D76' }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={24}
                      dy={6}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#737D76' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [`${value ?? '—'} ${tempUnit}`]}
                      contentStyle={CHART_TOOLTIP_STYLE}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                    <Line
                      type="monotone"
                      dataKey="t2mMax"
                      name={`Max (${tempUnit})`}
                      stroke="#B45309"
                      strokeWidth={1.6}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="t2m"
                      name={`Mean (${tempUnit})`}
                      stroke="#174C3C"
                      strokeWidth={2.2}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="t2mMin"
                      name={`Min (${tempUnit})`}
                      stroke="#6F8E7D"
                      strokeWidth={1.6}
                      strokeDasharray="4 4"
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E7EBE7] bg-white p-5 sm:p-6">
              <div className="border-b border-[#E7EBE7] pb-4">
                <h2 className="flex items-center gap-1.5 font-display text-[17px] font-semibold tracking-[-0.015em] text-[#18231E]">
                  <span>Daily Rainfall ({rainUnit}) &amp; Humidity (%)</span>
                  <MetricTooltip
                    label="Rainfall & Relative Humidity"
                    description="Daily precipitation (PRECTOTCORR) paired with 2m relative humidity (RH2M) for moisture and disease risk assessment."
                  />
                </h2>
                <p className="mt-0.5 text-xs text-[#737D76]">
                  PRECTOTCORR &amp; RH2M · Historical · {nasaData.startDate} to {nasaData.endDate}
                </p>
              </div>
              <div className="mt-5 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={nasaChartRows}
                    margin={{ top: 10, right: 6, left: -14, bottom: 0 }}
                  >
                    <CartesianGrid stroke="#EEF1EE" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#737D76' }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={24}
                      dy={6}
                    />
                    <YAxis
                      yAxisId="rain"
                      tick={{ fontSize: 11, fill: '#737D76' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="rh"
                      orientation="right"
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: '#737D76' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                    <Bar
                      yAxisId="rain"
                      dataKey="rainfall"
                      name={`Rainfall (${rainUnit})`}
                      fill="#174C3C"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Line
                      yAxisId="rh"
                      type="monotone"
                      dataKey="humidity"
                      name="Humidity (%)"
                      stroke="#287A5A"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Daily Solar Radiation & Wind Speed */}
          <div className="rounded-2xl border border-[#E7EBE7] bg-white p-5 sm:p-6">
            <div className="border-b border-[#E7EBE7] pb-4">
              <h2 className="flex items-center gap-1.5 font-display text-[17px] font-semibold tracking-[-0.015em] text-[#18231E]">
                <span>Solar Radiation (MJ/m²/day) &amp; Wind Speed ({windUnit})</span>
                <MetricTooltip
                  label="Solar Radiation & Wind"
                  description="All-sky surface shortwave radiation (ALLSKY_SFC_SW_DWN) driving crop photosynthesis alongside 10-meter wind speed (WS10M)."
                />
              </h2>
              <p className="mt-0.5 text-xs text-[#737D76]">
                ALLSKY_SFC_SW_DWN &amp; WS10M · Historical · {nasaData.startDate} to{' '}
                {nasaData.endDate}
              </p>
            </div>
            <div className="mt-5 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={nasaChartRows}
                  margin={{ top: 10, right: 6, left: -14, bottom: 0 }}
                >
                  <CartesianGrid stroke="#EEF1EE" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#737D76' }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={24}
                    dy={6}
                  />
                  <YAxis
                    yAxisId="solar"
                    tick={{ fontSize: 11, fill: '#737D76' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="wind"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#737D76' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Area
                    yAxisId="solar"
                    type="monotone"
                    dataKey="solar"
                    name="Solar (MJ/m²/d)"
                    fill="#EAF2EC"
                    stroke="#287A5A"
                    strokeWidth={2}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="wind"
                    type="monotone"
                    dataKey="windSpeed"
                    name={`Wind (${windUnit})`}
                    stroke="#B45309"
                    strokeWidth={1.8}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* NASA POWER Daily Observations Table */}
          <div className="overflow-hidden rounded-2xl border border-[#E7EBE7] bg-white">
            <div className="flex flex-col gap-1 border-b border-[#E7EBE7] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-[17px] font-semibold tracking-[-0.015em] text-[#18231E]">
                NASA POWER Daily Meteorological Log
              </h2>
              <span className="font-mono text-xs text-[#737D76]">
                {nasaData.observations.length} daily records · NASA POWER (AG)
              </span>
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 bg-[#F7F8F6]">
                  <tr className="border-b border-[#E7EBE7] text-[#737D76]">
                    <th className="px-5 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 text-right font-medium">Mean ({tempUnit})</th>
                    <th className="px-4 py-2.5 text-right font-medium">Min / Max</th>
                    <th className="px-4 py-2.5 text-right font-medium">Rain ({rainUnit})</th>
                    <th className="px-4 py-2.5 text-right font-medium">RH (%)</th>
                    <th className="px-4 py-2.5 text-right font-medium">Solar (MJ/m²)</th>
                    <th className="px-5 py-2.5 text-right font-medium">Wind ({windUnit})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7EBE7] font-mono tabular-nums">
                  {nasaData.observations.map((obs) => (
                    <tr key={obs.dateKey} className="transition-colors hover:bg-[#F7F8F6]">
                      <td className="px-5 py-2.5 font-sans font-medium text-[#18231E] whitespace-nowrap">
                        {obs.displayDate}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[#18231E]">
                        {obs.t2m !== null ? `${convertTempValue(obs.t2m, unitSystem)}°` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[#737D76] whitespace-nowrap">
                        {obs.t2mMin !== null && obs.t2mMax !== null
                          ? `${convertTempValue(obs.t2mMin, unitSystem)}° / ${convertTempValue(
                              obs.t2mMax,
                              unitSystem
                            )}°`
                          : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-[#174C3C]">
                        {obs.precipitationMm !== null
                          ? convertRainfallValue(obs.precipitationMm, unitSystem)
                          : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[#737D76]">
                        {obs.humidityPct !== null ? `${obs.humidityPct.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[#18231E]">
                        {obs.solarRadiationMj !== null ? obs.solarRadiationMj.toFixed(1) : '—'}
                      </td>
                      <td className="px-5 py-2.5 text-right text-[#737D76]">
                        {obs.windSpeedMs !== null
                          ? convertWindValue(obs.windSpeedMs, unitSystem)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Existing Seasonal Water Balance Baseline (Explicitly Labeled DEMONSTRATION) */}
      <section aria-label="Seasonal demonstration baseline" className="space-y-5 border-t border-[#E7EBE7] pt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Info className="h-4 w-4 shrink-0 text-[#174C3C]" aria-hidden="true" />
              <h2 className="font-display text-xl font-semibold tracking-[-0.015em] text-[#18231E]">
                Seasonal Water Balance &amp; GDD Reference
              </h2>
              <DataClassificationBadge category="demo" />
            </div>
            <p className="mt-1 text-xs text-[#737D76]">
              Annualized ET0, frost-free growing window, and monthly degree-day baseline modeled locally for seasonal comparisons.
            </p>
          </div>
          <DateRangeFilter value={dateRange} onChange={onChangeDateRange} />
        </div>

        <div className="grid grid-cols-1 divide-y divide-[#E7EBE7] rounded-2xl border border-[#E7EBE7] bg-white sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          <div className="p-5">
            <span className="flex items-center gap-1 text-xs font-medium text-[#737D76]">
              <span>Baseline Precip ({rangeLabel})</span>
              <MetricTooltip
                label="Baseline Precipitation"
                description="Demonstration annualized precipitation across the selected month window."
              />
            </span>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-[#18231E]">
              {formatRainfall(summary.totalRainfallMm, unitSystem)}
            </p>
          </div>
          <div className="p-5">
            <span className="flex items-center gap-1 text-xs font-medium text-[#737D76]">
              <span>Baseline Mean Temp ({rangeLabel})</span>
              <MetricTooltip
                label="Baseline Mean Temperature"
                description="Demonstration mean monthly air temperature across the filtered seasonal window."
              />
            </span>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-[#18231E]">
              {formatTemp(summary.meanTempC, unitSystem)}
            </p>
          </div>
          <div className="p-5">
            <span className="flex items-center gap-1 text-xs font-medium text-[#737D76]">
              <span>Frost-Free Window</span>
              <MetricTooltip
                label="Frost-Free Window"
                description="Estimated annual freeze-free growing season length used to verify crop maturity fit."
              />
            </span>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-[#18231E]">
              {climate.frostFreeDays}{' '}
              <span className="text-sm font-normal text-[#737D76]">days</span>
            </p>
          </div>
          <div className="p-5">
            <span className="flex items-center gap-1 text-xs font-medium text-[#737D76]">
              <span>Cumulative GDD ({rangeLabel})</span>
              <MetricTooltip
                label="Growing Degree Days"
                description="Growing Degree Days (Base 10°C) accumulated within the selected date window."
              />
            </span>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-[#174C3C]">
              {totalGdd.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E7EBE7] bg-white p-5 sm:p-6">
          <div className="border-b border-[#E7EBE7] pb-4">
            <h2 className="flex items-center gap-1.5 font-display text-[17px] font-semibold tracking-[-0.015em] text-[#18231E]">
              <span>Seasonal Precipitation vs Evapotranspiration ({rainUnit})</span>
              <MetricTooltip
                label="Water Balance Ratio"
                description="Months where evapotranspiration exceeds precipitation indicate net soil moisture drawdown requiring irrigation or residue cover."
              />
            </h2>
            <p className="mt-0.5 text-xs text-[#737D76]">
              Demonstration baseline · Highlights seasonal moisture surplus or irrigation requirement · {rangeLabel}
            </p>
          </div>
          <div className="mt-5 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={seasonalChartRows} margin={{ top: 10, right: 12, left: -14, bottom: 0 }}>
                <CartesianGrid stroke="#EEF1EE" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#737D76' }}
                  axisLine={false}
                  tickLine={false}
                  dy={6}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#737D76' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => [`${value ?? ''} ${rainUnit}`]}
                  contentStyle={CHART_TOOLTIP_STYLE}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Bar
                  dataKey="rainfall"
                  name={`Precipitation (${rainUnit})`}
                  fill="#174C3C"
                  radius={[6, 6, 0, 0]}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="et0"
                  name={`Evapotranspiration (${rainUnit})`}
                  stroke="#B45309"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}
