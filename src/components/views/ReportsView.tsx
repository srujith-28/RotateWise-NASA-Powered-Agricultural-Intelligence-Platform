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
            className="rounded-xl border border-[#E4E2DA] bg-white p-5 shadow-[0_1px_2px_rgba(18,43,29,0.03)]"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs text-[#6B7970]">
                  <FileText className="h-3.5 w-3.5 text-[#2E8B57]" aria-hidden="true" />
                  <span>{report.farmName}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{report.createdAt}</span>
                </div>
                <h2 className="mt-1 font-display text-base font-semibold text-[#14221A]">
                  {report.title}
                </h2>
                <p className="mt-1.5 text-sm text-[#4B5B51]">{report.summary}</p>
              </div>

              <button
                type="button"
                onClick={() => handleDownloadCsv(report)}
                className="no-print inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#D8D5CB] bg-white px-3 text-xs font-medium text-[#14221A] hover:bg-[#F6F5F0] whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Export CSV</span>
              </button>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-[#ECEAE3] pt-4 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-[#6B7970]">Rotation Efficiency</dt>
                <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[#154734]">
                  {report.rotationEfficiency}/100
                </dd>
              </div>
              <div>
                <dt className="text-[#6B7970]">Climate Suitability</dt>
                <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[#14221A]">
                  {report.climateSuitability}/100
                </dd>
              </div>
              <div>
                <dt className="text-[#6B7970]">Soil Health</dt>
                <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[#14221A]">
                  {report.soilHealthScore}/100
                </dd>
              </div>
              <div>
                <dt className="text-[#6B7970]">Top Next Crop</dt>
                <dd className="mt-0.5 text-sm font-semibold text-[#14221A]">
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
