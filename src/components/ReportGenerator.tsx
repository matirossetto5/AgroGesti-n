import React, { useState } from 'react';
import { FileText, Download, BarChart3 } from 'lucide-react';
import { reportService } from '../services';

interface ReportGeneratorProps {
  farmName: string;
  farmData: {
    location: string;
    owner: string;
    manager: string;
    rains: any[];
    expenses: any[];
    incomes: any[];
    animals: any[];
  };
  startDate: string;
  endDate: string;
}

export default function ReportGenerator({ farmName, farmData, startDate, endDate }: ReportGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportType, setReportType] = useState<'pdf' | 'excel'>('pdf');

  const totalRains = farmData.rains.reduce((sum, r) => sum + (r.mm || 0), 0);
  const totalExpenses = farmData.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalIncomes = farmData.incomes.reduce((sum, i) => sum + (i.amount || 0), 0);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const reportData = {
        farmName,
        location: farmData.location,
        owner: farmData.owner,
        manager: farmData.manager,
        totalRains,
        totalExpenses,
        totalIncomes,
        balance: totalIncomes - totalExpenses,
        expenses: farmData.expenses,
        incomes: farmData.incomes,
        rains: farmData.rains,
        animals: farmData.animals,
        period: { start: startDate, end: endDate }
      };

      if (reportType === 'pdf') {
        const pdf = reportService.generatePDFReport(reportData);
        const filename = reportService.generateFilename(farmName, 'pdf');
        reportService.downloadPDF(pdf, filename);
      } else {
        const workbook = reportService.exportToExcel(reportData);
        const filename = reportService.generateFilename(farmName, 'xlsx');
        reportService.downloadExcel(workbook, filename);
      }
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-6 h-6 text-emerald-600" />
        <h3 className="text-xl font-semibold text-stone-900">Generar Reportes</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
          <p className="text-xs text-emerald-600 font-medium">Período</p>
          <p className="font-semibold text-stone-900">{startDate} - {endDate}</p>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs text-blue-600 font-medium">Lluvia Total</p>
          <p className="font-semibold text-stone-900">{totalRains.toFixed(1)} mm</p>
        </div>
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
          <p className="text-xs text-amber-600 font-medium">Balance</p>
          <p className={`font-semibold ${totalIncomes - totalExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${(totalIncomes - totalExpenses).toLocaleString('es-AR')}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">Formato de Reporte</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="pdf"
                checked={reportType === 'pdf'}
                onChange={(e) => setReportType(e.target.value as 'pdf')}
                className="w-4 h-4"
              />
              <span className="text-sm text-stone-700">PDF</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="excel"
                checked={reportType === 'excel'}
                onChange={(e) => setReportType(e.target.value as 'excel')}
                className="w-4 h-4"
              />
              <span className="text-sm text-stone-700">Excel</span>
            </label>
          </div>
        </div>

        <button
          onClick={handleGenerateReport}
          disabled={isGenerating}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Generando...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Generar {reportType.toUpperCase()}
            </>
          )}
        </button>
      </div>

      <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <p className="font-medium mb-1">💡 Información:</p>
        <p>Los reportes incluyen resumen financiero, gastos, ingresos, lluvia y datos de animales del período seleccionado.</p>
      </div>
    </div>
  );
}
