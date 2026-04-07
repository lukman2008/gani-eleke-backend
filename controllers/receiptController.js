const PDFDocument = require('pdfkit');
const Receipt = require('../models/Receipt');

const computeReceipt = ({ customerName, credits = [], less = [], note }) => {
  const normalizedCredits = credits.map((item) => {
    const qty = Number(item.qty || 0);
    const rate = Number(item.rate || 0);
    return {
      description: String(item.description || '').trim(),
      qty,
      rate,
      amount: qty * rate,
    };
  });

  const normalizedLess = less.map((item) => ({
    description: String(item.description || '').trim(),
    amount: Number(item.amount || 0),
    date: item.date ? new Date(item.date) : new Date(),
  }));

  const subTotal = normalizedCredits.reduce((sum, item) => sum + item.amount, 0);
  const debitTotal = normalizedLess.reduce((sum, item) => sum + item.amount, 0);
  const balance = Math.max(subTotal - debitTotal, 0);

  return {
    customerName: String(customerName || '').trim(),
    credits: normalizedCredits,
    less: normalizedLess,
    subTotal,
    debitTotal,
    balance,
    note: note ? String(note).trim() : '',
  };
};

const buildReceiptPreview = (receipt) => ({
  receiptNumber: receipt.receiptNumber,
  date: receipt.date,
  receiptTitle: receipt.receiptTitle,
  companyInfo: receipt.companyInfo,
  vehicle: receipt.vehicle,
  creditorName: receipt.creditorName,
  creditorPhone: receipt.creditorPhone,
  customerName: receipt.customerName,
  credits: receipt.credits,
  less: receipt.less,
  subTotal: receipt.subTotal,
  debitTotal: receipt.debitTotal,
  balance: receipt.balance,
  note: receipt.note,
});

const createReceipt = async (req, res) => {
  const { companyInfo, receiptTitle, customerName, customerPhone, vehicle, creditorName, creditorPhone, credits, less, note, date } = req.body;

  if (!customerName || !Array.isArray(credits) || credits.length === 0) {
    return res.status(400).json({ message: 'Customer name and at least one credit item are required.' });
  }

  const data = computeReceipt({ customerName, credits, less, note });
  const receiptNumber = `RCPT-${Date.now()}`;

  const receipt = await Receipt.create({
    receiptNumber,
    date: date ? new Date(date) : undefined,
    receiptTitle: receiptTitle ? String(receiptTitle).trim() : 'Receipt',
    companyInfo: companyInfo || {},
    vehicle: vehicle ? String(vehicle).trim() : '',
    creditorName: creditorName ? String(creditorName).trim() : '',
    creditorPhone: creditorPhone ? String(creditorPhone).trim() : '',
    customerPhone: customerPhone ? String(customerPhone).trim() : '',
    ...data,
    createdBy: req.user._id,
  });

  const receiptObject = receipt.toObject();
  res.status(201).json({ ...receiptObject, preview: buildReceiptPreview(receiptObject) });
};

const getReceipts = async (req, res) => {
  const receipts = await Receipt.find()
    .populate('createdBy', 'name email role')
    .sort({ createdAt: -1 });

  const receiptsWithPreview = receipts.map((receipt) => {
    const receiptObject = receipt.toObject();
    return { ...receiptObject, preview: buildReceiptPreview(receiptObject) };
  });

  res.json(receiptsWithPreview);
};

const getReceiptById = async (req, res) => {
  const receipt = await Receipt.findById(req.params.id).populate('createdBy', 'name email role');
  if (!receipt) {
    return res.status(404).json({ message: 'Receipt not found.' });
  }

  const receiptObject = receipt.toObject();
  res.json({ ...receiptObject, preview: buildReceiptPreview(receiptObject) });
};

const updateReceipt = async (req, res) => {
  const receipt = await Receipt.findById(req.params.id);
  if (!receipt) {
    return res.status(404).json({ message: 'Receipt not found.' });
  }

  const { companyInfo, receiptTitle, customerName, customerPhone, vehicle, creditorName, creditorPhone, credits, less, note, date } = req.body;
  const data = computeReceipt({
    customerName: customerName || receipt.customerName,
    credits: credits || receipt.credits,
    less: less || receipt.less,
    note: note ?? receipt.note,
  });

  receipt.date = date ? new Date(date) : receipt.date;
  receipt.receiptTitle = receiptTitle ? String(receiptTitle).trim() : receipt.receiptTitle;
  receipt.companyInfo = companyInfo || receipt.companyInfo;
  receipt.vehicle = vehicle ? String(vehicle).trim() : receipt.vehicle;
  receipt.creditorName = creditorName ? String(creditorName).trim() : receipt.creditorName;
  receipt.creditorPhone = creditorPhone ? String(creditorPhone).trim() : receipt.creditorPhone;
  receipt.customerName = data.customerName;
  receipt.customerPhone = customerPhone ? String(customerPhone).trim() : receipt.customerPhone;
  receipt.credits = data.credits;
  receipt.less = data.less;
  receipt.subTotal = data.subTotal;
  receipt.debitTotal = data.debitTotal;
  receipt.balance = data.balance;
  receipt.note = data.note;

  await receipt.save();

  const receiptObject = receipt.toObject();
  res.json({ ...receiptObject, preview: buildReceiptPreview(receiptObject) });
};

const deleteReceipt = async (req, res) => {
  const receipt = await Receipt.findById(req.params.id);
  if (!receipt) {
    return res.status(404).json({ message: 'Receipt not found.' });
  }

  await receipt.deleteOne();
  res.json({ message: 'Receipt deleted.' });
};

const getReceiptSummary = async (req, res) => {
  const receipts = await Receipt.find();
  const totalReceipts = receipts.length;
  const totalCreditAmount = receipts.reduce((sum, receipt) => sum + receipt.subTotal, 0);
  const totalDebitAmount = receipts.reduce((sum, receipt) => sum + receipt.debitTotal, 0);
  const totalBalance = receipts.reduce((sum, receipt) => sum + receipt.balance, 0);

  res.json({
    totalReceipts,
    totalCreditAmount,
    totalDebitAmount,
    totalBalance,
  });
};

const clearReceipts = async (req, res) => {
  await Receipt.deleteMany({});
  res.json({ message: 'All receipts and balances have been cleared.' });
};

const getReceiptPdf = async (req, res) => {
  const receipt = await Receipt.findById(req.params.id).populate('createdBy', 'name email role');
  if (!receipt) {
    return res.status(404).json({ message: 'Receipt not found.' });
  }

  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    bufferPages: true
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${receipt.receiptNumber}.pdf"`);

  doc.pipe(res);

  // Colors
  const primaryColor = '#1e293b'; // slate-800
  const secondaryColor = '#475569'; // slate-600
  const accentColor = '#0ea5e9'; // blue-500
  const lightGray = '#f1f5f9'; // slate-100

  
  const drawLine = (y) => {
    doc.strokeColor(lightGray).lineWidth(1).moveTo(50, y).lineTo(545, y).stroke();
  };

  
  doc.fillColor(primaryColor);
  doc.fontSize(24).font('Helvetica-Bold').text('GANI ELEKE ENT', 50, 50, { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').fillColor(secondaryColor);
  doc.text('Building Materials & Construction Services', { align: 'center' });
  doc.moveDown(0.2);
  doc.fontSize(8).text('Lagos, Nigeria | Phone: 08012345678 | Email: info@ganieleke.com', { align: 'center' });

  
  doc.roundedRect(400, 80, 120, 40, 5).fillAndStroke(accentColor, accentColor);
  doc.fillColor('white').fontSize(14).font('Helvetica-Bold');
  doc.text('RECEIPT', 400, 95, { width: 120, align: 'center' });

  // Receipt Details
  doc.fillColor(primaryColor).fontSize(10).font('Helvetica');
  doc.text(`Receipt No: ${receipt.receiptNumber}`, 50, 140);
  doc.text(`Date: ${receipt.date.toLocaleDateString('en-GB')}`, 50, 155);
  doc.text(`Time: ${receipt.date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, 50, 170);

  // Customer Information Box
  doc.roundedRect(50, 190, 240, 80, 5).fillAndStroke(lightGray, secondaryColor);
  doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold');
  doc.text('CUSTOMER INFORMATION', 60, 200);
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Name: ${receipt.customerName}`, 60);
  if (receipt.customerPhone) {
    doc.text(`Phone: ${receipt.customerPhone}`, 60);
  }
  if (receipt.vehicle) {
    doc.text(`Vehicle: ${receipt.vehicle}`, 60);
  }
  doc.text(`Creditor: ${receipt.creditorName || 'Gani Eleke'}`, 60);

  // Credits Table
  let tableTop = 290;
  doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold');
  doc.text('ITEMIZED CREDITS', 50, tableTop);

  // Table Header
  tableTop += 20;
  doc.roundedRect(50, tableTop, 495, 20, 3).fill(accentColor);
  doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
  doc.text('DESCRIPTION', 60, tableTop + 6);
  doc.text('QTY', 320, tableTop + 6);
  doc.text('RATE (₦)', 380, tableTop + 6);
  doc.text('AMOUNT (₦)', 460, tableTop + 6);

  // Table Rows
  let currentY = tableTop + 25;
  doc.fillColor(primaryColor).fontSize(9).font('Helvetica');

  receipt.credits.forEach((item, index) => {
    const rowHeight = 20;
    const fillColor = index % 2 === 0 ? lightGray : 'white';
    doc.roundedRect(50, currentY, 495, rowHeight, 0).fill(fillColor);

    doc.fillColor(primaryColor);
    doc.text(item.description, 60, currentY + 6, { width: 250 });
    doc.text(item.qty.toString(), 320, currentY + 6, { width: 50, align: 'center' });
    doc.text(`${item.rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 380, currentY + 6, { width: 70, align: 'right' });
    doc.text(`₦${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 460, currentY + 6, { width: 70, align: 'right' });

    currentY += rowHeight;
  });

  // Subtotal
  currentY += 10;
  drawLine(currentY);
  currentY += 5;
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('SUBTOTAL:', 350, currentY);
  doc.text(`₦${receipt.subTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 460, currentY, { width: 70, align: 'right' });

  // Deductions
  if (receipt.less.length > 0) {
    currentY += 30;
    doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold');
    doc.text('DEDUCTIONS', 50, currentY);

    currentY += 20;
    doc.roundedRect(50, currentY, 495, 20, 3).fill(secondaryColor);
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
    doc.text('DESCRIPTION', 60, currentY + 6);
    doc.text('AMOUNT (₦)', 460, currentY + 6);

    currentY += 25;
    doc.fillColor(primaryColor).fontSize(9).font('Helvetica');

    receipt.less.forEach((item, index) => {
      const rowHeight = 20;
      const fillColor = index % 2 === 0 ? '#fee2e2' : 'white'; // light red for deductions
      doc.roundedRect(50, currentY, 495, rowHeight, 0).fill(fillColor);

      doc.fillColor(primaryColor);
      doc.text(item.description, 60, currentY + 6, { width: 350 });
      doc.text(`₦${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 460, currentY + 6, { width: 70, align: 'right' });

      currentY += rowHeight;
    });

    // Debit Total
    currentY += 10;
    drawLine(currentY);
    currentY += 5;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#dc2626'); // red for deductions
    doc.text('TOTAL DEDUCTIONS:', 350, currentY);
    doc.text(`₦${receipt.debitTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 460, currentY, { width: 70, align: 'right' });
  }

  // Final Balance
  currentY += 30;
  doc.roundedRect(350, currentY, 195, 30, 5).fillAndStroke(accentColor, accentColor);
  doc.fillColor('white').fontSize(14).font('Helvetica-Bold');
  doc.text('FINAL BALANCE', 350, currentY + 8, { width: 195, align: 'center' });
  doc.text(`₦${receipt.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 350, currentY + 18, { width: 195, align: 'center' });

  // Footer
  const footerY = 750;
  drawLine(footerY);
  doc.fillColor(secondaryColor).fontSize(8).font('Helvetica');
  doc.text('Thank you for your business!', 50, footerY + 10, { align: 'center', width: 495 });
  doc.text('Terms & Conditions: All sales are final. Please retain this receipt for your records.', 50, footerY + 25, { align: 'center', width: 495 });
  doc.text(`Generated on ${new Date().toLocaleString('en-GB')}`, 50, footerY + 40, { align: 'center', width: 495 });

  // Note if present
  if (receipt.note) {
    currentY += 50;
    doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold');
    doc.text('NOTE:', 50, currentY);
    doc.font('Helvetica').text(receipt.note, 50, currentY + 15, { width: 495 });
  }

  doc.end();
};

module.exports = { createReceipt, getReceipts, getReceiptById, updateReceipt, deleteReceipt, getReceiptSummary, clearReceipts, getReceiptPdf };
