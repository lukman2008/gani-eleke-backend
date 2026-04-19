const express = require('express');
const router = express.Router();
const { 
    registerAdmin, 
    loginUser, 
    getAllStaff,
    createStaff,
    updateStaff,
    deleteStaff,
    getMe
} = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Public routes (no authentication needed)
router.post('/register', registerAdmin);
router.post('/login', loginUser);

// Protected routes (require authentication)
router.get('/me', protect, getMe);

// Admin only routes (require authentication + admin role)
router.get('/staff', protect, adminOnly, getAllStaff);
router.post('/staff', protect, adminOnly, createStaff);
router.put('/staff/:id', protect, adminOnly, updateStaff);
router.delete('/staff/:id', protect, adminOnly, deleteStaff);

module.exports = router;