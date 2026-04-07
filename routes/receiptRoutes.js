const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { createReceipt, getReceipts, getReceiptById, updateReceipt, deleteReceipt, getReceiptSummary, getReceiptPdf } = require('../controllers/receiptController');

const router = express.Router();
router.use(protect);
router.route('/summary').get(getReceiptSummary);
router.route('/').get(getReceipts).post(createReceipt);
router.route('/:id/pdf').get(getReceiptPdf);
router.route('/:id').get(getReceiptById).put(updateReceipt).delete(deleteReceipt);

module.exports = router;
