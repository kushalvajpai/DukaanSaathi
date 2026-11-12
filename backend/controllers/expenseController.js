const { pool } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

const ALLOWED_CATEGORIES = [
  'Electricity',
  'Shop Rent',
  'Transportation',
  'Employee Salary',
  'Packaging',
  'Maintenance',
  'Internet',
  'Marketing',
  'Other'
];

async function listExpenses(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const { search, category, start_date, end_date } = req.query;

    let sql = 'SELECT * FROM expenses WHERE business_id = ?';
    const params = [businessId];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (start_date) {
      sql += ' AND expense_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND expense_date <= ?';
      params.push(end_date);
    }
    if (search && search.trim()) {
      sql += ' AND (description LIKE ? OR category LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    sql += ' ORDER BY expense_date DESC, id DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ expenses: rows, categories: ALLOWED_CATEGORIES });
  } catch (err) {
    next(err);
  }
}

async function createExpense(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const { category, amount, description, expense_date } = req.body;

    const [ins] = await pool.query(
      'INSERT INTO expenses (business_id, category, amount, description, expense_date) VALUES (?, ?, ?, ?, ?)',
      [businessId, category, Number(amount), description.trim(), expense_date]
    );

    const [created] = await pool.query('SELECT * FROM expenses WHERE id = ?', [ins.insertId]);
    res.status(201).json({ message: 'Expense recorded', expense: created[0] });
  } catch (err) {
    next(err);
  }
}

async function updateExpense(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const expenseId = Number(req.params.id);
    const { category, amount, description, expense_date } = req.body;

    const [existing] = await pool.query(
      'SELECT id FROM expenses WHERE id = ? AND business_id = ?',
      [expenseId, businessId]
    );
    if (existing.length === 0) {
      throw new AppError('Expense not found.', 404);
    }

    await pool.query(
      'UPDATE expenses SET category = ?, amount = ?, description = ?, expense_date = ? WHERE id = ? AND business_id = ?',
      [category, Number(amount), description.trim(), expense_date, expenseId, businessId]
    );

    const [updated] = await pool.query('SELECT * FROM expenses WHERE id = ?', [expenseId]);
    res.json({ message: 'Expense updated', expense: updated[0] });
  } catch (err) {
    next(err);
  }
}

async function deleteExpense(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const expenseId = Number(req.params.id);

    const [del] = await pool.query(
      'DELETE FROM expenses WHERE id = ? AND business_id = ?',
      [expenseId, businessId]
    );
    if (del.affectedRows === 0) {
      throw new AppError('Expense not found.', 404);
    }
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  ALLOWED_CATEGORIES,
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense
};
