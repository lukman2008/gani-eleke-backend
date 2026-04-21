const mongoose = require('mongoose');

const creditItemSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  qty: { type: Number, required: true, min: 0 },
  rate: { type: Number, required: true, min: 0 },
  dust: { type: Number, default: 0, min: 0 },
  effectiveQty: { type: Number, default: 0, min: 0 },
  initialRate: { type: Number, default: 0, min: 0 },
  iAmount: { type: Number, default: 0 },
  fAmount: { type: Number, default: 0 },
  profit: { type: Number, default: 0 },
}, { _id: false });

const deductionSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
}, { _id: false });

const receiptSchema = new mongoose.Schema({
  receiptNumber: { type: String, required: true, unique: true, trim: true },
  date: { type: Date, default: Date.now },
  receiptTitle: { type: String, trim: true, default: 'Receipt' },
  companyInfo: {
    name: { type: String, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    whatsapp: { type: String, trim: true },
    address: { type: String, trim: true },
  },
  vehicle: { type: String, trim: true },
  creditorName: { type: String, trim: true },
  creditorPhone: { type: String, trim: true },
  customerName: { type: String, required: true, trim: true },
  customerPhone: { type: String, trim: true },
  customerAddress: { type: String, trim: true, default: '' },
  companyName: { type: String, trim: true, default: '' },
  credits: { type: [creditItemSchema], required: true },
  less: { type: [deductionSchema], default: [] },
  subTotal: { type: Number, required: true, min: 0 },
  totalCostPrice: { type: Number, default: 0, min: 0 },
  totalProfitBeforeOffloading: { type: Number, default: 0 },
  netProfit: { type: Number, default: 0 },
  offloadingAmount: { type: Number, default: 0 },
  debtAmount: { type: Number, default: 0 },
  cashReceived: { type: Number, default: 0 },
  cashInHand: { type: Number, default: 0 },
  debitTotal: { type: Number, required: true, min: 0, default: 0 },
  balance: { type: Number, required: true, min: 0, default: 0 },
  note: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Receipt', receiptSchema);