import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0));
}

export function exportEntriesPdf({
  entries = [],
  selectedUser = 'all',
  selectedMonth = 'all',
  visibleUserLabel = 'All Users',
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  const generatedDate = new Date().toLocaleDateString();

  const totals = entries.reduce(
    (acc, entry) => {
      acc.hours += Number(entry.hours || 0);
      acc.client += Number(entry.totalPay || 0);
      acc.internal += Number(entry.internalTotal || 0);
      return acc;
    },
    { hours: 0, client: 0, internal: 0 }
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Positive Adversity Youth Services Inc.', 40, 50);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Allan@PositiveAdversity.org', 40, 68);
  doc.text('www.positiveadversity.org', 40, 82);
  doc.text('(860) 625-6656', 40, 96);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Work Session Report', 40, 128);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Generated: ${generatedDate}`, 40, 145);
  doc.text(`Staff: ${visibleUserLabel}`, 40, 160);
  doc.text(
    `Month: ${selectedMonth === 'all' ? 'All Months' : selectedMonth}`,
    40,
    175
  );
  doc.text(`Entries: ${entries.length}`, 40, 190);

  const rows = entries.map((entry) => [
    entry.date || '-',
    entry.student || '-',
    entry.serviceType || '-',
    Number(entry.hours || 0).toFixed(2),
    formatCurrency(entry.totalPay),
    formatCurrency(entry.internalTotal),
    entry.userName || entry.userEmail || '-',
    entry.note || '-',
  ]);

  autoTable(doc, {
    startY: 210,
    head: [[
      'Date',
      'Student',
      'Service Type',
      'Hours',
      'Client Total',
      'Internal Total',
      'Staff',
      'Note',
    ]],
    body: rows,
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 5,
      valign: 'top',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [31, 41, 55],
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 70 },
      2: { cellWidth: 75 },
      3: { halign: 'right', cellWidth: 42 },
      4: { halign: 'right', cellWidth: 60 },
      5: { halign: 'right', cellWidth: 65 },
      6: { cellWidth: 60 },
      7: { cellWidth: 110 },
    },
    margin: { left: 30, right: 30 },
    didDrawPage: () => {
      const pageSize = doc.internal.pageSize;
      const pageWidth = pageSize.width;
      const pageHeight = pageSize.height;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - 65, pageHeight - 20);
    },
  });

  const finalY = doc.lastAutoTable?.finalY || 210;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Totals', 40, finalY + 25);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Total Hours: ${totals.hours.toFixed(2)}`, 40, finalY + 42);
  doc.text(`Client Total: ${formatCurrency(totals.client)}`, 40, finalY + 57);
  doc.text(`Internal Total: ${formatCurrency(totals.internal)}`, 40, finalY + 72);

  const safeUser = visibleUserLabel
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '');

  const safeMonth = (selectedMonth === 'all' ? 'all_months' : selectedMonth)
    .replace(/[^a-z0-9_-]+/gi, '_');

  const filename = `positive_adversity_report_${safeUser || 'all_users'}_${safeMonth}.pdf`;
  doc.save(filename);
}