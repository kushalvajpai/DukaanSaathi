const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool, withTransaction } = require('../config/db');
const { getJwtSecret } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

const COOKIE_NAME = 'dukaansaathi_token';

function getCookieOptions() {
  const isSecure = process.env.COOKIE_SECURE === 'true';
  return {
    httpOnly: true,
    sameSite: isSecure ? 'none' : 'lax',
    secure: isSecure
  };
}

function setAuthCookie(res, payload) {
  const token = jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });

  res.cookie(COOKIE_NAME, token, {
    ...getCookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

async function register(req, res, next) {
  try {
    const { ownerName, email, phone, password, storeName, businessType } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length > 0) {
      throw new AppError('An account with this email already exists.', 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const created = await withTransaction(async (conn) => {
      const [userRes] = await conn.query(
        'INSERT INTO users (owner_name, email, phone, password_hash) VALUES (?, ?, ?, ?)',
        [ownerName.trim(), normalizedEmail, phone.trim(), passwordHash]
      );
      const userId = userRes.insertId;

      const [bizRes] = await conn.query(
        'INSERT INTO businesses (user_id, store_name, business_type, currency) VALUES (?, ?, ?, ?)',
        [userId, storeName.trim(), (businessType || 'Kirana / General Store').trim(), 'INR']
      );
      const businessId = bizRes.insertId;

      // Seed default categories for a new business
      const defaultCategories = ['Groceries', 'Dairy & Bakery', 'Snacks & Beverages', 'Personal Care', 'General'];
      for (const cat of defaultCategories) {
        await conn.query('INSERT INTO categories (business_id, name) VALUES (?, ?)', [businessId, cat]);
      }

      return { userId, businessId };
    });

    setAuthCookie(res, {
      userId: created.userId,
      businessId: created.businessId,
      email: normalizedEmail
    });

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: created.userId,
        ownerName: ownerName.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        businessId: created.businessId,
        storeName: storeName.trim(),
        businessType: (businessType || 'Kirana / General Store').trim()
      }
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    const [rows] = await pool.query(
      `SELECT u.id AS user_id, u.owner_name, u.email, u.phone, u.password_hash,
              b.id AS business_id, b.store_name, b.business_type, b.currency
       FROM users u
       JOIN businesses b ON b.user_id = u.id
       WHERE u.email = ?
       LIMIT 1`,
      [normalizedEmail]
    );

    if (rows.length === 0) {
      throw new AppError('Invalid email or password.', 401);
    }

    const record = rows[0];
    const isMatch = await bcrypt.compare(password, record.password_hash);
    if (!isMatch) {
      throw new AppError('Invalid email or password.', 401);
    }

    setAuthCookie(res, {
      userId: record.user_id,
      businessId: record.business_id,
      email: record.email
    });

    res.json({
      message: 'Login successful',
      user: {
        id: record.user_id,
        ownerName: record.owner_name,
        email: record.email,
        phone: record.phone,
        businessId: record.business_id,
        storeName: record.store_name,
        businessType: record.business_type,
        currency: record.currency
      }
    });
  } catch (err) {
    next(err);
  }
}

function logout(req, res) {
  res.clearCookie(COOKIE_NAME, getCookieOptions());
  res.json({ message: 'Logged out successfully' });
}

async function getMe(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT u.id AS user_id, u.owner_name, u.email, u.phone,
              b.id AS business_id, b.store_name, b.business_type, b.currency
       FROM users u
       JOIN businesses b ON b.user_id = u.id
       WHERE u.id = ? AND b.id = ?
       LIMIT 1`,
      [req.user.userId, req.user.businessId]
    );

    if (rows.length === 0) {
      throw new AppError('User account not found.', 404);
    }

    const r = rows[0];
    res.json({
      user: {
        id: r.user_id,
        ownerName: r.owner_name,
        email: r.email,
        phone: r.phone,
        businessId: r.business_id,
        storeName: r.store_name,
        businessType: r.business_type,
        currency: r.currency
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  logout,
  getMe
};
