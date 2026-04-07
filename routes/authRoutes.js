const express = require('express');
const { protect, authorizeAdmin } = require('../middleware/authMiddleware');
const { registerAdmin, loginUser, createUser } = require('../controllers/authController');

const router = express.Router();
router.post('/register', registerAdmin);
router.post('/login', loginUser);
router.post('/users', protect, authorizeAdmin, createUser);

module.exports = router;
