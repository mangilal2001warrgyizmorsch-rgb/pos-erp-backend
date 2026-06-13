import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';

import connectDB from './config/db.js';
import errorHandler from './middleware/errorHandler.js';
import http from 'http';
import { initSocket } from './utils/socket.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import subcategoryRoutes from './routes/subcategoryRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import transporterRoutes from './routes/transporterRoutes.js';
import saleRoutes from './routes/saleRoutes.js';
import purchaseRoutes from './routes/purchaseRoutes.js';
import saleReturnRoutes from './routes/saleReturnRoutes.js';
import purchaseReturnRoutes from './routes/purchaseReturnRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import expenseCategoryRoutes from './routes/expenseCategoryRoutes.js';
import returnRoutes from './routes/returnRoutes.js';
import shiftRoutes from './routes/shiftRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import salesPriceRoutes from './routes/salesPriceRoutes.js';
import bankRoutes from './routes/bankRoutes.js';
import loanRoutes from './routes/loanRoutes.js';
import chequeRoutes from './routes/chequeRoutes.js';
import businessRoutes from './routes/businessRoutes.js';
import paymentInRoutes from './routes/paymentInRoutes.js';
import paymentOutRoutes from './routes/paymentOutRoutes.js';
import cashBankRoutes from './routes/cashBankRoutes.js';
import partyLedgerRoutes from './routes/partyLedgerRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import stockRoutes from './routes/stockRoutes.js';
import activityLogRoutes from './routes/activityLogRoutes.js';
import accountingRoutes from './routes/accounting.routes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { reconcileLegacyLedgers } from './utils/reconcileLedgers.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to database
connectDB();

const app = express();

const configuredOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || process.env.NODE_ENV !== 'production' || configuredOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per `window` (here, per 15 minutes)
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per `window` for auth routes
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
});

app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter);


if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Static files
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/subcategories', subcategoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/transporters', transporterRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sales-returns', saleReturnRoutes);
app.use('/api/sale-returns', saleReturnRoutes);
app.use('/api/purchases-returns', purchaseReturnRoutes);
app.use('/api/purchase-returns', purchaseReturnRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/expense-categories', expenseCategoryRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sales-prices', salesPriceRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/bank', bankRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/cheques', chequeRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/payment-in', paymentInRoutes);
app.use('/api/payment-out', paymentOutRoutes);
app.use('/api/cash-bank', cashBankRoutes);
app.use('/api/ledger', partyLedgerRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/notifications', notificationRoutes);


// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'POS ERP API is running' });
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5500;

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, async () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  // Run legacy ledger reconciliation on startup
  await reconcileLegacyLedgers();
});

export default app;
