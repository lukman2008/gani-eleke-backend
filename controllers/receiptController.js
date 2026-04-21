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
   IMAGE GENERATION USING API - NO BACKGROUND
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
   COMPUTE RECEIPT - CORRECTED CALCULATIONS
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
    const profit = fAmount - iAmount;

    return {
      description: item.description || '',
      qty: qty,
      dust: dust,
      effectiveQty: effectiveQty,
      rate: rate,
      initialRate: initialRate,
      amount: Math.max(fAmount, 0),
      profit: profit,
      iAmount: iAmount,
      fAmount: fAmount
    };
  });

  const normalizedLess = less.map((item) => ({
    description: item.description || '',
    amount: Number(item.amount || 0),
  }));

  const totalCredit = normalizedCredits.reduce((sum, i) => sum + i.fAmount, 0);
  const totalDebit = normalizedLess.reduce((sum, i) => sum + i.amount, 0);
  const balance = Math.max(0, totalCredit - totalDebit);

  return {
    customerName,
    credits: normalizedCredits,
    less: normalizedLess,
    subTotal: totalCredit,
    debitTotal: totalDebit,
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
   GET RECEIPT SUMMARY - FIXED WITH WEEKLY AGENT REVENUE
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
    let receiptProfit = 0;
    for (const item of receipt.credits) {
      const profit = (item.fAmount || 0) - (item.iAmount || 0);
      if (profit > 0) {
        receiptProfit += profit;
      }
    }
    totalAgentRevenue += receiptProfit;
    
    const receiptDate = receipt.createdAt || receipt.date;
    if (receiptDate) {
      const receiptDateObj = new Date(receiptDate);
      if (receiptDateObj >= oneWeekAgo) {
        agentRevenueThisWeek += receiptProfit;
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
   GET RECEIPT IMAGE (PNG) - WITH DEBT VISIBLE
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

        // Get offloading amount and debt amount - BOTH VISIBLE NOW
        const offloadingAmount = receipt.less?.find(l => l.description === 'Offloading')?.amount || 0;
        const debtAmount = receipt.less?.find(l => l.description === 'Debt Deduction')?.amount || 0;
        const totalDebit = (receipt.debitTotal || 0);

        if (type === 'customer') {
            // CUSTOMER RECEIPT: Amount = (QTY - DUST) × RATE
            let totalCredit = 0;
            const items = receipt.credits.map((item, index) => {
                const originalQty = item.qty || 0;
                const dust = item.dust || 0;
                const rate = item.rate || 0;
                const effectiveQty = Math.max(0, originalQty - dust);
                const amount = effectiveQty * rate;
                totalCredit += amount;
                return {
                    description: item.description || '',
                    dust: dust,
                    qty: originalQty,
                    rate: rate,
                    amount: formatNumber(amount),
                    odd: index % 2 === 1
                };
            });

            const finalBalance = Math.max(0, totalCredit - totalDebit);

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
                creditAmount: formatCurrency(totalCredit),
                debitAmount: formatCurrency(totalDebit),
                balanceAmount: formatCurrency(finalBalance)
            });

            return await generateImageResponse(html, `customer-receipt-${receipt.receiptNumber}`, res);
        } else {
            // COMPANY RECEIPT: Shows I-RATE, F-RATE, PROFIT, and DEBT
            let totalCredit = 0;
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
                totalCredit += fAmount;
                if (profit !== 0) {
                    totalProfit += profit;
                    profits.push({ name: item.description || '', amount: formatCurrency(Math.abs(profit)), isPositive: profit > 0 });
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

            const finalBalance = Math.max(0, totalCredit - totalDebit);

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
                creditAmount: formatCurrency(totalCredit),
                debitAmount: formatCurrency(totalDebit),
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