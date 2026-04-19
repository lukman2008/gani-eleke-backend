const LandRent = require('../models/LandRent');

// Create land rental
const createLandRent = async (req, res) => {
    try {
        const { customerName, customerPhone, truckType, material, amount, status, notes } = req.body;
        
        const landRent = await LandRent.create({
            customerName,
            customerPhone,
            truckType,
            material,
            amount,
            status: status || 'pending',
            notes,
            createdBy: req.user._id
        });
        
        res.status(201).json(landRent);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get all land rentals
const getLandRents = async (req, res) => {
    try {
        const landRents = await LandRent.find().populate('createdBy', 'name email').sort({ createdAt: -1 });
        res.json(landRents);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get single land rental
const getLandRentById = async (req, res) => {
    try {
        const landRent = await LandRent.findById(req.params.id).populate('createdBy', 'name email');
        if (!landRent) return res.status(404).json({ message: 'Land rental not found' });
        res.json(landRent);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update land rental
const updateLandRent = async (req, res) => {
    try {
        const landRent = await LandRent.findById(req.params.id);
        if (!landRent) return res.status(404).json({ message: 'Land rental not found' });
        
        const { customerName, customerPhone, truckType, material, amount, status, notes } = req.body;
        
        if (customerName) landRent.customerName = customerName;
        if (customerPhone) landRent.customerPhone = customerPhone;
        if (truckType) landRent.truckType = truckType;
        if (material) landRent.material = material;
        if (amount) landRent.amount = amount;
        if (status) landRent.status = status;
        if (notes) landRent.notes = notes;
        
        await landRent.save();
        res.json(landRent);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete land rental
const deleteLandRent = async (req, res) => {
    try {
        const landRent = await LandRent.findById(req.params.id);
        if (!landRent) return res.status(404).json({ message: 'Land rental not found' });
        
        await landRent.deleteOne();
        res.json({ message: 'Land rental deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get land rental summary
const getLandRentSummary = async (req, res) => {
    try {
        const landRents = await LandRent.find();
        
        const totalRevenue = landRents
            .filter(r => r.status === 'paid')
            .reduce((sum, r) => sum + (r.amount || 0), 0);
        
        // Calculate weekly revenue
        const now = new Date();
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        oneWeekAgo.setHours(0, 0, 0, 0);
        
        const weeklyRevenue = landRents
            .filter(r => r.status === 'paid' && new Date(r.createdAt) >= oneWeekAgo)
            .reduce((sum, r) => sum + (r.amount || 0), 0);
        
        res.json({
            totalRevenue,
            weeklyRevenue,
            totalCount: landRents.length,
            paidCount: landRents.filter(r => r.status === 'paid').length,
            pendingCount: landRents.filter(r => r.status === 'pending').length
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Clear all land rentals (Admin only)
const clearLandRents = async (req, res) => {
    try {
        await LandRent.deleteMany({});
        res.json({ message: 'All land rentals cleared successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createLandRent,
    getLandRents,
    getLandRentById,
    updateLandRent,
    deleteLandRent,
    getLandRentSummary,
    clearLandRents
};