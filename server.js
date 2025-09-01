const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const passport = require('passport');
require('dotenv').config();

const connectDB = require('./src/config/database');
const { errorHandler } = require('./src/utils/errorHandler');

// Routes
const authRoutes = require('./src/routes/auth');
const uploadRoutes = require('./src/routes/upload');
const analysisRoutes = require('./src/routes/analysis');
const chatRoutes = require('./src/routes/chat');
const exportRoutes = require('./src/routes/export');

const app = express();

// Connect to MongoDB
connectDB();

// CORS middleware: must be FIRST, before any other middleware
const corsOptions = {
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Origin',
    'X-Requested-With',
    'Accept',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Headers',
    'Access-Control-Allow-Methods'
  ],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Body parsing middleware - MUST come after CORS
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "script-src": ["'self'"],
      "img-src": ["'self'", "data:", "https://*"],
      "connect-src": ["'self'", "http://localhost:3000", "https://api.example.com"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});
app.use(limiter);

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Static files
app.use('/uploads', express.static('uploads'));
app.use('/exports', express.static('exports'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/export', exportRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'AI Study Helper API is running' });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});