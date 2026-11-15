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

const TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: '1px solid #E7EBE7',
  backgroundColor: '#FFFFFF',
  boxShadow: '0 10px 26px rgba(20, 37, 29, 0.10)',
  fontSize: '12px',
  color: '#18231E',
};

export function RainfallTrendChart({ monthly, unitSystem, rangeLabel }: ChartProps) {
  const rainUnit = unitSystem === 'imperial' ? 'in' : 'mm';
  const data = monthly.map((m) => ({
    month: m.month,
    rainfall: convertRainfallValue(m.rainfallMm, unitSystem),
    baseline: convertRainfallValue(m.baselineRainfallMm, unitSystem),
  }));

  return (
    <div className="rounded-2xl border border-[#E7EBE7] bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between border-b border-[#E7EBE7] pb-4">
        <div>
          <h2 className="flex items-center gap-1.5 font-display text-[17px] font-semibold tracking-[-0.015em] text-[#18231E]">
            <span>Monthly Rainfall Trend ({rainUnit})</span>
            <MetricTooltip
              label="Monthly Rainfall Trend"
              description="Compares observed seasonal precipitation against the historical multi-year baseline for the selected window."
            />
          </h2>
          <p className="mt-0.5 text-xs text-[#737D76]">
            Observed seasonal curve vs historical baseline · {rangeLabel}
          </p>
        </div>
        <CloudRain className="h-4 w-4 shrink-0 text-[#287A5A]" aria-hidden="true" />
      </div>
      <div className="mt-5 h-64 w-full" data-testid="rainfall-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }} barGap={4}>
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
              contentStyle={TOOLTIP_STYLE}
              cursor={{ fill: '#F7F8F6' }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px', color: '#737D76' }} />
            <Bar
              dataKey="rainfall"
              name={`Rainfall (${rainUnit})`}
              fill="#174C3C"
              radius={[6, 6, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="baseline"
              name={`Baseline (${rainUnit})`}
              fill="#B9CEC0"
              radius={[6, 6, 0, 0]}
              isAnimationActive={false}
            />
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
    <div className="rounded-2xl border border-[#E7EBE7] bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between border-b border-[#E7EBE7] pb-4">
        <div>
          <h2 className="flex items-center gap-1.5 font-display text-[17px] font-semibold tracking-[-0.015em] text-[#18231E]">
            <span>Temperature Trend ({tempUnit})</span>
            <MetricTooltip
              label="Temperature Envelope"
              description="Displays monthly daytime highs, mean temperature, and overnight lows to evaluate frost risk and heat stress."
            />
          </h2>
          <p className="mt-0.5 text-xs text-[#737D76]">
            Monthly mean, daytime high, and overnight low · {rangeLabel}
          </p>
        </div>
        <Thermometer className="h-4 w-4 shrink-0 text-[#287A5A]" aria-hidden="true" />
      </div>
      <div className="mt-5 h-64 w-full" data-testid="temperature-chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
            <defs>
              <linearGradient id="rwMeanTempGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#287A5A" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#287A5A" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              formatter={(value) => [`${value ?? ''} ${tempUnit}`]}
              contentStyle={TOOLTIP_STYLE}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px', color: '#737D76' }} />
            <Area
              type="monotone"
              dataKey="tempMax"
              name={`Max (${tempUnit})`}
              stroke="#B45309"
              fill="#FDE68A"
              fillOpacity={0.16}
              strokeWidth={1.6}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="tempAvg"
              name={`Mean (${tempUnit})`}
              stroke="#174C3C"
              fill="url(#rwMeanTempGrad)"
              strokeWidth={2.2}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="tempMin"
              name={`Min (${tempUnit})`}
              stroke="#6F8E7D"
              fill="transparent"
              strokeDasharray="4 4"
              strokeWidth={1.6}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
