import {
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
import type { ScenarioSimulationResult } from '../../types/rotatewise';

interface ScenarioComparisonChartsProps {
  result: ScenarioSimulationResult;
  unitSystem: 'imperial' | 'metric';
}

export function ScenarioComparisonCharts({
  result,
  unitSystem,
}: ScenarioComparisonChartsProps) {
  if (
    result.status !== 'ready' ||
    !result.baselineClimate ||
    !result.simulatedClimate ||
    !result.primaryBaselineEval ||
    !result.primarySimulatedEval
  ) {
    return null;
  }

  const base = result.baselineClimate;
  const sim = result.simulatedClimate;
  const isImp = unitSystem === 'imperial';

  const rainUnit = isImp ? 'in' : 'mm';
  const tempUnit = isImp ? '°F' : '°C';
  const convertRain = (mm: number) => convertRainfallValue(mm, unitSystem);
  const convertTemp = (c: number) => convertTempValue(c, unitSystem);

  // 1. Rainfall Comparison Chart
  const rainfallChartData = [
    {
      label: `Total (${base.validDayCount}d)`,
      Baseline: convertRain(base.totalRainfallMm),
      Simulated: convertRain(sim.totalRainfallMm),
    },
    ...(sim.rainwaterHarvestingBonusMm > 0
      ? [
          {
            label: 'With Runoff Capture',
            Baseline: convertRain(base.totalRainfallMm),
            Simulated: convertRain(sim.totalRainfallMm + sim.rainwaterHarvestingBonusMm),
          },
        ]
      : []),
  ];

  // 2. Temperature Comparison Chart
  const tempChartData = [
    ...(base.minTempC !== null && sim.minTempC !== null
      ? [
          {
            metric: 'Min Temp',
            Baseline: convertTemp(base.minTempC),
            Simulated: convertTemp(sim.minTempC),
          },
        ]
      : []),
    {
      metric: 'Mean Temp',
      Baseline: convertTemp(base.meanTempC),
      Simulated: convertTemp(sim.meanTempC),
    },
    ...(base.maxTempC !== null && sim.maxTempC !== null
      ? [
          {
            metric: 'Peak Temp',
            Baseline: convertTemp(base.maxTempC),
            Simulated: convertTemp(sim.maxTempC),
          },
        ]
      : []),
  ];

  // 3. Crop Suitability Comparison Chart (Primary + Selected Alternatives)
  const targetCropIds = [
    result.config.primaryCropId,
    ...result.config.comparedAlternativeCropIds,
  ];
  const selectedDeltas = targetCropIds
    .map((id) => result.allCropDeltas.find((d) => d.cropId === id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  const suitabilityChartData = selectedDeltas.map((d) => ({
    crop: d.cropName,
    Baseline: d.baselineScore,
    Simulated: d.simulatedScore,
  }));

  // 4. Water Availability Comparison Chart
  const primaryCrop = result.primarySimulatedEval.crop;
  const waterChartData = [
    {
      metric: 'Effective Supply',
      Baseline: convertRain(base.effectiveAvailableWaterMm),
      Simulated: convertRain(sim.effectiveAvailableWaterMm),
    },
    {
      metric: 'Min Need',
      Baseline: convertRain(primaryCrop.waterNeedMm[0]),
      Simulated: convertRain(primaryCrop.waterNeedMm[0]),
    },
    {
      metric: 'Max Need',
      Baseline: convertRain(primaryCrop.waterNeedMm[1]),
      Simulated: convertRain(primaryCrop.waterNeedMm[1]),
    },
  ];

  return (
    <section
      aria-label="Baseline versus scenario comparison charts"
      className="grid grid-cols-1 gap-5 lg:grid-cols-2"
    >
      {/* 1. Rainfall Comparison Chart */}
      <div className="rounded-2xl border border-[#E7EBE7] bg-white p-5">
        <h3 className="font-display text-sm font-semibold text-[#18231E]">
          Rainfall Comparison ({rainUnit})
        </h3>
        <p className="mt-0.5 text-xs text-[#737D76]">
          Historical NASA POWER baseline vs. hypothetical {result.config.rainfallDeltaPct >= 0 ? `+${result.config.rainfallDeltaPct}` : result.config.rainfallDeltaPct}% scenario
        </p>
        <div className="mt-3 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rainfallChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#EEF1EE" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#737D76' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#737D76' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(val) => [`${val ?? 0} ${rainUnit}`]}
                contentStyle={{ borderRadius: '12px', border: '1px solid #E7EBE7', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="Baseline" name="Historical Baseline" fill="#B9CEC0" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="Simulated" name="Simulated Scenario" fill="#174C3C" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Temperature Comparison Chart */}
      <div className="rounded-2xl border border-[#E7EBE7] bg-white p-5">
        <h3 className="font-display text-sm font-semibold text-[#18231E]">
          Temperature Comparison ({tempUnit})
        </h3>
        <p className="mt-0.5 text-xs text-[#737D76]">
          Historical NASA POWER temperatures vs. hypothetical {result.config.temperatureShiftC >= 0 ? `+${result.config.temperatureShiftC}` : result.config.temperatureShiftC}°C shift
        </p>
        <div className="mt-3 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tempChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#EEF1EE" vertical={false} />
              <XAxis dataKey="metric" tick={{ fontSize: 11, fill: '#737D76' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#737D76' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(val) => [`${val ?? 0} ${tempUnit}`]}
                contentStyle={{ borderRadius: '12px', border: '1px solid #E7EBE7', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="Baseline" name="Historical Baseline" fill="#B9CEC0" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="Simulated" name="Simulated Scenario" fill="#B45309" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Crop Suitability Comparison Chart */}
      <div className="rounded-2xl border border-[#E7EBE7] bg-white p-5">
        <h3 className="font-display text-sm font-semibold text-[#18231E]">
          Crop Suitability Comparison (0–100)
        </h3>
        <p className="mt-0.5 text-xs text-[#737D76]">
          Deterministic suitability score baseline vs. simulated conditions for primary &amp; alternative crops
        </p>
        <div className="mt-3 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={suitabilityChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#EEF1EE" vertical={false} />
              <XAxis dataKey="crop" tick={{ fontSize: 11, fill: '#737D76' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#737D76' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(val) => [`${val ?? 0}/100`]}
                contentStyle={{ borderRadius: '12px', border: '1px solid #E7EBE7', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="Baseline" name="Baseline Score" fill="#B9CEC0" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="Simulated" name="Simulated Score" fill="#287A5A" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Water Availability Comparison Chart */}
      <div className="rounded-2xl border border-[#E7EBE7] bg-white p-5">
        <h3 className="font-display text-sm font-semibold text-[#18231E]">
          Water Availability vs. Crop Requirement ({rainUnit})
        </h3>
        <p className="mt-0.5 text-xs text-[#737D76]">
          Effective supply (rainfall + {sim.effectiveIrrigation}{sim.rainwaterHarvestingBonusMm > 0 ? ' + rainwater capture' : ''}) vs. {primaryCrop.name} seasonal demand
        </p>
        <div className="mt-3 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={waterChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#EEF1EE" vertical={false} />
              <XAxis dataKey="metric" interval={0} tick={{ fontSize: 11, fill: '#737D76' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#737D76' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(val) => [`${val ?? 0} ${rainUnit}`]}
                contentStyle={{ borderRadius: '12px', border: '1px solid #E7EBE7', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="Baseline" name="Baseline Reference" fill="#B9CEC0" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="Simulated" name="Simulated Scenario" fill="#174C3C" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
