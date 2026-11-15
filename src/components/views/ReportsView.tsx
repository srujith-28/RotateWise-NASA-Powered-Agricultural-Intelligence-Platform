import { Download, FilePlus2, FileText, Printer } from 'lucide-react';
import {
  calculateClimateSuitability,
  calculateRotationEfficiency,
  getRecommendedNextCrops,
} from '../../lib/agronomy';
import type {
  CropProfile,
  Farm,
  FarmClimateProfile,
  ReportRecord,
} from '../../types/rotatewise';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';

interface ReportsViewProps {
  farm: Farm | null;
  climate: FarmClimateProfile | null;
  cropCatalog: CropProfile[];
  reports: ReportRecord[];
  onCreateReport: (report: ReportRecord) => void;
  onToast?: (message: string, tone?: 'success' | 'info' | 'warning') => void;
}

export function ReportsView({
  farm,
  climate,
  cropCatalog,
  reports,
  onCreateReport,
  onToast,
}: ReportsViewProps) {
  const handleGenerateSnapshot = () => {
    if (!farm || !climate) return;
    const currentCrop =
      cropCatalog.find((c) => c.id === farm.currentCropId) ?? cropCatalog[0];
    const rotationEval = calculateRotationEfficiency(farm.rotationPlan, cropCatalog, farm);
    const climateScore = calculateClimateSuitability(
      currentCrop,
      climate,
      farm.irrigation
    );
    const recs = getRecommendedNextCrops(farm, climate, cropCatalog);

    const newReport: ReportRecord = {
      id: `rep-${Date.now()}`,
      title: `${farm.name} Agronomic Planning Summary`,
      farmId: farm.id,
      farmName: farm.name,
      createdAt: new Date().toISOString().slice(0, 10),
      rotationEfficiency: rotationEval.efficiencyScore,
      climateSuitability: climateScore,
      soilHealthScore: farm.health.soilHealthScore,
      recommendedCrop: recs[0]?.crop.name ?? 'Soybeans',
      summary: `${farm.landAreaAcres} ac (${farm.soilType}, ${farm.irrigation}). Top next crop: ${recs[0]?.crop.name ?? 'Soybeans'} (${recs[0]?.suitabilityScore ?? 85}/100 suitability).`,
    };

    onCreateReport(newReport);
    onToast?.(`Generated agronomic snapshot report for ${farm.name}.`, 'success');
  };

  const handleDownloadCsv = (report: ReportRecord) => {
    const headers = [
      'Title',
      'Farm',
      'Date',
      'RotationEfficiency',
      'ClimateSuitability',
      'SoilHealthScore',
      'RecommendedCrop',
      'Summary',
    ];
    const row = [
      report.title,
      report.farmName,
      report.createdAt,
      String(report.rotationEfficiency),
      String(report.climateSuitability),
      String(report.soilHealthScore),
      report.recommendedCrop,
      report.summary.replaceAll('"', '""'),
    ];
    const csv = `${headers.join(',')}\n"${row.join('","')}"`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.id}-rotatewise-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onToast?.(`Exported "${report.title}" as CSV.`, 'info');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Reports"
        title="Reports"
        subtitle="Generate, inspect, and export agronomic rotation & climate readiness reports."
        actions={
          <div className="flex items-center gap-2.5 no-print">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden="true" />
              <span>Print View</span>
            </Button>
            <Button
              variant="primary"
              onClick={handleGenerateSnapshot}
              disabled={!farm}
            >
              <FilePlus2 className="h-4 w-4" aria-hidden="true" />
              <span>Generate Report</span>
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        {reports.map((report) => (
          <article
            key={report.id}
            className="rounded-2xl border border-[#E7EBE7] bg-white p-5 sm:p-6"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs text-[#737D76]">
                  <FileText className="h-3.5 w-3.5 text-[#174C3C]" aria-hidden="true" />
                  <span>{report.farmName}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{report.createdAt}</span>
                </div>
                <h2 className="mt-1.5 font-display text-base font-semibold tracking-[-0.015em] text-[#18231E]">
                  {report.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[#737D76]">{report.summary}</p>
              </div>

              <button
                type="button"
                onClick={() => handleDownloadCsv(report)}
                className="no-print inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[#E7EBE7] bg-white px-3.5 text-xs font-medium text-[#18231E] transition-colors hover:bg-[#F7F8F6] whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5 text-[#174C3C]" aria-hidden="true" />
                <span>Export CSV</span>
              </button>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-[#E7EBE7] pt-4 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-[#737D76]">Rotation Efficiency</dt>
                <dd className="mt-1 font-mono text-sm font-semibold tabular-nums text-[#174C3C]">
                  {report.rotationEfficiency}/100
                </dd>
              </div>
              <div>
                <dt className="text-[#737D76]">Climate Suitability</dt>
                <dd className="mt-1 font-mono text-sm font-semibold tabular-nums text-[#18231E]">
                  {report.climateSuitability}/100
                </dd>
              </div>
              <div>
                <dt className="text-[#737D76]">Soil Health</dt>
                <dd className="mt-1 font-mono text-sm font-semibold tabular-nums text-[#18231E]">
                  {report.soilHealthScore}/100
                </dd>
              </div>
              <div>
                <dt className="text-[#737D76]">Top Next Crop</dt>
                <dd className="mt-1 text-sm font-semibold text-[#18231E]">
                  {report.recommendedCrop}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
