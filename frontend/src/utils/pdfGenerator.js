import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from './money';
import { formatDate } from './date';

/**
 * Generates and downloads a clean, professional Tax Invoice PDF
 */
export function generateInvoicePDF(bill, settings = {}) {
  const doc = new jsPDF();

  const shopName = settings.shop_name || 'Vikas Super Market';
  const shopAddress = settings.address || '124 Main Street, Commercial Hub, Mumbai';
  const shopPhone = settings.phone || '022-28471920';
  const gstNo = settings.gst_number || 'GSTIN27AABCU9603R1ZM';
  const footerText = settings.invoice_footer || 'Thank you for shopping with us! Visit again.';

  // 1. Header & Shop Details
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(shopName, 14, 20);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(shopAddress, 14, 26);
  doc.text(`Phone: ${shopPhone} | GSTIN: ${gstNo}`, 14, 31);

  // 2. Invoice Details Box
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 36, 196, 36);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text('TAX INVOICE', 14, 45);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  // Left: Customer Info
  doc.setFont('helvetica', 'bold');
  doc.text('Billed To:', 14, 53);
  doc.setFont('helvetica', 'normal');
  doc.text(bill.customer_name || 'Walk-in Customer', 14, 58);
  if (bill.customer_phone) doc.text(`Phone: ${bill.customer_phone}`, 14, 63);
  if (bill.customer_address) doc.text(`Address: ${bill.customer_address}`, 14, 68);

  // Right: Invoice Metadata
  const rightX = 135;
  doc.setFont('helvetica', 'bold');
  doc.text(`Invoice No:`, rightX, 53);
  doc.setFont('helvetica', 'normal');
  doc.text(bill.bill_no, rightX + 25, 53);

  doc.setFont('helvetica', 'bold');
  doc.text(`Date:`, rightX, 58);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(bill.bill_date), rightX + 25, 58);

  doc.setFont('helvetica', 'bold');
  doc.text(`Payment Mode:`, rightX, 63);
  doc.setFont('helvetica', 'normal');
  doc.text(bill.payment_mode || 'CASH', rightX + 25, 63);

  doc.setFont('helvetica', 'bold');
  doc.text(`Status:`, rightX, 68);
  doc.setFont('helvetica', 'normal');
  doc.text(bill.status, rightX + 25, 68);

  // 3. Table of items
  const tableData = (bill.items || []).map((item, index) => [
    index + 1,
    item.product_name,
    formatCurrency(item.rate),
    item.qty,
    `${item.gst_percent || 0}%`,
    formatCurrency(item.amount)
  ]);

  autoTable(doc, {
    startY: 75,
    head: [['#', 'Description of Goods', 'Rate', 'Qty', 'GST %', 'Amount']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 35, halign: 'right' }
    }
  });

  // 4. Totals Calculation Summary
  const finalY = doc.lastAutoTable.finalY + 8;
  const summaryX = 120;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  doc.text('Subtotal:', summaryX, finalY);
  doc.text(formatCurrency(bill.subtotal), 195, finalY, { align: 'right' });

  if (Number(bill.discount) > 0) {
    doc.text('Discount:', summaryX, finalY + 6);
    doc.text(`-${formatCurrency(bill.discount)}`, 195, finalY + 6, { align: 'right' });
  }

  doc.text('GST Tax:', summaryX, finalY + 12);
  doc.text(`+${formatCurrency(bill.tax)}`, 195, finalY + 12, { align: 'right' });

  doc.setLineWidth(0.3);
  doc.setDrawColor(203, 213, 225);
  doc.line(summaryX, finalY + 16, 196, finalY + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('Total Amount:', summaryX, finalY + 22);
  doc.text(formatCurrency(bill.total_amount), 195, finalY + 22, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(16, 185, 129);
  doc.text('Amount Paid:', summaryX, finalY + 29);
  doc.text(formatCurrency(bill.amount_paid), 195, finalY + 29, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(217, 119, 6);
  doc.text('Amount Pending:', summaryX, finalY + 35);
  doc.text(formatCurrency(bill.amount_pending), 195, finalY + 35, { align: 'right' });

  // 5. Footer & Signatory Box
  const footerY = Math.max(finalY + 45, 250);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(148, 163, 184);
  doc.text(footerText, 14, footerY);

  doc.setFont('helvetica', 'normal');
  doc.text('Authorized Signatory', 160, footerY);
  doc.line(155, footerY - 5, 195, footerY - 5);

  doc.save(`${bill.bill_no || 'Invoice'}.pdf`);
}

/**
 * Generates and downloads a detailed Customer Ledger Statement PDF
 */
export function generateCustomerStatementPDF(statementData) {
  const doc = new jsPDF();
  const { customer, settings = {}, period, summary, bills = [], payments = [] } = statementData;

  const shopName = settings.shop_name || 'Vikas Super Market';
  const shopAddress = settings.address || '124 Main Street, Commercial Hub, Mumbai';
  const shopPhone = settings.phone || '022-28471920';
  const gstNo = settings.gst_number || 'GSTIN27AABCU9603R1ZM';

  // 1. Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(shopName, 14, 18);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`${shopAddress} | Phone: ${shopPhone} | GSTIN: ${gstNo}`, 14, 24);

  doc.setDrawColor(226, 232, 240);
  doc.line(14, 28, 196, 28);

  // 2. Statement Title & Period
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text('CUSTOMER ACCOUNT STATEMENT', 14, 37);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Statement Period: ${period?.from || 'All'} to ${period?.to || 'Present'}`, 14, 43);

  // Customer info box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 48, 182, 20, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.text(`Customer: ${customer.name}`, 18, 56);
  doc.setFont('helvetica', 'normal');
  doc.text(`Phone: ${customer.phone || 'N/A'}`, 18, 62);
  doc.text(`Address: ${customer.address || 'N/A'}`, 100, 56);
  doc.text(`Customer ID: #${customer.id}`, 100, 62);

  // Summary row
  doc.setFillColor(238, 242, 255);
  doc.roundedRect(14, 72, 182, 16, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Total Billed: ${formatCurrency(summary.total_billed)}`, 20, 82);
  doc.setTextColor(16, 185, 129);
  doc.text(`Total Paid: ${formatCurrency(summary.total_paid)}`, 80, 82);
  doc.setTextColor(217, 119, 6);
  doc.text(`Pending Balance: ${formatCurrency(summary.pending_balance)}`, 135, 82);

  // Combine bills and payments into sorted ledger ledger rows
  const ledgerEntries = [];

  bills.forEach((b) => {
    ledgerEntries.push({
      date: b.bill_date,
      type: 'INVOICE',
      ref: b.bill_no,
      desc: `Sale Invoice (${b.status})`,
      debit: Number(b.total_amount),
      credit: 0
    });
  });

  payments.forEach((p) => {
    ledgerEntries.push({
      date: p.payment_date,
      type: 'PAYMENT',
      ref: p.bill_no || 'FIFO',
      desc: `Payment received (${p.mode}) ${p.note ? '- ' + p.note : ''}`,
      debit: 0,
      credit: Number(p.amount)
    });
  });

  ledgerEntries.sort((a, b) => a.date.localeCompare(b.date));

  // Compute running balance
  let runningBalance = 0;
  const tableData = ledgerEntries.map((row) => {
    runningBalance += row.debit - row.credit;
    return [
      formatDate(row.date),
      row.ref,
      row.desc,
      row.debit > 0 ? formatCurrency(row.debit) : '-',
      row.credit > 0 ? formatCurrency(row.credit) : '-',
      formatCurrency(Math.max(0, runningBalance))
    ];
  });

  autoTable(doc, {
    startY: 94,
    head: [['Date', 'Reference', 'Description', 'Billed (Debit)', 'Paid (Credit)', 'Balance Due']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 8,
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 25 },
      2: { cellWidth: 60 },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }
    }
  });

  const finalY = doc.lastAutoTable.finalY + 12;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated on ${new Date().toLocaleString()} by Shop Billing System.`, 14, Math.min(finalY, 280));

  doc.save(`Statement-${customer.name.replace(/\s+/g, '_')}.pdf`);
}
