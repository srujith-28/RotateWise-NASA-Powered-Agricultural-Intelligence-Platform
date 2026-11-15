import { CloudRain, Thermometer } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { convertRainfallValue, convertTempValue } from '../../lib/agronomy';
import type { ClimateMonthPoint } from '../../types/rotatewise';
import { MetricTooltip } from '../common/MetricTooltip';

interface ChartProps {
  monthly: ClimateMonthPoint[];
  unitSystem: 'imperial' | 'metric';
  rangeLabel: string;
}

export function RainfallTrendChart({ monthly, unitSystem, rangeLabel }: ChartProps) {
  const rainUnit = unitSystem === 'imperial' ? 'in' : 'mm';
  const data = monthly.map((m) => ({
    month: m.month,
    rainfall: convertRainfallValue(m.rainfallMm, unitSystem),
    baseline: convertRainfallValue(m.baselineRainfallMm, unitSystem),
  }));

  return (
    <div className="rounded-xl border border-[#E4E2DA] bg-white p-5 shadow-[0_1px_2px_rgba(18,43,29,0.03)]">
      <div className="flex items-center justify-between border-b border-[#ECEAE3] pb-3">
        <div>
          <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-[#14221A]">
            <span>Monthly Rainfall Trend ({rainUnit})</span>
            <MetricTooltip
              label="Monthly Rainfall Trend"
              description="Compares observed seasonal precipitation against the historical multi-year baseline for the selected window."
            />
          </h2>
          <p className="text-xs text-[#6B7970]">
            Observed seasonal curve vs historical baseline · {rangeLabel}
          </p>
        </div>
        <CloudRain className="h-4 w-4 text-[#2E8B57]" aria-hidden="true" />
      </div>
      <div className="mt-4 h-64 w-full" data-testid="rainfall-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
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
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }} />
            <Bar dataKey="rainfall" name={`Rainfall (${rainUnit})`} fill="#154734" radius={[4, 4, 0, 0]} />
            <Bar dataKey="baseline" name={`Baseline (${rainUnit})`} fill="#A9CDB7" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function TemperatureTrendChart({ monthly, unitSystem, rangeLabel }: ChartProps) {
  const tempUnit = unitSystem === 'imperial' ? '°F' : '°C';
  const data = monthly.map((m) => ({
    month: m.month,
    tempAvg: convertTempValue(m.tempAvgC, unitSystem),
    tempMax: convertTempValue(m.tempMaxC, unitSystem),
    tempMin: convertTempValue(m.tempMinC, unitSystem),
  }));

  return (
    <div className="rounded-xl border border-[#E4E2DA] bg-white p-5 shadow-[0_1px_2px_rgba(18,43,29,0.03)]">
      <div className="flex items-center justify-between border-b border-[#ECEAE3] pb-3">
        <div>
          <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-[#14221A]">
            <span>Temperature Trend ({tempUnit})</span>
            <MetricTooltip
              label="Temperature Envelope"
              description="Displays monthly daytime highs, mean temperature, and overnight lows to evaluate frost risk and heat stress."
            />
          </h2>
          <p className="text-xs text-[#6B7970]">
            Monthly mean, daytime high, and overnight low · {rangeLabel}
          </p>
        </div>
        <Thermometer className="h-4 w-4 text-[#2E8B57]" aria-hidden="true" />
      </div>
      <div className="mt-4 h-64 w-full" data-testid="temperature-chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ECEAE3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#5F6E65' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#5F6E65' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value) => [`${value ?? ''} ${tempUnit}`]}
              contentStyle={{
                borderRadius: '10px',
                border: '1px solid #E4E2DA',
                fontSize: '12px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }} />
            <Area
              type="monotone"
              dataKey="tempMax"
              name={`Max (${tempUnit})`}
              stroke="#C27803"
              fill="#FDE68A"
              fillOpacity={0.28}
              strokeWidth={1.5}
            />
            <Area
              type="monotone"
              dataKey="tempAvg"
              name={`Mean (${tempUnit})`}
              stroke="#154734"
              fill="#2E8B57"
              fillOpacity={0.18}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="tempMin"
              name={`Min (${tempUnit})`}
              stroke="#5E8B7E"
              fill="transparent"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
