const Receipt = require('../models/Receipt');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

const formatCurrency = (amount) => {
  // Remove the minus sign if amount is negative for display
  const absAmount = Math.abs(amount);
  return `NGN${absAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatNumber = (num) => {
  return num.toLocaleString('en-US');
};

// Dynamic logo URL function - use new logo
const getLogoUrl = () => {
    return 'https://gani-eleke-project.vercel.app/frontend/img/logo.jpeg';
};

// Read HTML templates
const customerTemplatePath = path.join(__dirname, '../receipt-templates/customer-receipt.html');
const companyTemplatePath = path.join(__dirname, '../receipt-templates/company-receipt.html');

const customerTemplate = fs.readFileSync(customerTemplatePath, 'utf8');
const companyTemplate = fs.readFileSync(companyTemplatePath, 'utf8');

const compiledCustomerTemplate = handlebars.compile(customerTemplate);
const compiledCompanyTemplate = handlebars.compile(companyTemplate);

/* =========================
   COMPUTATION LOGIC
========================= */

const computeReceipt = ({ customerName, credits = [], less = [], note }) => {
  const normalizedCredits = credits.map((item) => {
    const qty = Number(item.qty || 0);
    const rate = Number(item.rate || 0);
    const dust = Number(item.dust || 0);

    const initialRate = Number(item.initialRate) || rate;
    const initialAmount = qty * initialRate;
    const finalAmount = (qty * rate) - dust;
    const profit = finalAmount - initialAmount;

    return {
      description: item.description || '',
      qty,
      rate,
      dust,
      initialRate,
      amount: Math.max(finalAmount, 0),
      profit,
      iAmount: initialAmount,
      fAmount: finalAmount
    };
  });

  const normalizedLess = less.map((item) => ({
    description: item.description || '',
    amount: Number(item.amount || 0),
  }));

  const subTotal = normalizedCredits.reduce((sum, i) => sum + i.amount, 0);
  const debitTotal = normalizedLess.reduce((sum, i) => sum + i.amount, 0);
  const balance = subTotal - debitTotal;

  return {
    customerName,
    credits: normalizedCredits,
    less: normalizedLess,
    subTotal,
    debitTotal,
    balance,
    note,
  };
};

/* =========================
   CREATE RECEIPT
========================= */

const createReceipt = async (req, res) => {
  const { customerName, credits, less, note, companyName, ...rest } = req.body;

  if (!customerName || !credits?.length) {
    return res.status(400).json({ message: 'Customer name and credits required' });
  }

  const data = computeReceipt({ customerName, credits, less, note });

  const receipt = await Receipt.create({
    ...rest,
    ...data,
    companyName: companyName || 'Africa Steel Ltd',
    receiptNumber: `RCPT-${Date.now()}`,
    createdBy: req.user._id
  });

  res.status(201).json(receipt);
};

/* =========================
   GET ALL RECEIPTS
========================= */

const getReceipts = async (req, res) => {
  const receipts = await Receipt.find().populate('createdBy', 'name email role').sort({ createdAt: -1 });
  res.json(receipts);
};

/* =========================
   GET ONE RECEIPT
========================= */

const getReceiptById = async (req, res) => {
  const receipt = await Receipt.findById(req.params.id).populate('createdBy', 'name email role');
  if (!receipt) return res.status(404).json({ message: 'Not found' });
  res.json(receipt);
};

/* =========================
   UPDATE RECEIPT
========================= */

const updateReceipt = async (req, res) => {
  const receipt = await Receipt.findById(req.params.id);
  if (!receipt) {
    return res.status(404).json({ message: 'Receipt not found.' });
  }

  const { companyInfo, receiptTitle, customerName, customerPhone, customerAddress, vehicle, creditorName, creditorPhone, credits, less, note, date, companyName } = req.body;
  
  const data = computeReceipt({
    customerName: customerName || receipt.customerName,
    credits: credits || receipt.credits,
    less: less || receipt.less,
    note: note ?? receipt.note,
  });

  if (date) receipt.date = new Date(date);
  if (receiptTitle) receipt.receiptTitle = receiptTitle;
  if (companyInfo) receipt.companyInfo = companyInfo;
  if (vehicle) receipt.vehicle = vehicle;
  if (customerAddress) receipt.customerAddress = customerAddress;
  if (creditorName) receipt.creditorName = creditorName;
  if (creditorPhone) receipt.creditorPhone = creditorPhone;
  if (customerName) receipt.customerName = data.customerName;
  if (customerPhone) receipt.customerPhone = customerPhone;
  if (companyName) receipt.companyName = companyName;
  
  receipt.credits = data.credits;
  receipt.less = data.less;
  receipt.subTotal = data.subTotal;
  receipt.debitTotal = data.debitTotal;
  receipt.balance = data.balance;
  if (note !== undefined) receipt.note = data.note;

  await receipt.save();
  res.json(receipt);
};

/* =========================
   DELETE RECEIPT
========================= */

const deleteReceipt = async (req, res) => {
  const receipt = await Receipt.findById(req.params.id);
  if (!receipt) {
    return res.status(404).json({ message: 'Receipt not found.' });
  }
  await receipt.deleteOne();
  res.json({ message: 'Receipt deleted.' });
};

/* =========================
   GET RECEIPT SUMMARY
========================= */

const getReceiptSummary = async (req, res) => {
  const receipts = await Receipt.find();
  const totalReceipts = receipts.length;
  const totalCreditAmount = receipts.reduce((sum, receipt) => sum + (receipt.subTotal || 0), 0);
  const totalDebitAmount = receipts.reduce((sum, receipt) => sum + (receipt.debitTotal || 0), 0);
  const totalBalance = receipts.reduce((sum, receipt) => sum + (receipt.balance || 0), 0);
  
  res.json({
    totalReceipts,
    totalCreditAmount,
    totalDebitAmount,
    totalBalance,
  });
};

/* =========================
   CLEAR ALL RECEIPTS
========================= */

const clearReceipts = async (req, res) => {
  await Receipt.deleteMany({});
  res.json({ message: 'All receipts and balances have been cleared.' });
};

/* =========================
   GENERATE HTML (instead of PDF/Image)
========================= */

const getReceiptPdfCompany = async (receipt, res) => {
  try {
    console.log('Generating Company Receipt HTML for receipt:', receipt._id);
    
    const date = new Date(receipt.date || Date.now());
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    
    let totalCredit = 0;
    let totalProfit = 0;
    const profits = [];
    
    const items = receipt.credits.map((item, index) => {
      const iAmount = item.qty * (item.initialRate || item.rate);
      const fAmount = (item.qty * item.rate) - (item.dust || 0);
      const profit = fAmount - iAmount;
      totalCredit += fAmount;
      totalProfit += profit;
      if (profit !== 0) {
        profits.push({ name: item.description, amount: formatCurrency(profit) });
      }
      return {
        description: item.description,
        dust: item.dust || 0,
        qty: item.qty,
        iRate: item.initialRate || item.rate,
        fRate: item.rate,
        iAmount: formatNumber(iAmount),
        fAmount: formatNumber(fAmount),
        odd: index % 2 === 1
      };
    });
    
    const offloadingAmount = receipt.less.find(l => l.description === 'Offloading')?.amount || 0;
    const debitTotal = receipt.debitTotal || 0;
    const balance = receipt.balance || 0;
    
    const logoUrl = getLogoUrl();
    
    const html = compiledCompanyTemplate({
      logoUrl,
      day,
      month,
      year,
      companyName: receipt.companyName || receipt.companyInfo?.name || 'Africa Steel Ltd',
      customerName: receipt.customerName || '',
      customerAddress: receipt.customerAddress || '',
      customerPhone: receipt.customerPhone || '',
      vehicleNo: receipt.vehicle || '',
      items,
      offloadingAmount: formatNumber(offloadingAmount),
      debtAmount: '',
      profits,
      totalProfit: formatCurrency(totalProfit > 0 ? totalProfit : 0),
      creditAmount: formatCurrency(totalCredit),
      debitAmount: formatCurrency(debitTotal),
      balanceAmount: formatCurrency(balance)
    });
    
    // Send as HTML file
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${receipt.receiptNumber}-company.html"`);
    res.send(html);
  } catch (error) {
    console.error('HTML Generation Error:', error);
    res.status(500).json({ error: 'HTML generation failed', details: error.message });
  }
};

const getReceiptPdfCustomer = async (receipt, res) => {
  try {
    console.log('Generating Customer Receipt HTML for receipt:', receipt._id);
    
    const date = new Date(receipt.date || Date.now());
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    
    let totalCredit = 0;
    
    const items = receipt.credits.map((item, index) => {
      const amount = (item.qty * item.rate) - (item.dust || 0);
      totalCredit += amount;
      return {
        description: item.description,
        dust: item.dust || 0,
        qty: item.qty,
        rate: item.rate,
        amount: formatNumber(amount),
        odd: index % 2 === 1
      };
    });
    
    const offloadingAmount = receipt.less.find(l => l.description === 'Offloading')?.amount || 0;
    const debitTotal = receipt.debitTotal || 0;
    const balance = receipt.balance || 0;
    
    const logoUrl = getLogoUrl();
    
    const html = compiledCustomerTemplate({
      logoUrl,
      day,
      month,
      year,
      companyName: receipt.companyName || receipt.companyInfo?.name || 'Africa Steel Ltd',
      customerName: receipt.customerName || '',
      customerAddress: receipt.customerAddress || '',
      customerPhone: receipt.customerPhone || '',
      vehicleNo: receipt.vehicle || '',
      items,
      offloadingAmount: formatNumber(offloadingAmount),
      debtAmount: '',
      creditAmount: formatCurrency(totalCredit),
      debitAmount: formatCurrency(debitTotal),
      balanceAmount: formatCurrency(balance)
    });
    
    // Send as HTML file
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${receipt.receiptNumber}-customer.html"`);
    res.send(html);
  } catch (error) {
    console.error('HTML Generation Error:', error);
    res.status(500).json({ error: 'HTML generation failed', details: error.message });
  }
};

const getReceiptPdf = async (req, res) => {
  const receipt = await Receipt.findById(req.params.id);
  if (!receipt) return res.status(404).json({ message: 'Not found' });

  const { type } = req.query;

  if (type === 'customer') {
    return getReceiptPdfCustomer(receipt, res);
  }

  return getReceiptPdfCompany(receipt, res);
};

/* =========================
   EXPORTS
========================= */

module.exports = {
  createReceipt,
  getReceipts,
  getReceiptById,
  updateReceipt,
  deleteReceipt,
  getReceiptSummary,
  clearReceipts,
  getReceiptPdf
};






const Receipt = require('../models/Receipt');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const axios = require('axios');

/* =========================
   HELPERS & CONFIG
========================= */

const formatCurrency = (amount) => {
    const absAmount = Math.abs(amount);
    return `NGN${absAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatNumber = (num) => num.toLocaleString('en-US');

const getLogoUrl = () => 'https://gani-eleke-project.vercel.app/frontend/img/logo.jpeg';

// HTMLCSSTOIMAGE API credentials
const HCTI_USER_ID = '01KPBNPMNFC057VW7R1Q2ERBCE';
const HCTI_API_KEY = '019d975b-52af-730a-ad51-dbd52470e6ee';

/* =========================
   TEMPLATE COMPILATION
========================= */

const customerTemplatePath = path.join(__dirname, '../receipt-templates/customer-receipt.html');
const companyTemplatePath = path.join(__dirname, '../receipt-templates/company-receipt.html');

let compiledCustomerTemplate;
let compiledCompanyTemplate;

try {
    const customerTemplate = fs.readFileSync(customerTemplatePath, 'utf8');
    const companyTemplate = fs.readFileSync(companyTemplatePath, 'utf8');
    compiledCustomerTemplate = handlebars.compile(customerTemplate);
    compiledCompanyTemplate = handlebars.compile(companyTemplate);
    console.log('Templates loaded successfully');
} catch (error) {
    console.error('Error loading templates:', error);
}

/* =========================
   IMAGE GENERATION USING API
========================= */

const generateImageResponse = async (html, filename, res) => {
    try {
        console.log('Converting HTML to image using API...');
        
        const response = await axios.post('https://hcti.io/v1/image', {
            html: html,
            css: "body { margin: 0; padding: 0; background: transparent; font-family: 'Inter', sans-serif; } .receipt-container { margin: 0 auto; background: white; }",
            google_fonts: "Inter"
        }, {
            auth: {
                username: HCTI_USER_ID,
                password: HCTI_API_KEY
            },
            timeout: 60000
        });
        
        if (response.data && response.data.url) {
            const imageResponse = await axios.get(response.data.url, {
                responseType: 'arraybuffer',
                timeout: 60000
            });
            
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.png"`);
            res.send(imageResponse.data);
            console.log('Image sent successfully');
        } else {
            throw new Error('API did not return an image URL');
        }
        
    } catch (error) {
        console.error('API Error:', error.message);
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.html"`);
        res.send(html);
    }
};

/* =========================
   COMPUTE RECEIPT - MAIN CALCULATION ENGINE
========================= */

const computeReceipt = ({ customerName, credits = [], less = [], note }) => {
  const normalizedCredits = credits.map((item) => {
    const qty = Number(item.qty || 0);
    const rate = Number(item.rate || 0);
    const dust = Number(item.dust || 0);
    const initialRate = Number(item.initialRate) || rate;
    
    const effectiveQty = Math.max(0, qty - dust);
    const iAmount = effectiveQty * initialRate;
    const fAmount = effectiveQty * rate;
    const profitBeforeExpenses = fAmount - iAmount;

    return {
      description: item.description || '',
      qty: qty,
      dust: dust,
      effectiveQty: effectiveQty,
      rate: rate,
      initialRate: initialRate,
      iAmount: iAmount,
      fAmount: fAmount,
      profitBeforeExpenses: profitBeforeExpenses,
    };
  });

  const normalizedLess = less.map((item) => ({
    description: item.description || '',
    amount: Number(item.amount || 0),
  }));

  const offloadingAmount = normalizedLess.find(l => l.description === 'Offloading')?.amount || 0;
  const debtAmount = normalizedLess.find(l => l.description === 'Debt Deduction')?.amount || 0;
  
  const totalSellingPrice = normalizedCredits.reduce((sum, i) => sum + i.fAmount, 0);
  const totalCostPrice = normalizedCredits.reduce((sum, i) => sum + i.iAmount, 0);
  const profitBeforeExpenses = totalSellingPrice - totalCostPrice;
  const netProfit = Math.max(0, profitBeforeExpenses - offloadingAmount);
  const cashReceived = Math.max(0, totalSellingPrice - debtAmount);
  const cashInHand = Math.max(0, cashReceived - offloadingAmount);
  const totalDeductions = offloadingAmount + debtAmount;
  const balance = Math.max(0, totalSellingPrice - totalDeductions);

  return {
    customerName,
    credits: normalizedCredits,
    less: normalizedLess,
    subTotal: totalSellingPrice,
    totalCostPrice: totalCostPrice,
    profitBeforeExpenses: profitBeforeExpenses,
    netProfit: netProfit,
    offloadingAmount: offloadingAmount,
    debtAmount: debtAmount,
    cashReceived: cashReceived,
    cashInHand: cashInHand,
    debitTotal: totalDeductions,
    balance: balance,
    note,
  };
};

/* =========================
   CREATE RECEIPT
========================= */

const createReceipt = async (req, res) => {
  const { customerName, credits, less, note, companyName, ...rest } = req.body;

  if (!customerName || !credits?.length) {
    return res.status(400).json({ message: 'Customer name and credits required' });
  }

  const data = computeReceipt({ customerName, credits, less, note });

  const receipt = await Receipt.create({
    ...rest,
    ...data,
    companyName: companyName || '',
    receiptNumber: `RCPT-${Date.now()}`,
    createdBy: req.user._id
  });

  res.status(201).json(receipt);
};

/* =========================
   GET ALL RECEIPTS
========================= */

const getReceipts = async (req, res) => {
  const receipts = await Receipt.find().populate('createdBy', 'name email role').sort({ createdAt: -1 });
  res.json(receipts);
};

/* =========================
   GET ONE RECEIPT
========================= */

const getReceiptById = async (req, res) => {
  const receipt = await Receipt.findById(req.params.id).populate('createdBy', 'name email role');
  if (!receipt) return res.status(404).json({ message: 'Not found' });
  res.json(receipt);
};

/* =========================
   UPDATE RECEIPT
========================= */

const updateReceipt = async (req, res) => {
  const receipt = await Receipt.findById(req.params.id);
  if (!receipt) {
    return res.status(404).json({ message: 'Receipt not found.' });
  }

  const { companyInfo, receiptTitle, customerName, customerPhone, customerAddress, vehicle, creditorName, creditorPhone, credits, less, note, date, companyName } = req.body;
  
  const data = computeReceipt({
    customerName: customerName || receipt.customerName,
    credits: credits || receipt.credits,
    less: less || receipt.less,
    note: note ?? receipt.note,
  });

  if (date) receipt.date = new Date(date);
  if (receiptTitle) receipt.receiptTitle = receiptTitle;
  if (companyInfo) receipt.companyInfo = companyInfo;
  if (vehicle) receipt.vehicle = vehicle;
  if (customerAddress) receipt.customerAddress = customerAddress;
  if (creditorName) receipt.creditorName = creditorName;
  if (creditorPhone) receipt.creditorPhone = creditorPhone;
  if (customerName) receipt.customerName = data.customerName;
  if (customerPhone) receipt.customerPhone = customerPhone;
  if (companyName) receipt.companyName = companyName;
  
  receipt.credits = data.credits;
  receipt.less = data.less;
  receipt.subTotal = data.subTotal;
  receipt.totalCostPrice = data.totalCostPrice;
  receipt.profitBeforeExpenses = data.profitBeforeExpenses;
  receipt.netProfit = data.netProfit;
  receipt.offloadingAmount = data.offloadingAmount;
  receipt.debtAmount = data.debtAmount;
  receipt.cashReceived = data.cashReceived;
  receipt.cashInHand = data.cashInHand;
  receipt.debitTotal = data.debitTotal;
  receipt.balance = data.balance;
  if (note !== undefined) receipt.note = data.note;

  await receipt.save();
  res.json(receipt);
};

/* =========================
   DELETE RECEIPT
========================= */

const deleteReceipt = async (req, res) => {
  const receipt = await Receipt.findById(req.params.id);
  if (!receipt) {
    return res.status(404).json({ message: 'Receipt not found.' });
  }
  await receipt.deleteOne();
  res.json({ message: 'Receipt deleted.' });
};

/* =========================
   GET RECEIPT SUMMARY
========================= */

const getReceiptSummary = async (req, res) => {
  const receipts = await Receipt.find();
  const totalReceipts = receipts.length;
  const totalCreditAmount = receipts.reduce((sum, receipt) => sum + (receipt.subTotal || 0), 0);
  const totalDebitAmount = receipts.reduce((sum, receipt) => sum + (receipt.debitTotal || 0), 0);
  const totalBalance = receipts.reduce((sum, receipt) => sum + (receipt.balance || 0), 0);
  
  let totalAgentRevenue = 0;
  let agentRevenueThisWeek = 0;
  
  const now = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(now.getDate() - 7);
  oneWeekAgo.setHours(0, 0, 0, 0);
  
  for (const receipt of receipts) {
    const netProfit = receipt.netProfit || 0;
    totalAgentRevenue += netProfit;
    
    const receiptDate = receipt.createdAt || receipt.date;
    if (receiptDate) {
      const receiptDateObj = new Date(receiptDate);
      if (receiptDateObj >= oneWeekAgo) {
        agentRevenueThisWeek += netProfit;
      }
    }
  }
  
  res.json({
    totalReceipts,
    totalCreditAmount,
    totalDebitAmount,
    totalBalance,
    totalAgentRevenue,
    agentRevenueThisWeek
  });
};

/* =========================
   CLEAR ALL RECEIPTS
========================= */

const clearReceipts = async (req, res) => {
  await Receipt.deleteMany({});
  res.json({ message: 'All receipts and balances have been cleared.' });
};

/* =========================
   GET RECEIPT IMAGE (PNG) - MATCHES ORIGINAL TEMPLATE
========================= */

const getReceiptPdf = async (req, res) => {
    try {
        const receipt = await Receipt.findById(req.params.id);
        if (!receipt) return res.status(404).json({ message: 'Not found' });

        const { type } = req.query;
        const date = new Date(receipt.date || Date.now());
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear().toString().slice(-2);
        const logoUrl = getLogoUrl();
        const companyName = receipt.companyName || '';

        const offloadingAmount = receipt.offloadingAmount || 0;
        const debtAmount = receipt.debtAmount || 0;
        const totalDeductions = (receipt.debitTotal || 0);

        if (type === 'customer') {
            let totalSellingPrice = 0;
            const items = receipt.credits.map((item, index) => {
                const originalQty = item.qty || 0;
                const dust = item.dust || 0;
                const rate = item.rate || 0;
                const effectiveQty = Math.max(0, originalQty - dust);
                const amount = effectiveQty * rate;
                totalSellingPrice += amount;
                return {
                    description: item.description || '',
                    dust: dust,
                    qty: originalQty,
                    rate: rate,
                    amount: formatNumber(amount),
                    odd: index % 2 === 1
                };
            });

            const finalBalance = Math.max(0, totalSellingPrice - totalDeductions);

            const html = compiledCustomerTemplate({
                logoUrl, day, month, year,
                companyName: companyName,
                customerName: receipt.customerName || '',
                customerAddress: receipt.customerAddress || '',
                customerPhone: receipt.customerPhone || '',
                vehicleNo: receipt.vehicle || '',
                items: items,
                offloadingAmount: formatNumber(offloadingAmount),
                debtAmount: formatNumber(debtAmount),
                creditAmount: formatCurrency(totalSellingPrice),
                debitAmount: formatCurrency(totalDeductions),
                balanceAmount: formatCurrency(finalBalance)
            });

            return await generateImageResponse(html, `customer-receipt-${receipt.receiptNumber}`, res);
        } else {
            // COMPANY RECEIPT - Matches their original template structure
            let totalSellingPrice = 0;
            let totalProfit = 0;
            const profits = [];
            
            const items = receipt.credits.map((item, index) => {
                const originalQty = item.qty || 0;
                const dust = item.dust || 0;
                const rate = item.rate || 0;
                const initialRate = item.initialRate || rate;
                const effectiveQty = Math.max(0, originalQty - dust);
                
                const iAmount = effectiveQty * initialRate;
                const fAmount = effectiveQty * rate;
                const profit = fAmount - iAmount;
                
                totalSellingPrice += fAmount;
                if (profit !== 0) {
                    totalProfit += profit;
                    profits.push({ 
                        name: item.description || '', 
                        amount: formatCurrency(Math.abs(profit)), 
                        isPositive: profit > 0 
                    });
                }
                
                return {
                    description: item.description || '',
                    dust: dust,
                    qty: originalQty,
                    iRate: formatNumber(initialRate),
                    fRate: formatNumber(rate),
                    iAmount: formatNumber(iAmount),
                    fAmount: formatNumber(fAmount),
                    profitFormatted: formatCurrency(Math.abs(profit)),
                    isProfitPositive: profit > 0,
                    odd: index % 2 === 1
                };
            });

            const finalBalance = Math.max(0, totalSellingPrice - totalDeductions);

            // Pass all data to the original template
            const html = compiledCompanyTemplate({
                logoUrl, day, month, year,
                companyName: companyName,
                customerName: receipt.customerName || '',
                customerAddress: receipt.customerAddress || '',
                customerPhone: receipt.customerPhone || '',
                vehicleNo: receipt.vehicle || '',
                items: items,
                offloadingAmount: formatNumber(offloadingAmount),
                debtAmount: formatNumber(debtAmount),
                profits: profits,
                totalProfit: formatCurrency(totalProfit),
                creditAmount: formatCurrency(totalSellingPrice),
                debitAmount: formatCurrency(totalDeductions),
                balanceAmount: formatCurrency(finalBalance)
            });

            return await generateImageResponse(html, `company-receipt-${receipt.receiptNumber}`, res);
        }
    } catch (error) {
        console.error('Error in getReceiptPdf:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate receipt', details: error.message });
        }
    }
};

/* =========================
   EXPORTS
========================= */

module.exports = {
    createReceipt,
    getReceipts,
    getReceiptById,
    updateReceipt,
    deleteReceipt,
    getReceiptSummary,
    clearReceipts,
    getReceiptPdf
};