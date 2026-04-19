const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
    createLandRent,
    getLandRents,
    getLandRentById,
    updateLandRent,
    deleteLandRent,
    getLandRentSummary,
    clearLandRents
} = require('../controllers/landRentController');

// All routes require authentication
router.use(protect);

// Routes
router.route('/')
    .get(getLandRents)
    .post(createLandRent);

router.get('/summary', getLandRentSummary);

router.delete('/clear', adminOnly, clearLandRents);

router.route('/:id')
    .get(getLandRentById)
    .put(updateLandRent)
    .delete(deleteLandRent);

module.exports = router;