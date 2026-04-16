const mongoose = require('mongoose');

const creditItemSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  qty: { type: Number, required: true, min: 0 },
  rate: { type: Number, required: true, min: 0 },
  dust: { type: Number, default: 0, min: 0 },
  effectiveQty: { type: Number, default: 0, min: 0 },  // ADD THIS
  initialRate: { type: Number, default: 0, min: 0 },   // ADD THIS
  amount: { type: Number, required: true, min: 0 },
  profit: { type: Number, default: 0 },                 // ADD THIS
  iAmount: { type: Number, default: 0 },               // ADD THIS
  fAmount: { type: Number, default: 0 }                // ADD THIS
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
  companyName: { type: String, trim: true, default: '' },  // ADD THIS
  credits: { type: [creditItemSchema], required: true },
  less: { type: [deductionSchema], default: [] },
  subTotal: { type: Number, required: true, min: 0 },
  debitTotal: { type: Number, required: true, min: 0, default: 0 },
  balance: { type: Number, required: true, min: 0 },
  note: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Receipt', receiptSchema);