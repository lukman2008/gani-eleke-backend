const LandRent = require('../models/LandRent');

// Create land rental
const createLandRent = async (req, res) => {
  const { customerName, customerPhone, truckType, startDate, duration, plotNumber, rentalRate, notes } = req.body;

  if (!customerName || !truckType || !startDate || !duration || !plotNumber || !rentalRate) {
    return res.status(400).json({ message: 'All required fields must be provided.' });
  }

  const start = new Date(startDate);
  const endDate = new Date(start);
  endDate.setDate(start.getDate() + parseInt(duration));

  const totalAmount = parseFloat(rentalRate) * parseInt(duration);

  const landRent = await LandRent.create({
    customerName: String(customerName).trim(),
    customerPhone: customerPhone ? String(customerPhone).trim() : '',
    truckType: String(truckType).trim(),
    startDate: start,
    duration: parseInt(duration),
    plotNumber: String(plotNumber).trim(),
    rentalRate: parseFloat(rentalRate),
    totalAmount,
    endDate,
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

  const updates = {};
  const allowedFields = ['customerName', 'customerPhone', 'truckType', 'startDate', 'duration', 'plotNumber', 'rentalRate', 'status', 'notes'];

  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  // Recalculate total amount if rate or duration changed
  if (updates.rentalRate || updates.duration) {
    const rate = updates.rentalRate || landRent.rentalRate;
    const duration = updates.duration || landRent.duration;
    updates.totalAmount = parseFloat(rate) * parseInt(duration);

    // Recalculate end date if start date or duration changed
    if (updates.startDate || updates.duration) {
      const start = updates.startDate ? new Date(updates.startDate) : landRent.startDate;
      const dur = updates.duration || landRent.duration;
      updates.endDate = new Date(start);
      updates.endDate.setDate(start.getDate() + parseInt(dur));
    }
  }

  Object.assign(landRent, updates);
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

// Get land rent summary
const getLandRentSummary = async (req, res) => {
  const landRents = await LandRent.find();
  const totalRentals = landRents.length;
  const activeRentals = landRents.filter(r => r.status === 'active').length;
  const totalRevenue = landRents.reduce((sum, r) => sum + r.totalAmount, 0);
  const activeRevenue = landRents.filter(r => r.status === 'active').reduce((sum, r) => sum + r.totalAmount, 0);

  res.json({
    totalRentals,
    activeRentals,
    totalRevenue,
    activeRevenue,
  });
};

module.exports = { createLandRent, getLandRents, getLandRentById, updateLandRent, deleteLandRent, getLandRentSummary };