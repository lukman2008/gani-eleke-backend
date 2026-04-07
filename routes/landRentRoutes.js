const express = require('express');
const router = express.Router();
const { createLandRent, getLandRents, getLandRentById, updateLandRent, deleteLandRent, getLandRentSummary, clearLandRents } = require('../controllers/landRentController');
const { protect, authorizeAdmin } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

router.route('/')
  .get(getLandRents)
  .post(createLandRent);

router.route('/summary')
  .get(getLandRentSummary);

router.route('/clear')
  .delete(authorizeAdmin, clearLandRents);

router.route('/:id')
  .get(getLandRentById)
  .put(updateLandRent)
  .delete(deleteLandRent);

module.exports = router;