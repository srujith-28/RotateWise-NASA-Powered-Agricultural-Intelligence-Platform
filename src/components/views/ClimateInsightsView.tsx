import {
  AlertTriangle,
  Calendar,
  CloudRain,
  CloudSun,
  Droplets,
  Info,
  RefreshCw,
  Satellite,
  Sun,
  ThermometerSun,
  Wind,
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
import { KpiCard } from '../common/KpiCard';
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
      className="space-y-4 rounded-xl border border-[#E4E2DA] bg-white p-5"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5 text-sm font-medium text-[#154734]">
          <RefreshCw className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
          <span>
            Retrieving daily meteorological observations from NASA POWER (AG) for{' '}
            <span className="font-semibold">{farmName}</span>...
          </span>
        </div>
        <span className="font-mono text-xs tabular-nums text-[#6B7970]">
          {lat.toFixed(4)}°, {lng.toFixed(4)}° · {startDate} to {endDate}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((idx) => (
          <div key={idx} className="h-28 rounded-xl border border-[#ECEAE3] bg-[#FAFAF7] p-4">
            <div className="h-3 w-24 animate-pulse rounded bg-[#E4E2DA]" />
            <div className="mt-3 h-7 w-20 animate-pulse rounded bg-[#DCE5DF]" />
            <div className="mt-2 h-3 w-28 animate-pulse rounded bg-[#ECEAE3]" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {[1, 2].map((idx) => (
          <div key={idx} className="h-64 animate-pulse rounded-xl border border-[#ECEAE3] bg-[#FAFAF7]" />
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
    <div className="space-y-6">
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
            <span>{farm.location}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-[#17231E]">
              {farm.coordinates.lat.toFixed(4)}°, {farm.coordinates.lng.toFixed(4)}°
            </span>
            <span aria-hidden="true">·</span>
            <span>NASA POWER Agroclimatology (AG)</span>
          </>
        }
      />

      {/* NASA POWER Query Bar */}
      <section
        aria-label="NASA POWER date range controls"
        className="rounded-xl border border-[#E4E2DA] bg-white p-4 shadow-[0_1px_2px_rgba(18,43,29,0.03)]"
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 flex items-center gap-1.5 text-xs font-semibold text-[#14221A]">
              <Satellite className="h-3.5 w-3.5 text-[#154734]" aria-hidden="true" />
              <span>NASA POWER Window:</span>
            </span>
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
                  className={`h-8 rounded-md px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#154734] text-white'
                      : 'border border-[#E4E2DA] bg-[#FAFAF7] text-[#4B5B51] hover:bg-[#F2F6F3] hover:text-[#14221A]'
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>

          <form
            onSubmit={handleApplyCustomRange}
            className="flex flex-wrap items-center gap-2"
          >
            <label className="flex items-center gap-1.5 text-xs text-[#4B5B51]">
              <Calendar className="h-3.5 w-3.5 text-[#6B7970]" aria-hidden="true" />
              <span>Start</span>
              <input
                type="date"
                value={draftStartDate}
                min="1981-01-01"
                onChange={(e) => setDraftStartDate(e.target.value)}
                className="h-8 rounded-md border border-[#D8D5CB] bg-[#FBFBF9] px-2 font-mono text-xs text-[#14221A] focus:border-[#154734] focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[#4B5B51]">
              <span>End</span>
              <input
                type="date"
                value={draftEndDate}
                min="1981-01-01"
                onChange={(e) => setDraftEndDate(e.target.value)}
                className="h-8 rounded-md border border-[#D8D5CB] bg-[#FBFBF9] px-2 font-mono text-xs text-[#14221A] focus:border-[#154734] focus:outline-none"
              />
            </label>
            <button
              type="submit"
              className="h-8 rounded-md border border-[#154734] bg-white px-3 text-xs font-semibold text-[#154734] transition-colors hover:bg-[#154734] hover:text-white whitespace-nowrap"
            >
              Fetch Range
            </button>
            <button
              type="button"
              onClick={refreshNasa}
              aria-label="Refresh NASA POWER observations"
              title="Force fresh request to NASA POWER API"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E4E2DA] bg-[#FAFAF7] px-2.5 text-xs font-medium text-[#4B5B51] hover:bg-[#F2F6F3] hover:text-[#14221A]"
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

      {/* NASA POWER State 2: Failure (Never substitutes demo data) */}
      {nasaStatus === 'error' && (
        <section
          role="alert"
          aria-label="NASA POWER retrieval error"
          className="rounded-xl border border-[#F2C6C6] bg-[#FEF2F2] p-6 text-[#991B1B]"
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
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#DC2626]/40 bg-white px-4 text-xs font-semibold text-[#991B1B] hover:bg-[#FEE2E2] whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Retry NASA POWER</span>
            </button>
          </div>
        </section>
      )}

      {/* NASA POWER State 3: Success */}
      {nasaStatus === 'success' && nasaData && (
        <section aria-label="NASA POWER historical daily telemetry" className="space-y-5">
          {/* Attribution & Classification Banner */}
          <div className="flex flex-col gap-2 rounded-xl border border-[#C6DCD0] bg-[#EAF2EC] px-4 py-3 text-xs text-[#17231E] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <Satellite className="mt-0.5 h-4 w-4 shrink-0 text-[#174C3C]" aria-hidden="true" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[#17231E]">
                    Source: {nasaData.source} · Community: {nasaData.community}
                  </span>
                  <DataClassificationBadge category="nasa" />
                </div>
                <p className="mt-0.5 text-[#365443]">
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
            <span className="shrink-0 font-mono text-[11px] text-[#65736B]">
              7 AG Parameters
            </span>
          </div>

          {/* 5 NASA POWER Daily KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard
              label="Mean Daily Temp"
              value={
                nasaData.summary.meanTempC !== null
                  ? formatTemp(nasaData.summary.meanTempC, unitSystem)
                  : '—'
              }
              subtitle={
                nasaData.summary.minTempC !== null && nasaData.summary.maxTempC !== null
                  ? `Range ${formatTemp(nasaData.summary.minTempC, unitSystem)} to ${formatTemp(
                      nasaData.summary.maxTempC,
                      unitSystem
                    )}`
                  : 'T2M / T2M_MIN / T2M_MAX'
              }
              icon={ThermometerSun}
              tooltip="Daily mean 2-meter air temperature (T2M) with period minimum (T2M_MIN) and maximum (T2M_MAX) extremes from NASA POWER."
            />
            <KpiCard
              label="Daily Period Rainfall"
              value={
                nasaData.summary.totalRainfallMm !== null
                  ? formatRainfall(nasaData.summary.totalRainfallMm, unitSystem)
                  : '—'
              }
              subtitle={`${nasaData.summary.validDayCount} observed days · PRECTOTCORR`}
              icon={CloudRain}
              tooltip="Bias-corrected cumulative precipitation (PRECTOTCORR) across the selected NASA POWER historical date window."
            />
            <KpiCard
              label="Mean Humidity"
              value={
                nasaData.summary.avgHumidityPct !== null
                  ? `${nasaData.summary.avgHumidityPct.toFixed(1)}%`
                  : '—'
              }
              subtitle="2m Relative Humidity · RH2M"
              icon={Droplets}
              tooltip="Average 2-meter relative humidity (RH2M), indicating fungal disease pressure and evaporative demand."
            />
            <KpiCard
              label="Solar Radiation"
              value={
                nasaData.summary.avgSolarRadiationMj !== null
                  ? `${nasaData.summary.avgSolarRadiationMj.toFixed(1)} MJ/m²`
                  : '—'
              }
              subtitle="Daily All-Sky · ALLSKY_SFC_SW_DWN"
              icon={Sun}
              tooltip="Mean daily total photosynthetically active surface shortwave downward irradiance (ALLSKY_SFC_SW_DWN, MJ/m²/day)."
            />
            <KpiCard
              label="Mean Wind Speed"
              value={formatWindSpeed(nasaData.summary.avgWindSpeedMs, unitSystem)}
              subtitle="10m Wind Velocity · WS10M"
              icon={Wind}
              tooltip="Average 10-meter wind speed (WS10M), relevant to spray drift windows and canopy evapotranspiration."
            />
          </div>

          {/* Historical Daily Charts */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Daily Temperature Envelope */}
            <div className="rounded-xl border border-[#E4E2DA] bg-white p-5">
              <div className="border-b border-[#ECEAE3] pb-3">
                <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-[#14221A]">
                  <span>Daily Temperature Envelope ({tempUnit})</span>
                  <MetricTooltip
                    label="NASA POWER Daily Temperature"
                    description="Daily mean (T2M), daytime high (T2M_MAX), and overnight low (T2M_MIN) 2-meter air temperature."
                  />
                </h2>
                <p className="text-xs text-[#6B7970]">
                  T2M, T2M_MAX, T2M_MIN · NASA POWER HISTORICAL · {nasaData.startDate} to{' '}
                  {nasaData.endDate}
                </p>
              </div>
              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={nasaChartRows}
                    margin={{ top: 10, right: 12, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ECEAE3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#5F6E65' }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={22}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#5F6E65' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [`${value ?? '—'} ${tempUnit}`]}
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid #E4E2DA',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line
                      type="monotone"
                      dataKey="t2mMax"
                      name={`Max (${tempUnit})`}
                      stroke="#C27803"
                      strokeWidth={1.75}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="t2m"
                      name={`Mean (${tempUnit})`}
                      stroke="#154734"
                      strokeWidth={2.25}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="t2mMin"
                      name={`Min (${tempUnit})`}
                      stroke="#5B8C74"
                      strokeWidth={1.75}
                      strokeDasharray="4 4"
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Daily Rainfall & Humidity */}
            <div className="rounded-xl border border-[#E4E2DA] bg-white p-5">
              <div className="border-b border-[#ECEAE3] pb-3">
                <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-[#14221A]">
                  <span>Daily Rainfall ({rainUnit}) &amp; Humidity (%)</span>
                  <MetricTooltip
                    label="Rainfall & Relative Humidity"
                    description="Daily precipitation (PRECTOTCORR) paired with 2m relative humidity (RH2M) for moisture and disease risk assessment."
                  />
                </h2>
                <p className="text-xs text-[#6B7970]">
                  PRECTOTCORR &amp; RH2M · NASA POWER HISTORICAL · {nasaData.startDate} to{' '}
                  {nasaData.endDate}
                </p>
              </div>
              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={nasaChartRows}
                    margin={{ top: 10, right: 6, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ECEAE3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#5F6E65' }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={22}
                    />
                    <YAxis
                      yAxisId="rain"
                      tick={{ fontSize: 11, fill: '#5F6E65' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="rh"
                      orientation="right"
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: '#5F6E65' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid #E4E2DA',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar
                      yAxisId="rain"
                      dataKey="rainfall"
                      name={`Rainfall (${rainUnit})`}
                      fill="#154734"
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Line
                      yAxisId="rh"
                      type="monotone"
                      dataKey="humidity"
                      name="Humidity (%)"
                      stroke="#2E8B57"
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
          <div className="rounded-xl border border-[#E4E2DA] bg-white p-5">
            <div className="border-b border-[#ECEAE3] pb-3">
              <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-[#14221A]">
                <span>Solar Radiation (MJ/m²/day) &amp; Wind Speed ({windUnit})</span>
                <MetricTooltip
                  label="Solar Radiation & Wind"
                  description="All-sky surface shortwave radiation (ALLSKY_SFC_SW_DWN) driving crop photosynthesis alongside 10-meter wind speed (WS10M)."
                />
              </h2>
              <p className="text-xs text-[#6B7970]">
                ALLSKY_SFC_SW_DWN &amp; WS10M · NASA POWER HISTORICAL · {nasaData.startDate} to{' '}
                {nasaData.endDate}
              </p>
            </div>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={nasaChartRows}
                  margin={{ top: 10, right: 6, left: -12, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECEAE3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#5F6E65' }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={22}
                  />
                  <YAxis
                    yAxisId="solar"
                    tick={{ fontSize: 11, fill: '#5F6E65' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="wind"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#5F6E65' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid #E4E2DA',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area
                    yAxisId="solar"
                    type="monotone"
                    dataKey="solar"
                    name="Solar (MJ/m²/d)"
                    fill="#E6EFE9"
                    stroke="#2E8B57"
                    strokeWidth={2}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="wind"
                    type="monotone"
                    dataKey="windSpeed"
                    name={`Wind (${windUnit})`}
                    stroke="#C27803"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* NASA POWER Daily Observations Table */}
          <div className="overflow-hidden rounded-xl border border-[#E4E2DA] bg-white">
            <div className="flex flex-col gap-1 border-b border-[#ECEAE3] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-base font-semibold text-[#14221A]">
                NASA POWER Daily Meteorological Log
              </h2>
              <span className="text-xs text-[#6B7970]">
                {nasaData.observations.length} daily records · NASA POWER (AG) · HISTORICAL
              </span>
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 bg-[#FAFAF7]">
                  <tr className="border-b border-[#ECEAE3] text-[#6B7970]">
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 text-right font-medium">Mean ({tempUnit})</th>
                    <th className="px-4 py-2.5 text-right font-medium">Min / Max</th>
                    <th className="px-4 py-2.5 text-right font-medium">Rain ({rainUnit})</th>
                    <th className="px-4 py-2.5 text-right font-medium">RH (%)</th>
                    <th className="px-4 py-2.5 text-right font-medium">Solar (MJ/m²)</th>
                    <th className="px-4 py-2.5 text-right font-medium">Wind ({windUnit})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECEAE3] font-mono tabular-nums">
                  {nasaData.observations.map((obs) => (
                    <tr key={obs.dateKey} className="hover:bg-[#FAFAF7]">
                      <td className="px-4 py-2 font-sans font-medium text-[#14221A] whitespace-nowrap">
                        {obs.displayDate}
                      </td>
                      <td className="px-4 py-2 text-right text-[#14221A]">
                        {obs.t2m !== null ? `${convertTempValue(obs.t2m, unitSystem)}°` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-[#4B5B51] whitespace-nowrap">
                        {obs.t2mMin !== null && obs.t2mMax !== null
                          ? `${convertTempValue(obs.t2mMin, unitSystem)}° / ${convertTempValue(
                              obs.t2mMax,
                              unitSystem
                            )}°`
                          : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-[#154734]">
                        {obs.precipitationMm !== null
                          ? convertRainfallValue(obs.precipitationMm, unitSystem)
                          : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-[#4B5B51]">
                        {obs.humidityPct !== null ? `${obs.humidityPct.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-[#14221A]">
                        {obs.solarRadiationMj !== null ? obs.solarRadiationMj.toFixed(1) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-[#4B5B51]">
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
      <section aria-label="Seasonal demonstration baseline" className="space-y-4 border-t border-[#E1E8E2] pt-6">
        <div className="flex flex-col gap-2 rounded-xl border border-[#E1E8E2] bg-[#F7F8F5] px-4 py-3 text-xs text-[#65736B] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#174C3C]" aria-hidden="true" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[#17231E]">
                  Seasonal Water Balance &amp; GDD Reference
                </span>
                <DataClassificationBadge category="demo" />
              </div>
              <p className="mt-1">
                Annualized ET0, frost-free growing window, and monthly degree-day baseline modeled locally for seasonal water comparisons.
              </p>
            </div>
          </div>
          <DateRangeFilter value={dateRange} onChange={onChangeDateRange} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label={`Baseline Precip (${rangeLabel})`}
            value={formatRainfall(summary.totalRainfallMm, unitSystem)}
            icon={Droplets}
            tooltip="Demonstration annualized precipitation across the selected month window."
          />
          <KpiCard
            label={`Baseline Mean Temp (${rangeLabel})`}
            value={formatTemp(summary.meanTempC, unitSystem)}
            icon={ThermometerSun}
            tooltip="Demonstration mean monthly air temperature across the filtered seasonal window."
          />
          <KpiCard
            label="Frost-Free Window"
            value={`${climate.frostFreeDays} days`}
            icon={CloudSun}
            tooltip="Estimated annual freeze-free growing season length used to verify crop maturity fit."
          />
          <KpiCard
            label={`Cumulative GDD (${rangeLabel})`}
            value={totalGdd.toLocaleString()}
            icon={ThermometerSun}
            tooltip="Growing Degree Days (Base 10°C) accumulated within the selected date window."
          />
        </div>

        <div className="rounded-xl border border-[#E4E2DA] bg-white p-5">
          <div className="border-b border-[#ECEAE3] pb-3">
            <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-[#14221A]">
              <span>Seasonal Precipitation vs Evapotranspiration ({rainUnit})</span>
              <MetricTooltip
                label="Water Balance Ratio"
                description="Months where evapotranspiration exceeds precipitation indicate net soil moisture drawdown requiring irrigation or residue cover."
              />
            </h2>
            <p className="text-xs text-[#6B7970]">
              DEMONSTRATION · Highlights seasonal moisture surplus or irrigation requirement periods · {rangeLabel}
            </p>
          </div>
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={seasonalChartRows} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEAE3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#5F6E65' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#5F6E65' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value) => [`${value ?? ''} ${rainUnit}`]}
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid #E4E2DA',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="rainfall" name={`Precipitation (${rainUnit})`} fill="#154734" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Line
                  type="monotone"
                  dataKey="et0"
                  name={`Evapotranspiration (${rainUnit})`}
                  stroke="#C27803"
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
