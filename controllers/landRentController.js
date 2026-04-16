const LandRent = require('../models/LandRent');

// Create land rental
const createLandRent = async (req, res) => {
  const { customerName, customerPhone, truckType, material, amount, status, notes } = req.body;

  if (!customerName || !truckType || !material || amount === undefined) {
    return res.status(400).json({ message: 'Customer name, truck type, material, and amount are required.' });
  }

  const landRent = await LandRent.create({
    customerName: String(customerName).trim(),
    customerPhone: customerPhone ? String(customerPhone).trim() : '',
    truckType: String(truckType).trim(),
    material: String(material).trim(),
    amount: parseFloat(amount),
    status: status || 'pending',
    notes: notes ? String(notes).trim() : '',
    createdBy: req.user._id,
  });

  res.status(201).json(landRent);
};

// Get all land rentals
const getLandRents = async (req, res) => {
  const landRents = await LandRent.find().populate('createdBy', 'name').sort({ createdAt: -1 });
  res.json(landRents);
};

// Get single land rental
const getLandRentById = async (req, res) => {
  const landRent = await LandRent.findById(req.params.id).populate('createdBy', 'name');
  if (!landRent) {
    return res.status(404).json({ message: 'Land rental not found.' });
  }
  res.json(landRent);
};

// Update land rental
const updateLandRent = async (req, res) => {
  const landRent = await LandRent.findById(req.params.id);
  if (!landRent) {
    return res.status(404).json({ message: 'Land rental not found.' });
  }

  const allowedFields = ['customerName', 'customerPhone', 'truckType', 'material', 'amount', 'status', 'notes'];

  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      landRent[field] = req.body[field];
    }
  });

  await landRent.save();
  res.json(landRent);
};

// Delete land rental
const deleteLandRent = async (req, res) => {
  const landRent = await LandRent.findById(req.params.id);
  if (!landRent) {
    return res.status(404).json({ message: 'Land rental not found.' });
  }
  await landRent.deleteOne();
  res.json({ message: 'Land rental deleted.' });
};

// Get land rent summary - ONLY COUNT PAID RENTALS
const getLandRentSummary = async (req, res) => {
  const landRents = await LandRent.find();
  
  // Calculate current week revenue (Monday to Sunday)
  const now = new Date();
  const startOfWeek = new Date(now);
  const dayOfWeek = now.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfWeek.setDate(now.getDate() - daysToMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  // Only count PAID rentals for revenue
  const paidRentals = landRents.filter(r => r.status === 'paid');
  const totalRevenue = paidRentals.reduce((sum, r) => sum + (r.amount || 0), 0);
  
  const weeklyPaidRentals = landRents.filter(r => r.status === 'paid' && new Date(r.createdAt) >= startOfWeek && new Date(r.createdAt) <= endOfWeek);
  const weeklyRevenue = weeklyPaidRentals.reduce((sum, r) => sum + (r.amount || 0), 0);
  
  // Agent revenue = same as total revenue (from paid rentals)
  const agentRevenue = totalRevenue;
  const agentWeeklyRevenue = weeklyRevenue;
  const totalAgentRevenue = totalRevenue;

  res.json({
    totalRevenue,
    weeklyRevenue,
    agentRevenue,
    agentWeeklyRevenue,
    totalAgentRevenue,
  });
};

const clearLandRents = async (req, res) => {
  await LandRent.deleteMany({});
  res.json({ message: 'All land rentals have been cleared.' });
};

module.exports = { createLandRent, getLandRents, getLandRentById, updateLandRent, deleteLandRent, getLandRentSummary, clearLandRents };