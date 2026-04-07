const express = require('express');
const router = express.Router();
const { createSupply, getSupplies, getSupplyById, updateSupply, updateStock, deleteSupply, getSupplySummary, getCategories } = require('../controllers/supplyController');
const { protect } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

router.route('/')
  .get(getSupplies)
  .post(createSupply);

router.route('/summary')
  .get(getSupplySummary);

router.route('/categories')
  .get(getCategories);

router.route('/:id')
  .get(getSupplyById)
  .put(updateSupply)
  .delete(deleteSupply);

router.route('/:id/stock')
  .put(updateStock);

module.exports = router;