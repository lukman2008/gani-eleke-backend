const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
};

// First admin registration (no secret needed for first user)
const registerAdmin = async (req, res) => {
  const { name, email, password, role, adminSecret } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required.' });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: 'User already exists.' });
  }

  const userCount = await User.countDocuments();
  
  // If this is the first user, allow registration without secret
  // Otherwise, require admin secret
  if (userCount > 0 && adminSecret !== process.env.ADMIN_SECRET && adminSecret !== 'GaniEleke@2025') {
    return res.status(403).json({ message: 'Admin secret is required to register a new administrator.' });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: role || 'admin',
  });

  res.status(201).json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: generateToken(user._id),
  });
};

// Login user
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: generateToken(user._id),
  });
};

// Create user (deprecated - use createStaff instead)
const createUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required for staff creation.' });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: 'A user with that email already exists.' });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: role || 'manager',
  });

  res.status(201).json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
};

// Get all staff users (Admin only)
const getAllStaff = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    const staff = await User.find({ role: { $ne: 'admin' } }).select('-password').sort({ createdAt: -1 });
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create staff account (Admin only)
const createStaff = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    const { name, email, password, role } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }
    
    // Validate role
    const allowedRoles = ['manager', 'agent', 'secretary', 'staff'];
    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Allowed roles: manager, agent, secretary, staff' });
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'staff',
    });
    
    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      message: 'Staff account created successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update staff account (Admin only)
const updateStaff = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    const { id } = req.params;
    const { name, email, role, password } = req.body;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'Staff not found' });
    }
    
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Cannot modify admin account' });
    }
    
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }
    
    await user.save();
    
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      message: 'Staff updated successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete staff account (Admin only)
const deleteStaff = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    const { id } = req.params;
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ message: 'Staff not found' });
    }
    
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Cannot delete admin account' });
    }
    
    await user.deleteOne();
    res.json({ message: 'Staff account deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get current user info
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { 
  registerAdmin, 
  loginUser, 
  createUser,
  getAllStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  getMe
};