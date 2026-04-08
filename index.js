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
const supplyRoutes = require('./routes/supplyRoutes');

const app = express();
const port = process.env.PORT || 5000;

// Configure CORS for both local and production
const allowedOrigins = [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:5000',
    'https://gani-eleke-project.vercel.app',
    'https://gani-eleke-backend.onrender.com'
];

app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes - MUST come before static files
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', environment: process.env.NODE_ENV || 'development' });
});

app.use('/api/auth', authRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/landrents', landRentRoutes);
app.use('/api/supplies', supplyRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
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
