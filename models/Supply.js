const mongoose = require('mongoose');

const supplySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  category: { type: String, required: true, trim: true },
  unit: { type: String, required: true, trim: true }, // e.g., "tons", "bags", "pieces"
  currentStock: { type: Number, required: true, min: 0, default: 0 },
  minimumStock: { type: Number, required: true, min: 0, default: 0 },
  unitPrice: { type: Number, required: true, min: 0 },
  supplier: { type: String, trim: true },
  location: { type: String, trim: true },
  status: { type: String, enum: ['active', 'inactive', 'discontinued'], default: 'active' },
  barcode: { type: String, trim: true },
  notes: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

// Virtual for stock status
supplySchema.virtual('stockStatus').get(function() {
  if (this.currentStock === 0) return 'out_of_stock';
  if (this.currentStock <= this.minimumStock) return 'low_stock';
  return 'in_stock';
});

// Virtual for total value
supplySchema.virtual('totalValue').get(function() {
  return this.currentStock * this.unitPrice;
});

// Ensure virtual fields are serialized
supplySchema.set('toJSON', { virtuals: true });
supplySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Supply', supplySchema);