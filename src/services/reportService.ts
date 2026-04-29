import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

interface ReportData {
  farmName: string;
  location: string;
  owner: string;
  manager: string;
  totalRains: number;
  totalExpenses: number;
  totalIncomes: number;
  balance: number;
  expenses: any[];
  incomes: any[];
  rains: any[];
  animals: any[];
  period: { start: string; end: string };
}

export const reportService = {
  generatePDFReport(data: ReportData) {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 10;

    // Header
    doc.setFontSize(20);
    doc.text('AgroGestión - Reporte', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    doc.setFontSize(10);
    doc.text(`${data.farmName} - ${data.location}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    doc.text(`Período: ${data.period.start} a ${data.period.end}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Farm Info
    doc.setFontSize(12);
    doc.text('Información del Establecimiento', 10, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.text(`Dueño: ${data.owner || '-'}`, 10, yPos);
    yPos += 6;
    doc.text(`Encargado: ${data.manager || '-'}`, 10, yPos);
    yPos += 12;

    // Financial Summary
    doc.setFontSize(12);
    doc.text('Resumen Financiero', 10, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.text(`Ingresos: $${data.totalIncomes.toLocaleString('es-AR')}`, 10, yPos);
    yPos += 6;
    doc.text(`Gastos: $${data.totalExpenses.toLocaleString('es-AR')}`, 10, yPos);
    yPos += 6;
    doc.setTextColor(data.balance >= 0 ? 16, 185, 129 : 239, 68, 68);
    doc.text(`Balance: $${data.balance.toLocaleString('es-AR')}`, 10, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 12;

    // Data Tables
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = 10;
    }

    // Expenses Table
    if (data.expenses.length > 0) {
      doc.setFontSize(11);
      doc.text('Gastos Registrados', 10, yPos);
      yPos += 8;

      doc.setFontSize(9);
      const expenseTableData = data.expenses.map(e => [
        new Date(e.date).toLocaleDateString('es-AR'),
        e.category,
        e.description,
        `$${e.amount.toLocaleString('es-AR')}`
      ]);

      (doc as any).autoTable({
        startY: yPos,
        head: [['Fecha', 'Categoría', 'Descripción', 'Monto']],
        body: expenseTableData,
        theme: 'grid',
        margin: 10,
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Rains Summary
    if (data.rains.length > 0 && yPos < pageHeight - 30) {
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = 10;
      }

      doc.setFontSize(11);
      doc.text('Registro de Lluvias', 10, yPos);
      yPos += 8;

      doc.setFontSize(9);
      const rainTableData = data.rains.map(r => [
        new Date(r.date).toLocaleDateString('es-AR'),
        `${r.mm} mm`
      ]);

      (doc as any).autoTable({
        startY: yPos,
        head: [['Fecha', 'Milímetros']],
        body: rainTableData,
        theme: 'grid',
      });
    }

    return doc;
  },

  exportToExcel(data: ReportData) {
    const workbook = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      ['AgroGestión - Reporte'],
      [''],
      ['Establecimiento', data.farmName],
      ['Ubicación', data.location],
      ['Dueño', data.owner || '-'],
      ['Encargado', data.manager || '-'],
      ['Período', `${data.period.start} a ${data.period.end}`],
      [''],
      ['RESUMEN FINANCIERO'],
      ['Ingresos Totales', data.totalIncomes],
      ['Gastos Totales', data.totalExpenses],
      ['Balance', data.balance],
      ['Lluvia Total (mm)', data.totalRains],
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

    // Expenses Sheet
    if (data.expenses.length > 0) {
      const expenseData = [
        ['Fecha', 'Categoría', 'Descripción', 'Monto']
      ];
      data.expenses.forEach(exp => {
        expenseData.push([
          new Date(exp.date).toLocaleDateString('es-AR'),
          exp.category,
          exp.description,
          exp.amount
        ]);
      });

      const expenseSheet = XLSX.utils.aoa_to_sheet(expenseData);
      XLSX.utils.book_append_sheet(workbook, expenseSheet, 'Gastos');
    }

    // Incomes Sheet
    if (data.incomes.length > 0) {
      const incomeData = [
        ['Fecha', 'Categoría', 'Descripción', 'Monto']
      ];
      data.incomes.forEach(inc => {
        incomeData.push([
          new Date(inc.date).toLocaleDateString('es-AR'),
          inc.category,
          inc.description,
          inc.amount
        ]);
      });

      const incomeSheet = XLSX.utils.aoa_to_sheet(incomeData);
      XLSX.utils.book_append_sheet(workbook, incomeSheet, 'Ingresos');
    }

    // Rains Sheet
    if (data.rains.length > 0) {
      const rainData = [
        ['Fecha', 'Milímetros (mm)']
      ];
      data.rains.forEach(rain => {
        rainData.push([
          new Date(rain.date).toLocaleDateString('es-AR'),
          rain.mm
        ]);
      });

      const rainSheet = XLSX.utils.aoa_to_sheet(rainData);
      XLSX.utils.book_append_sheet(workbook, rainSheet, 'Lluvias');
    }

    return workbook;
  },

  downloadPDF(pdf: jsPDF, filename: string) {
    pdf.save(filename);
  },

  downloadExcel(workbook: XLSX.WorkBook, filename: string) {
    XLSX.writeFile(workbook, filename);
  },

  generateFilename(farmName: string, type: 'pdf' | 'xlsx'): string {
    const date = new Date().toISOString().split('T')[0];
    const sanitizedName = farmName.replace(/[^a-zA-Z0-9]/g, '_');
    return `${sanitizedName}_${date}.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
  }
};
