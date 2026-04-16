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

// Your HTMLCSSTOIMAGE API credentials
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
   IMAGE GENERATION USING API (NO CHROME NEEDED!)
========================= */

const generateImageResponse = async (html, filename, res) => {
    try {
        console.log('Converting HTML to image using API...');
        
        // Call HTMLCSSTOIMAGE API to convert HTML to PNG
        const response = await axios.post('https://hcti.io/v1/image', {
            html: html,
            css: "",
            google_fonts: "Roboto"
        }, {
            auth: {
                username: HCTI_USER_ID,
                password: HCTI_API_KEY
            },
            timeout: 30000 // 30 second timeout
        });
        
        if (response.data && response.data.url) {
            console.log('API returned image URL:', response.data.url);
            
            // Download the generated image
            const imageResponse = await axios.get(response.data.url, {
                responseType: 'arraybuffer',
                timeout: 30000
            });
            
            // Send the image to client
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.png"`);
            res.send(imageResponse.data);
            console.log('Image sent successfully to client');
        } else {
            throw new Error('API did not return an image URL');
        }
        
    } catch (error) {
        console.error('API Error:', error.message);
        
        // Fallback: Send HTML if image generation fails
        console.log('Falling back to HTML format...');
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.html"`);
        res.send(html);
    }
};

/* =========================
   COMPUTE RECEIPT
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
   GET RECEIPT IMAGE (PNG)
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

        if (type === 'customer') {
            let totalCredit = 0;
            const items = receipt.credits.map((item, index) => {
                const amount = (item.qty * item.rate) - (item.dust || 0);
                totalCredit += amount;
                return {
                    ...item,
                    dust: item.dust || 0,
                    amount: formatNumber(amount),
                    odd: index % 2 === 1
                };
            });

            const html = compiledCustomerTemplate({
                logoUrl, day, month, year,
                companyName: receipt.companyName || 'Africa Steel Ltd',
                customerName: receipt.customerName || '',
                customerAddress: receipt.customerAddress || '',
                customerPhone: receipt.customerPhone || '',
                vehicleNo: receipt.vehicle || '',
                items,
                offloadingAmount: formatNumber(receipt.less.find(l => l.description === 'Offloading')?.amount || 0),
                creditAmount: formatCurrency(totalCredit),
                debitAmount: formatCurrency(receipt.debitTotal),
                balanceAmount: formatCurrency(receipt.balance)
            });

            return await generateImageResponse(html, `customer-receipt-${receipt.receiptNumber}`, res);

        } else {
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

            const html = compiledCompanyTemplate({
                logoUrl, day, month, year,
                companyName: receipt.companyName || 'Africa Steel Ltd',
                customerName: receipt.customerName || '',
                customerAddress: receipt.customerAddress || '',
                customerPhone: receipt.customerPhone || '',
                vehicleNo: receipt.vehicle || '',
                items,
                offloadingAmount: formatNumber(receipt.less.find(l => l.description === 'Offloading')?.amount || 0),
                profits,
                totalProfit: formatCurrency(totalProfit),
                creditAmount: formatCurrency(totalCredit),
                debitAmount: formatCurrency(receipt.debitTotal),
                balanceAmount: formatCurrency(receipt.balance)
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








// const Receipt = require('../models/Receipt');
// const fs = require('fs');
// const path = require('path');
// const handlebars = require('handlebars');

// const formatCurrency = (amount) => {
//   // Remove the minus sign if amount is negative for display
//   const absAmount = Math.abs(amount);
//   return `NGN${absAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// };

// const formatNumber = (num) => {
//   return num.toLocaleString('en-US');
// };

// // Dynamic logo URL function - use new logo
// const getLogoUrl = () => {
//     return 'https://gani-eleke-project.vercel.app/frontend/img/logo.jpeg';
// };

// // Read HTML templates
// const customerTemplatePath = path.join(__dirname, '../receipt-templates/customer-receipt.html');
// const companyTemplatePath = path.join(__dirname, '../receipt-templates/company-receipt.html');

// const customerTemplate = fs.readFileSync(customerTemplatePath, 'utf8');
// const companyTemplate = fs.readFileSync(companyTemplatePath, 'utf8');

// const compiledCustomerTemplate = handlebars.compile(customerTemplate);
// const compiledCompanyTemplate = handlebars.compile(companyTemplate);

// /* =========================
//    COMPUTATION LOGIC
// ========================= */

// const computeReceipt = ({ customerName, credits = [], less = [], note }) => {
//   const normalizedCredits = credits.map((item) => {
//     const qty = Number(item.qty || 0);
//     const rate = Number(item.rate || 0);
//     const dust = Number(item.dust || 0);

//     const initialRate = Number(item.initialRate) || rate;
//     const initialAmount = qty * initialRate;
//     const finalAmount = (qty * rate) - dust;
//     const profit = finalAmount - initialAmount;

//     return {
//       description: item.description || '',
//       qty,
//       rate,
//       dust,
//       initialRate,
//       amount: Math.max(finalAmount, 0),
//       profit,
//       iAmount: initialAmount,
//       fAmount: finalAmount
//     };
//   });

//   const normalizedLess = less.map((item) => ({
//     description: item.description || '',
//     amount: Number(item.amount || 0),
//   }));

//   const subTotal = normalizedCredits.reduce((sum, i) => sum + i.amount, 0);
//   const debitTotal = normalizedLess.reduce((sum, i) => sum + i.amount, 0);
//   const balance = subTotal - debitTotal;

//   return {
//     customerName,
//     credits: normalizedCredits,
//     less: normalizedLess,
//     subTotal,
//     debitTotal,
//     balance,
//     note,
//   };
// };

// /* =========================
//    CREATE RECEIPT
// ========================= */

// const createReceipt = async (req, res) => {
//   const { customerName, credits, less, note, companyName, ...rest } = req.body;

//   if (!customerName || !credits?.length) {
//     return res.status(400).json({ message: 'Customer name and credits required' });
//   }

//   const data = computeReceipt({ customerName, credits, less, note });

//   const receipt = await Receipt.create({
//     ...rest,
//     ...data,
//     companyName: companyName || 'Africa Steel Ltd',
//     receiptNumber: `RCPT-${Date.now()}`,
//     createdBy: req.user._id
//   });

//   res.status(201).json(receipt);
// };

// /* =========================
//    GET ALL RECEIPTS
// ========================= */

// const getReceipts = async (req, res) => {
//   const receipts = await Receipt.find().populate('createdBy', 'name email role').sort({ createdAt: -1 });
//   res.json(receipts);
// };

// /* =========================
//    GET ONE RECEIPT
// ========================= */

// const getReceiptById = async (req, res) => {
//   const receipt = await Receipt.findById(req.params.id).populate('createdBy', 'name email role');
//   if (!receipt) return res.status(404).json({ message: 'Not found' });
//   res.json(receipt);
// };

// /* =========================
//    UPDATE RECEIPT
// ========================= */

// const updateReceipt = async (req, res) => {
//   const receipt = await Receipt.findById(req.params.id);
//   if (!receipt) {
//     return res.status(404).json({ message: 'Receipt not found.' });
//   }

//   const { companyInfo, receiptTitle, customerName, customerPhone, customerAddress, vehicle, creditorName, creditorPhone, credits, less, note, date, companyName } = req.body;
  
//   const data = computeReceipt({
//     customerName: customerName || receipt.customerName,
//     credits: credits || receipt.credits,
//     less: less || receipt.less,
//     note: note ?? receipt.note,
//   });

//   if (date) receipt.date = new Date(date);
//   if (receiptTitle) receipt.receiptTitle = receiptTitle;
//   if (companyInfo) receipt.companyInfo = companyInfo;
//   if (vehicle) receipt.vehicle = vehicle;
//   if (customerAddress) receipt.customerAddress = customerAddress;
//   if (creditorName) receipt.creditorName = creditorName;
//   if (creditorPhone) receipt.creditorPhone = creditorPhone;
//   if (customerName) receipt.customerName = data.customerName;
//   if (customerPhone) receipt.customerPhone = customerPhone;
//   if (companyName) receipt.companyName = companyName;
  
//   receipt.credits = data.credits;
//   receipt.less = data.less;
//   receipt.subTotal = data.subTotal;
//   receipt.debitTotal = data.debitTotal;
//   receipt.balance = data.balance;
//   if (note !== undefined) receipt.note = data.note;

//   await receipt.save();
//   res.json(receipt);
// };

// /* =========================
//    DELETE RECEIPT
// ========================= */

// const deleteReceipt = async (req, res) => {
//   const receipt = await Receipt.findById(req.params.id);
//   if (!receipt) {
//     return res.status(404).json({ message: 'Receipt not found.' });
//   }
//   await receipt.deleteOne();
//   res.json({ message: 'Receipt deleted.' });
// };

// /* =========================
//    GET RECEIPT SUMMARY
// ========================= */

// const getReceiptSummary = async (req, res) => {
//   const receipts = await Receipt.find();
//   const totalReceipts = receipts.length;
//   const totalCreditAmount = receipts.reduce((sum, receipt) => sum + (receipt.subTotal || 0), 0);
//   const totalDebitAmount = receipts.reduce((sum, receipt) => sum + (receipt.debitTotal || 0), 0);
//   const totalBalance = receipts.reduce((sum, receipt) => sum + (receipt.balance || 0), 0);
  
//   res.json({
//     totalReceipts,
//     totalCreditAmount,
//     totalDebitAmount,
//     totalBalance,
//   });
// };

// /* =========================
//    CLEAR ALL RECEIPTS
// ========================= */

// const clearReceipts = async (req, res) => {
//   await Receipt.deleteMany({});
//   res.json({ message: 'All receipts and balances have been cleared.' });
// };

// /* =========================
//    GENERATE HTML (instead of PDF/Image)
// ========================= */

// const getReceiptPdfCompany = async (receipt, res) => {
//   try {
//     console.log('Generating Company Receipt HTML for receipt:', receipt._id);
    
//     const date = new Date(receipt.date || Date.now());
//     const day = date.getDate().toString().padStart(2, '0');
//     const month = (date.getMonth() + 1).toString().padStart(2, '0');
//     const year = date.getFullYear().toString().slice(-2);
    
//     let totalCredit = 0;
//     let totalProfit = 0;
//     const profits = [];
    
//     const items = receipt.credits.map((item, index) => {
//       const iAmount = item.qty * (item.initialRate || item.rate);
//       const fAmount = (item.qty * item.rate) - (item.dust || 0);
//       const profit = fAmount - iAmount;
//       totalCredit += fAmount;
//       totalProfit += profit;
//       if (profit !== 0) {
//         profits.push({ name: item.description, amount: formatCurrency(profit) });
//       }
//       return {
//         description: item.description,
//         dust: item.dust || 0,
//         qty: item.qty,
//         iRate: item.initialRate || item.rate,
//         fRate: item.rate,
//         iAmount: formatNumber(iAmount),
//         fAmount: formatNumber(fAmount),
//         odd: index % 2 === 1
//       };
//     });
    
//     const offloadingAmount = receipt.less.find(l => l.description === 'Offloading')?.amount || 0;
//     const debitTotal = receipt.debitTotal || 0;
//     const balance = receipt.balance || 0;
    
//     const logoUrl = getLogoUrl();
    
//     const html = compiledCompanyTemplate({
//       logoUrl,
//       day,
//       month,
//       year,
//       companyName: receipt.companyName || receipt.companyInfo?.name || 'Africa Steel Ltd',
//       customerName: receipt.customerName || '',
//       customerAddress: receipt.customerAddress || '',
//       customerPhone: receipt.customerPhone || '',
//       vehicleNo: receipt.vehicle || '',
//       items,
//       offloadingAmount: formatNumber(offloadingAmount),
//       debtAmount: '',
//       profits,
//       totalProfit: formatCurrency(totalProfit > 0 ? totalProfit : 0),
//       creditAmount: formatCurrency(totalCredit),
//       debitAmount: formatCurrency(debitTotal),
//       balanceAmount: formatCurrency(balance)
//     });
    
//     // Send as HTML file
//     res.setHeader('Content-Type', 'text/html');
//     res.setHeader('Content-Disposition', `attachment; filename="receipt-${receipt.receiptNumber}-company.html"`);
//     res.send(html);
//   } catch (error) {
//     console.error('HTML Generation Error:', error);
//     res.status(500).json({ error: 'HTML generation failed', details: error.message });
//   }
// };

// const getReceiptPdfCustomer = async (receipt, res) => {
//   try {
//     console.log('Generating Customer Receipt HTML for receipt:', receipt._id);
    
//     const date = new Date(receipt.date || Date.now());
//     const day = date.getDate().toString().padStart(2, '0');
//     const month = (date.getMonth() + 1).toString().padStart(2, '0');
//     const year = date.getFullYear().toString().slice(-2);
    
//     let totalCredit = 0;
    
//     const items = receipt.credits.map((item, index) => {
//       const amount = (item.qty * item.rate) - (item.dust || 0);
//       totalCredit += amount;
//       return {
//         description: item.description,
//         dust: item.dust || 0,
//         qty: item.qty,
//         rate: item.rate,
//         amount: formatNumber(amount),
//         odd: index % 2 === 1
//       };
//     });
    
//     const offloadingAmount = receipt.less.find(l => l.description === 'Offloading')?.amount || 0;
//     const debitTotal = receipt.debitTotal || 0;
//     const balance = receipt.balance || 0;
    
//     const logoUrl = getLogoUrl();
    
//     const html = compiledCustomerTemplate({
//       logoUrl,
//       day,
//       month,
//       year,
//       companyName: receipt.companyName || receipt.companyInfo?.name || 'Africa Steel Ltd',
//       customerName: receipt.customerName || '',
//       customerAddress: receipt.customerAddress || '',
//       customerPhone: receipt.customerPhone || '',
//       vehicleNo: receipt.vehicle || '',
//       items,
//       offloadingAmount: formatNumber(offloadingAmount),
//       debtAmount: '',
//       creditAmount: formatCurrency(totalCredit),
//       debitAmount: formatCurrency(debitTotal),
//       balanceAmount: formatCurrency(balance)
//     });
    
//     // Send as HTML file
//     res.setHeader('Content-Type', 'text/html');
//     res.setHeader('Content-Disposition', `attachment; filename="receipt-${receipt.receiptNumber}-customer.html"`);
//     res.send(html);
//   } catch (error) {
//     console.error('HTML Generation Error:', error);
//     res.status(500).json({ error: 'HTML generation failed', details: error.message });
//   }
// };

// const getReceiptPdf = async (req, res) => {
//   const receipt = await Receipt.findById(req.params.id);
//   if (!receipt) return res.status(404).json({ message: 'Not found' });

//   const { type } = req.query;

//   if (type === 'customer') {
//     return getReceiptPdfCustomer(receipt, res);
//   }

//   return getReceiptPdfCompany(receipt, res);
// };

// /* =========================
//    EXPORTS
// ========================= */

// module.exports = {
//   createReceipt,
//   getReceipts,
//   getReceiptById,
//   updateReceipt,
//   deleteReceipt,
//   getReceiptSummary,
//   clearReceipts,
//   getReceiptPdf
// };
