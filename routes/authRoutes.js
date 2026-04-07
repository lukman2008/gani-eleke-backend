const express = require('express');
const { registerAdmin, loginUser } = require('../controllers/authController');

const router = express.Router();
router.post('/register', registerAdmin);
router.post('/login', loginUser);

module.exports = router;
