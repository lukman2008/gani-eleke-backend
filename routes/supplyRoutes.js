const express = require('express');
const router = express.Router();
const { createSupply, getSupplies, getSupplyById, updateSupply, updateStock, deleteSupply, getSupplySummary, getCategories, clearSupplies } = require('../controllers/supplyController');
const { protect, authorizeAdmin } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

router.route('/')
  .get(getSupplies)
  .post(createSupply);

router.route('/summary')
  .get(getSupplySummary);

router.route('/categories')
  .get(getCategories);

router.route('/clear')
  .delete(authorizeAdmin, clearSupplies);

router.route('/:id')
  .get(getSupplyById)
  .put(updateSupply)
  .delete(deleteSupply);

router.route('/:id/stock')
  .put(updateStock);

module.exports = router;