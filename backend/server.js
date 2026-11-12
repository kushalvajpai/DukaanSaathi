const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const { pool } = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');
const { seedDemoBusiness, DEMO_EMAIL } = require('./services/seedService');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const salesRoutes = require('./routes/salesRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const financeRoutes = require('./routes/financeRoutes');

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.set('trust proxy', 1);

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL.trim());
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.endsWith('.vercel.app') ||
        origin.endsWith('.up.railway.app') ||
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }
      console.warn(`[CORS Blocked] Origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Serve frontend static assets
app.use(express.static(path.resolve(__dirname, '../frontend')));

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api', financeRoutes);

// Fallback for API 404
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Error handler
app.use(errorHandler);

const fs = require('fs');

async function ensureDemoSeeded() {
  try {
    const [tables] = await pool.query("SHOW TABLES LIKE 'users'");
    if (tables.length === 0) {
      const schemaPath = path.resolve(__dirname, '../database/schema.sql');
      const rawSql = fs.readFileSync(schemaPath, 'utf8');
      const statements = rawSql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !/^CREATE\s+DATABASE/i.test(s) && !/^USE\s+/i.test(s));

      for (const stmt of statements) {
        await pool.query(stmt);
      }
      console.log('[DB] Initialized database tables from schema.sql.');
    }

    const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [DEMO_EMAIL]);
    if (rows.length === 0) {
      await seedDemoBusiness();
      console.log(`[Seed] Demo business "Sharma General Store" (${DEMO_EMAIL}) created.`);
    }
  } catch (err) {
    console.error('[Seed Warning] Could not verify/seed demo account:', err.message);
  }
}

if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`DukaanSaathi server running on http://localhost:${PORT}`);
    await ensureDemoSeeded();
  });
}

module.exports = app;
