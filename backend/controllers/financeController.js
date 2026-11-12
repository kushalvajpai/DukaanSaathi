const { pool } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { runADSA } = require('../services/adsaService');
const { seedDemoBusiness, DEMO_EMAIL } = require('../services/seedService');

function resolveDateRange(range = 'month', startParam, endParam) {
  const now = new Date();
  const toYMD = (d) => d.toISOString().slice(0, 10);
  const todayStr = toYMD(now);

  if (range === 'today') {
    return { start: todayStr, end: todayStr };
  }
  if (range === '7d') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { start: toYMD(start), end: todayStr };
  }
  if (range === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: toYMD(start), end: todayStr };
  }
  if (range === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: toYMD(start), end: toYMD(end) };
  }
  if (range === 'custom' && startParam && endParam) {
    return { start: startParam, end: endParam };
  }
  if (range === 'all') {
    return { start: '2000-01-01', end: '2099-12-31' };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: toYMD(start), end: todayStr };
}

async function computePnLData(businessId, start, end) {
  const [[salesAgg]] = await pool.query(
    `SELECT COALESCE(SUM(total_amount), 0) AS revenue,
            COALESCE(SUM(total_cogs), 0) AS cogs,
            COALESCE(SUM(gross_profit), 0) AS gross_profit,
            COUNT(*) AS total_transactions
     FROM sales
     WHERE business_id = ? AND DATE(sale_date) BETWEEN ? AND ?`,
    [businessId, start, end]
  );

  const [[expAgg]] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS operating_expenses
     FROM expenses
     WHERE business_id = ? AND expense_date BETWEEN ? AND ?`,
    [businessId, start, end]
  );

  const revenue = Number(salesAgg.revenue || 0);
  const cogs = Number(salesAgg.cogs || 0);
  const grossProfit = Number((revenue - cogs).toFixed(2));
  const operatingExpenses = Number(expAgg.operating_expenses || 0);
  const netProfit = Number((grossProfit - operatingExpenses).toFixed(2));
  const profitMargin = revenue > 0 ? Number(((netProfit / revenue) * 100).toFixed(2)) : 0;

  let status = 'BREAK_EVEN';
  if (netProfit > 0) status = 'PROFIT';
  else if (netProfit < 0) status = 'LOSS';

  return {
    range: { start, end },
    revenue,
    cogs,
    grossProfit,
    operatingExpenses,
    netProfit,
    profitMargin,
    status,
    totalTransactions: Number(salesAgg.total_transactions || 0)
  };
}

async function getProductAnalytics(businessId, start, end) {
  const [saleItemRows] = await pool.query(
    `SELECT si.product_id, p.name AS product_name, p.sku,
            si.quantity, si.line_total AS revenue, si.cogs
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     JOIN products p ON p.id = si.product_id
     WHERE s.business_id = ? AND DATE(s.sale_date) BETWEEN ? AND ?`,
    [businessId, start, end]
  );

  if (saleItemRows.length === 0) {
    return {
      topSelling: [],
      highestProfit: [],
      lowestProfit: [],
      allProfitability: []
    };
  }

  const topRes = await runADSA('top_products', {
    topN: 5,
    items: saleItemRows.map((r) => ({
      product_id: r.product_id,
      name: r.product_name,
      sku: r.sku,
      quantity: Number(r.quantity),
      revenue: Number(r.revenue)
    }))
  });

  const profRes = await runADSA('profitability', {
    items: saleItemRows.map((r) => ({
      product_id: r.product_id,
      name: r.product_name,
      sku: r.sku,
      quantity: Number(r.quantity),
      revenue: Number(r.revenue),
      cogs: Number(r.cogs)
    }))
  });

  const allProf = profRes.products || [];
  return {
    topSelling: topRes.topProducts || [],
    highestProfit: allProf.slice(0, 5),
    lowestProfit: [...allProf].reverse().slice(0, 5),
    allProfitability: allProf
  };
}

async function getDashboard(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const { range = 'month', start_date, end_date } = req.query;
    const { start, end } = resolveDateRange(range, start_date, end_date);
    const todayStr = new Date().toISOString().slice(0, 10);

    // Today KPIs
    const [[todaySales]] = await pool.query(
      'SELECT COALESCE(SUM(total_amount), 0) AS total FROM sales WHERE business_id = ? AND DATE(sale_date) = ?',
      [businessId, todayStr]
    );
    const [[todayPurchases]] = await pool.query(
      'SELECT COALESCE(SUM(total_amount), 0) AS total FROM purchases WHERE business_id = ? AND DATE(purchase_date) = ?',
      [businessId, todayStr]
    );

    // Period P&L KPIs
    const pnl = await computePnLData(businessId, start, end);

    // Inventory KPIs
    const [[prodStats]] = await pool.query(
      `SELECT COUNT(*) AS total_products,
              SUM(CASE WHEN available_quantity <= min_stock_level THEN 1 ELSE 0 END) AS low_stock_count
       FROM products
       WHERE business_id = ? AND is_archived = 0`,
      [businessId]
    );

    // Daily revenue & profit trend
    const [dailySales] = await pool.query(
      `SELECT DATE(sale_date) AS dt,
              COALESCE(SUM(total_amount), 0) AS revenue,
              COALESCE(SUM(gross_profit), 0) AS gross_profit
       FROM sales
       WHERE business_id = ? AND DATE(sale_date) BETWEEN ? AND ?
       GROUP BY DATE(sale_date)
       ORDER BY dt ASC`,
      [businessId, start, end]
    );

    const [dailyExpenses] = await pool.query(
      `SELECT expense_date AS dt,
              COALESCE(SUM(amount), 0) AS expenses
       FROM expenses
       WHERE business_id = ? AND expense_date BETWEEN ? AND ?
       GROUP BY expense_date
       ORDER BY dt ASC`,
      [businessId, start, end]
    );

    // Weekly profit trend (last 8 weeks)
    const [weeklyTrend] = await pool.query(
      `SELECT YEARWEEK(sale_date, 1) AS yw,
              MIN(DATE(sale_date)) AS week_start,
              COALESCE(SUM(total_amount), 0) AS revenue,
              COALESCE(SUM(gross_profit), 0) AS gross_profit
       FROM sales
       WHERE business_id = ? AND sale_date >= DATE_SUB(CURDATE(), INTERVAL 8 WEEK)
       GROUP BY YEARWEEK(sale_date, 1)
       ORDER BY yw ASC`,
      [businessId]
    );

    // Monthly performance (last 6 months)
    const [monthlyPerf] = await pool.query(
      `SELECT DATE_FORMAT(sale_date, '%Y-%m') AS ym,
              COALESCE(SUM(total_amount), 0) AS revenue,
              COALESCE(SUM(gross_profit), 0) AS gross_profit
       FROM sales
       WHERE business_id = ? AND sale_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(sale_date, '%Y-%m')
       ORDER BY ym ASC`,
      [businessId]
    );

    // Recent Activity
    const [recentSales] = await pool.query(
      'SELECT id, invoice_number, total_amount, payment_method, sale_date FROM sales WHERE business_id = ? ORDER BY sale_date DESC, id DESC LIMIT 5',
      [businessId]
    );
    const [recentPurchases] = await pool.query(
      `SELECT pu.id, pu.total_amount, pu.purchase_date, s.name AS supplier_name
       FROM purchases pu
       LEFT JOIN suppliers s ON s.id = pu.supplier_id
       WHERE pu.business_id = ?
       ORDER BY pu.purchase_date DESC, pu.id DESC LIMIT 5`,
      [businessId]
    );
    const [recentExpenses] = await pool.query(
      'SELECT id, category, amount, description, expense_date FROM expenses WHERE business_id = ? ORDER BY expense_date DESC, id DESC LIMIT 5',
      [businessId]
    );

    const analytics = await getProductAnalytics(businessId, start, end);

    res.json({
      kpis: {
        salesToday: Number(todaySales.total || 0),
        purchasesToday: Number(todayPurchases.total || 0),
        operationalExpenses: pnl.operatingExpenses,
        grossProfit: pnl.grossProfit,
        netProfit: pnl.netProfit,
        profitMargin: pnl.profitMargin,
        revenue: pnl.revenue,
        cogs: pnl.cogs,
        totalProducts: Number(prodStats.total_products || 0),
        lowStockProducts: Number(prodStats.low_stock_count || 0),
        totalTransactions: pnl.totalTransactions
      },
      range: { start, end },
      charts: {
        dailySales,
        dailyExpenses,
        weeklyTrend,
        monthlyPerf
      },
      analytics,
      recentActivity: {
        sales: recentSales,
        purchases: recentPurchases,
        expenses: recentExpenses
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getProfitAndLoss(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const { range = 'month', start_date, end_date } = req.query;
    const { start, end } = resolveDateRange(range, start_date, end_date);

    const pnl = await computePnLData(businessId, start, end);

    const [expenseBreakdown] = await pool.query(
      `SELECT category, COALESCE(SUM(amount), 0) AS total
       FROM expenses
       WHERE business_id = ? AND expense_date BETWEEN ? AND ?
       GROUP BY category
       ORDER BY total DESC`,
      [businessId, start, end]
    );

    const analytics = await getProductAnalytics(businessId, start, end);

    res.json({
      pnl,
      expenseBreakdown,
      productProfitability: analytics.allProfitability
    });
  } catch (err) {
    next(err);
  }
}

async function buildReportData(businessId, type, query) {
  const { range = 'month', start_date, end_date, category, search } = query;
  const { start, end } = resolveDateRange(range, start_date, end_date);

  if (type === 'sales') {
    let sql = `
      SELECT id, invoice_number, customer_name, payment_method, subtotal, total_amount, total_cogs, gross_profit, sale_date
      FROM sales
      WHERE business_id = ? AND DATE(sale_date) BETWEEN ? AND ?
    `;
    const params = [businessId, start, end];
    if (search) {
      sql += ' AND (invoice_number LIKE ? OR customer_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY sale_date DESC';
    const [rows] = await pool.query(sql, params);
    const totalRevenue = rows.reduce((acc, r) => acc + Number(r.total_amount), 0);
    const totalProfit = rows.reduce((acc, r) => acc + Number(r.gross_profit), 0);
    return {
      columns: ['id', 'invoice_number', 'customer_name', 'payment_method', 'total_amount', 'total_cogs', 'gross_profit', 'sale_date'],
      rows,
      summary: { count: rows.length, totalRevenue: Number(totalRevenue.toFixed(2)), totalGrossProfit: Number(totalProfit.toFixed(2)) }
    };
  }

  if (type === 'purchases') {
    let sql = `
      SELECT pu.id, pr.name AS product_name, pr.sku, s.name AS supplier_name,
             pi.quantity, pi.unit_cost, pi.total_cost, pu.payment_status, pu.purchase_date
      FROM purchases pu
      JOIN purchase_items pi ON pi.purchase_id = pu.id
      JOIN products pr ON pr.id = pi.product_id
      LEFT JOIN suppliers s ON s.id = pu.supplier_id
      WHERE pu.business_id = ? AND DATE(pu.purchase_date) BETWEEN ? AND ?
    `;
    const params = [businessId, start, end];
    if (search) {
      sql += ' AND (pr.name LIKE ? OR s.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY pu.purchase_date DESC';
    const [rows] = await pool.query(sql, params);
    const totalSpent = rows.reduce((acc, r) => acc + Number(r.total_cost), 0);
    return {
      columns: ['id', 'product_name', 'sku', 'supplier_name', 'quantity', 'unit_cost', 'total_cost', 'payment_status', 'purchase_date'],
      rows,
      summary: { count: rows.length, totalPurchasedAmount: Number(totalSpent.toFixed(2)) }
    };
  }

  if (type === 'expenses') {
    let sql = `
      SELECT id, category, amount, description, expense_date
      FROM expenses
      WHERE business_id = ? AND expense_date BETWEEN ? AND ?
    `;
    const params = [businessId, start, end];
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (search) {
      sql += ' AND description LIKE ?';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY expense_date DESC';
    const [rows] = await pool.query(sql, params);
    const totalExpenses = rows.reduce((acc, r) => acc + Number(r.amount), 0);
    return {
      columns: ['id', 'category', 'amount', 'description', 'expense_date'],
      rows,
      summary: { count: rows.length, totalExpenses: Number(totalExpenses.toFixed(2)) }
    };
  }

  if (type === 'inventory') {
    let sql = `
      SELECT p.id, p.name, p.sku, c.name AS category_name, p.purchase_price, p.selling_price,
             p.available_quantity, p.min_stock_level,
             COALESCE((SELECT SUM(ib.remaining_quantity * ib.unit_cost)
                       FROM inventory_batches ib
                       WHERE ib.product_id = p.id AND ib.remaining_quantity > 0), 0) AS fifo_stock_value
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.business_id = ? AND p.is_archived = 0
    `;
    const params = [businessId];
    if (category) {
      sql += ' AND c.name = ?';
      params.push(category);
    }
    if (search) {
      sql += ' AND (p.name LIKE ? OR p.sku LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY p.name ASC';
    const [rows] = await pool.query(sql, params);
    const totalValue = rows.reduce((acc, r) => acc + Number(r.fifo_stock_value), 0);
    return {
      columns: ['id', 'name', 'sku', 'category_name', 'purchase_price', 'selling_price', 'available_quantity', 'min_stock_level', 'fifo_stock_value'],
      rows,
      summary: { totalProducts: rows.length, totalFifoInventoryValue: Number(totalValue.toFixed(2)) }
    };
  }

  if (type === 'pnl') {
    const pnl = await computePnLData(businessId, start, end);
    const rows = [
      { metric: 'Total Revenue', amount: pnl.revenue },
      { metric: 'Cost of Goods Sold (FIFO COGS)', amount: pnl.cogs },
      { metric: 'Gross Profit', amount: pnl.grossProfit },
      { metric: 'Operating Expenses', amount: pnl.operatingExpenses },
      { metric: 'Net Profit / Loss', amount: pnl.netProfit },
      { metric: 'Profit Margin (%)', amount: pnl.profitMargin }
    ];
    return {
      columns: ['metric', 'amount'],
      rows,
      summary: pnl
    };
  }

  if (type === 'product_performance') {
    const analytics = await getProductAnalytics(businessId, start, end);
    return {
      columns: ['product_id', 'name', 'sku', 'units_sold', 'revenue', 'cogs', 'gross_profit', 'profit_margin'],
      rows: analytics.allProfitability,
      summary: { count: analytics.allProfitability.length }
    };
  }

  throw new AppError('Invalid report type.', 400);
}

async function getReport(req, res, next) {
  try {
    const report = await buildReportData(req.user.businessId, req.params.type, req.query);
    res.json(report);
  } catch (err) {
    next(err);
  }
}

async function exportReportCsv(req, res, next) {
  try {
    const type = req.params.type;
    const report = await buildReportData(req.user.businessId, type, req.query);
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = report.columns.join(',');
    const lines = report.rows.map((row) => report.columns.map((col) => escapeCsv(row[col])).join(','));
    const csv = [header, ...lines].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dukaansaathi_${type}_report.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

async function getSettings(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT u.owner_name, u.email, u.phone, b.store_name, b.business_type, b.currency
       FROM users u
       JOIN businesses b ON b.user_id = u.id
       WHERE u.id = ? AND b.id = ?`,
      [req.user.userId, req.user.businessId]
    );
    if (rows.length === 0) {
      throw new AppError('Business settings not found.', 404);
    }
    res.json({ settings: rows[0], isDemoAccount: rows[0].email === DEMO_EMAIL });
  } catch (err) {
    next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const { owner_name, phone, store_name, business_type } = req.body;
    await pool.query('UPDATE users SET owner_name = ?, phone = ? WHERE id = ?', [
      owner_name.trim(),
      phone.trim(),
      req.user.userId
    ]);
    await pool.query('UPDATE businesses SET store_name = ?, business_type = ? WHERE id = ? AND user_id = ?', [
      store_name.trim(),
      business_type.trim(),
      req.user.businessId,
      req.user.userId
    ]);
    res.json({ message: 'Business settings updated successfully' });
  } catch (err) {
    next(err);
  }
}

async function resetDemo(req, res, next) {
  try {
    await seedDemoBusiness(req.user.businessId);
    res.json({ message: 'Demo data for Sharma General Store has been reset successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboard,
  getProfitAndLoss,
  getReport,
  exportReportCsv,
  getSettings,
  updateSettings,
  resetDemo
};
