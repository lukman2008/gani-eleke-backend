const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
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

// All routes require authentication
router.use(protect);

// Receipt routes
router.post('/', createReceipt);
router.get('/', getReceipts);
router.get('/summary', getReceiptSummary);
router.get('/clear', clearReceipts);  // NOTE: This should be before /:id
router.delete('/clear', clearReceipts);  // DELETE method for clearing
router.get('/:id', getReceiptById);
router.put('/:id', updateReceipt);
router.delete('/:id', deleteReceipt);
router.get('/:id/pdf', getReceiptPdf);

module.exports = router;