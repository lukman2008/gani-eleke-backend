const mongoose = require('mongoose');

const landRentSchema = new mongoose.Schema({
  customerName: { type: String, required: true, trim: true },
  customerPhone: { type: String, trim: true, default: '' },
  truckType: { type: String, required: true, trim: true },
  material: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  notes: { type: String, trim: true, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('LandRent', landRentSchema);