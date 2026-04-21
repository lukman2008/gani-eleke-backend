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
    getReceiptHTML
} = require('../controllers/receiptController');

router.use(protect);

router.post('/', createReceipt);
router.get('/', getReceipts);
router.get('/summary', getReceiptSummary);
router.get('/clear', clearReceipts);
router.delete('/clear', clearReceipts);
router.get('/:id', getReceiptById);
router.put('/:id', updateReceipt);
router.delete('/:id', deleteReceipt);
router.get('/:id/html', getReceiptHTML);  // New endpoint for HTML

module.exports = router;