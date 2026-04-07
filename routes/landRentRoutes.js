const express = require('express');
const router = express.Router();
const { createLandRent, getLandRents, getLandRentById, updateLandRent, deleteLandRent, getLandRentSummary } = require('../controllers/landRentController');
const { protect } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

router.route('/')
  .get(getLandRents)
  .post(createLandRent);

router.route('/summary')
  .get(getLandRentSummary);

router.route('/:id')
  .get(getLandRentById)
  .put(updateLandRent)
  .delete(deleteLandRent);

module.exports = router;