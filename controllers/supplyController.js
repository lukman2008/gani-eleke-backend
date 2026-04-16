const Supply = require('../models/Supply');

// Create supply
const createSupply = async (req, res) => {
  const { name, description, category, unit, currentStock, minimumStock, unitPrice, supplier, location, barcode, notes } = req.body;

  if (!name || !category || !unit || unitPrice === undefined) {
    return res.status(400).json({ message: 'Name, category, unit, and unit price are required.' });
  }

  const supply = await Supply.create({
    name: String(name).trim(),
    description: description ? String(description).trim() : '',
    category: String(category).trim(),
    unit: String(unit).trim(),
    currentStock: Number(currentStock) || 0,
    minimumStock: Number(minimumStock) || 0,
    unitPrice: Number(unitPrice),
    supplier: supplier ? String(supplier).trim() : '',
    location: location ? String(location).trim() : '',
    barcode: barcode ? String(barcode).trim() : '',
    notes: notes ? String(notes).trim() : '',
    createdBy: req.user._id,
  });

  res.status(201).json(supply);
};

// Get all supplies
const getSupplies = async (req, res) => {
  const { category, status, stockStatus } = req.query;
  let query = {};

  if (category) query.category = category;
  if (status) query.status = status;
  if (stockStatus) {
    switch (stockStatus) {
      case 'out_of_stock':
        query.currentStock = 0;
        break;
      case 'low_stock':
        query.$expr = { $lte: ['$currentStock', '$minimumStock'] };
        query.currentStock = { $gt: 0 };
        break;
      case 'in_stock':
        query.$expr = { $gt: ['$currentStock', '$minimumStock'] };
        break;
    }
  }

  const supplies = await Supply.find(query).populate('createdBy', 'name').sort({ createdAt: -1 });
  res.json(supplies);
};

// Get single supply
const getSupplyById = async (req, res) => {
  const supply = await Supply.findById(req.params.id).populate('createdBy', 'name');
  if (!supply) {
    return res.status(404).json({ message: 'Supply not found.' });
  }
  res.json(supply);
};

// Update supply
const updateSupply = async (req, res) => {
  const supply = await Supply.findById(req.params.id);
  if (!supply) {
    return res.status(404).json({ message: 'Supply not found.' });
  }

  const updates = {};
  const allowedFields = ['name', 'description', 'category', 'unit', 'currentStock', 'minimumStock', 'unitPrice', 'supplier', 'location', 'status', 'barcode', 'notes'];

  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  Object.assign(supply, updates);
  await supply.save();

  res.json(supply);
};

// Update stock (add/subtract inventory)
const updateStock = async (req, res) => {
  const { quantity, operation } = req.body; // operation: 'add' or 'subtract'

  if (!quantity || !operation) {
    return res.status(400).json({ message: 'Quantity and operation are required.' });
  }

  const supply = await Supply.findById(req.params.id);
  if (!supply) {
    return res.status(404).json({ message: 'Supply not found.' });
  }

  const qty = Number(quantity);
  if (operation === 'add') {
    supply.currentStock += qty;
  } else if (operation === 'subtract') {
    if (supply.currentStock < qty) {
      return res.status(400).json({ message: 'Insufficient stock.' });
    }
    supply.currentStock -= qty;
  } else {
    return res.status(400).json({ message: 'Invalid operation. Use "add" or "subtract".' });
  }

  await supply.save();
  res.json(supply);
};

// Delete supply
const deleteSupply = async (req, res) => {
  const supply = await Supply.findById(req.params.id);
  if (!supply) {
    return res.status(404).json({ message: 'Supply not found.' });
  }

  await supply.deleteOne();
  res.json({ message: 'Supply deleted.' });
};

// Get supply summary
const getSupplySummary = async (req, res) => {
  const supplies = await Supply.find();
  const totalSupplies = supplies.length;
  const activeSupplies = supplies.filter(s => s.status === 'active').length;
  const lowStockItems = supplies.filter(s => s.currentStock <= s.minimumStock && s.currentStock > 0).length;
  const outOfStockItems = supplies.filter(s => s.currentStock === 0).length;
  const totalValue = supplies.reduce((sum, s) => sum + s.totalValue, 0);

  res.json({
    totalSupplies,
    activeSupplies,
    lowStockItems,
    outOfStockItems,
    totalValue,
  });
};

// Get categories
const getCategories = async (req, res) => {
  const categories = await Supply.distinct('category');
  res.json(categories);
};

const clearSupplies = async (req, res) => {
  await Supply.deleteMany({});
  res.json({ message: 'All supplies have been cleared.' });
};

module.exports = { createSupply, getSupplies, getSupplyById, updateSupply, updateStock, deleteSupply, getSupplySummary, getCategories, clearSupplies };