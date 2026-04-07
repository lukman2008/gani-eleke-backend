const mongoose = require('mongoose');

const landRentSchema = new mongoose.Schema({
  customerName: { type: String, required: true, trim: true },
  customerPhone: { type: String, trim: true },
  truckType: { type: String, required: true, trim: true },
  startDate: { type: Date, required: true },
  duration: { type: Number, required: true, min: 1 }, // in days
  plotNumber: { type: String, required: true, trim: true },
  rentalRate: { type: Number, required: true, min: 0 }, // daily rate
  totalAmount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  endDate: { type: Date },
  notes: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('LandRent', landRentSchema);