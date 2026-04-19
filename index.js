const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const authRoutes = require('./routes/authRoutes');
const receiptRoutes = require('./routes/receiptRoutes');
const landRentRoutes = require('./routes/landRentRoutes');
// const supplyRoutes = require('./routes/supplyRoutes');

const app = express();
const port = process.env.PORT || 5000;

// SIMPLE CORS - Allow all origins (fix for now)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', environment: process.env.NODE_ENV || 'development' });
});

app.use('/api/auth', authRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/landrents', landRentRoutes);
// app.use('/api/supplies', supplyRoutes);

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({ 
            message: 'Validation Error', 
            errors: Object.values(err.errors).map(e => e.message)
        });
    }
    
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
});

app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📍 Local API: http://localhost:${port}/api/health`);
});

// const express = require('express');
// const dotenv = require('dotenv');
// const cors = require('cors');
// const connectDB = require('./config/db');

// dotenv.config();
// connectDB();

// const authRoutes = require('./routes/authRoutes');
// const receiptRoutes = require('./routes/receiptRoutes');
// const landRentRoutes = require('./routes/landRentRoutes');
// const supplyRoutes = require('./routes/supplyRoutes');

// const app = express();
// const port = process.env.PORT || 5000;

// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// app.get('/', (req, res) => {
//   res.send(' backend is running!');
// });

// app.use('/api/auth', authRoutes);
// app.use('/api/receipts', receiptRoutes);
// app.use('/api/landrents', landRentRoutes);
// app.use('/api/supplies', supplyRoutes);

// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).json({ message: 'Something went wrong!'});
// });

// app.listen(port, () => {
//   console.log(`🚀 Server running on http://localhost:${port}`);
// });
