const express = require('express');
const { protect, authorizeAdmin } = require('../middleware/authMiddleware');
const { 
  createReceipt, 
  getReceipts, 
  getReceiptById, 
  updateReceipt,
  deleteReceipt, 
  getReceiptSummary,
  clearReceipts,
  getReceiptPdf 
} = require('../controllers/receiptController');

const router = express.Router();

router.use(protect);

// Summary and clear routes
router.route('/summary').get(getReceiptSummary);
router.route('/clear').delete(authorizeAdmin, clearReceipts);

// Main CRUD routes
router.route('/')
  .get(getReceipts)
  .post(createReceipt);

// PDF route
router.route('/:id/pdf').get(getReceiptPdf);

// Single receipt routes
router.route('/:id')
  .get(getReceiptById)
  .put(updateReceipt)
  .delete(deleteReceipt);

module.exports = router;