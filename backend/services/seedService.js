const bcrypt = require('bcrypt');
const { withTransaction } = require('../config/db');

const DEMO_EMAIL = 'sharma@dukaansaathi.in';
const DEMO_PASSWORD = 'Demo@1234';

/**
 * Seeds or resets the "Sharma General Store" demo business with realistic Indian retail data.
 * Uses FIFO inventory batches, purchases, sales, and operating expenses.
 */
async function seedDemoBusiness(targetBusinessId = null) {
  return withTransaction(async (conn) => {
    let userId;
    let businessId = targetBusinessId;

    if (!businessId) {
      const [existingUsers] = await conn.query('SELECT id FROM users WHERE email = ?', [DEMO_EMAIL]);
      if (existingUsers.length > 0) {
        userId = existingUsers[0].id;
        const [biz] = await conn.query('SELECT id FROM businesses WHERE user_id = ?', [userId]);
        if (biz.length > 0) {
          businessId = biz[0].id;
        }
      } else {
        const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
        const [userRes] = await conn.query(
          'INSERT INTO users (owner_name, email, phone, password_hash) VALUES (?, ?, ?, ?)',
          ['Rajesh Sharma', DEMO_EMAIL, '9876543210', passwordHash]
        );
        userId = userRes.insertId;
      }

      if (!businessId) {
        const [bizRes] = await conn.query(
          'INSERT INTO businesses (user_id, store_name, business_type, currency) VALUES (?, ?, ?, ?)',
          [userId, 'Sharma General Store', 'Kirana / General Store', 'INR']
        );
        businessId = bizRes.insertId;
      }
    }

    // Clear existing business records in safe FK order
    await conn.query('DELETE FROM stock_movements WHERE business_id = ?', [businessId]);
    await conn.query('DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE business_id = ?)', [businessId]);
    await conn.query('DELETE FROM sales WHERE business_id = ?', [businessId]);
    await conn.query('DELETE FROM inventory_batches WHERE business_id = ?', [businessId]);
    await conn.query('DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE business_id = ?)', [businessId]);
    await conn.query('DELETE FROM purchases WHERE business_id = ?', [businessId]);
    await conn.query('DELETE FROM expenses WHERE business_id = ?', [businessId]);
    await conn.query('DELETE FROM products WHERE business_id = ?', [businessId]);
    await conn.query('DELETE FROM categories WHERE business_id = ?', [businessId]);
    await conn.query('DELETE FROM suppliers WHERE business_id = ?', [businessId]);

    // Categories
    const categoryNames = ['Staples & Grains', 'Dairy & Bakery', 'Snacks & Noodles', 'Personal & Home Care'];
    const categoryMap = {};
    for (const name of categoryNames) {
      const [res] = await conn.query('INSERT INTO categories (business_id, name) VALUES (?, ?)', [businessId, name]);
      categoryMap[name] = res.insertId;
    }

    // Suppliers
    const [sup1] = await conn.query(
      'INSERT INTO suppliers (business_id, name, contact) VALUES (?, ?, ?)',
      [businessId, 'Metro Wholesale Distributors', '9811223344']
    );
    const [sup2] = await conn.query(
      'INSERT INTO suppliers (business_id, name, contact) VALUES (?, ?, ?)',
      [businessId, 'Anand Dairy & Bakery Agency', '9822334455']
    );

    // 10 Realistic Indian Retail Products
    const productsData = [
      { name: 'Aashirvaad Atta (5kg)', sku: 'KIR-001', category: 'Staples & Grains', cost: 210, price: 255, qty: 40, min: 10, desc: 'Whole wheat chakki atta 5kg pack' },
      { name: 'Amul Milk (1L)', sku: 'KIR-002', category: 'Dairy & Bakery', cost: 54, price: 66, qty: 25, min: 10, desc: 'Amul Taaza toned milk 1 litre' },
      { name: 'Tata Salt (1kg)', sku: 'KIR-003', category: 'Staples & Grains', cost: 22, price: 28, qty: 60, min: 15, desc: 'Iodized vacuum evaporated salt' },
      { name: 'Parle-G Biscuits', sku: 'KIR-004', category: 'Snacks & Noodles', cost: 8, price: 10, qty: 120, min: 25, desc: 'Original glucose biscuits pack' },
      { name: 'Maggi Noodles (70g)', sku: 'KIR-005', category: 'Snacks & Noodles', cost: 11, price: 14, qty: 80, min: 20, desc: '2-minute masala noodles' },
      { name: 'Fortune Oil (1L)', sku: 'KIR-006', category: 'Staples & Grains', cost: 125, price: 152, qty: 8, min: 10, desc: 'Fortune Sunlite refined sunflower oil' },
      { name: 'Surf Excel (1kg)', sku: 'KIR-007', category: 'Personal & Home Care', cost: 115, price: 140, qty: 18, min: 8, desc: 'Easy wash detergent powder' },
      { name: 'Colgate Toothpaste (150g)', sku: 'KIR-008', category: 'Personal & Home Care', cost: 82, price: 105, qty: 22, min: 8, desc: 'Strong teeth dental cream' },
      { name: 'Lux Soap (100g)', sku: 'KIR-009', category: 'Personal & Home Care', cost: 28, price: 36, qty: 4, min: 10, desc: 'Soft glow beauty soap bar' },
      { name: 'Britannia Bread (400g)', sku: 'KIR-010', category: 'Dairy & Bakery', cost: 32, price: 42, qty: 0, min: 8, desc: 'Daily fresh white sandwich bread' }
    ];

    const productIds = {};
    for (const p of productsData) {
      const [res] = await conn.query(
        `INSERT INTO products (business_id, category_id, name, sku, description, purchase_price, selling_price, available_quantity, min_stock_level)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [businessId, categoryMap[p.category], p.name, p.sku, p.desc, p.cost, p.price, p.qty, p.min]
      );
      productIds[p.sku] = { id: res.insertId, ...p };
    }

    // Record initial purchases & FIFO inventory batches
    const now = new Date();
    const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

    const [p1] = await conn.query(
      'INSERT INTO purchases (business_id, supplier_id, total_amount, payment_status, purchase_date, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [businessId, sup1.insertId, 20080.00, 'Paid', daysAgo(10), 'Initial stock replenishment']
    );

    for (const sku of Object.keys(productIds)) {
      const item = productIds[sku];
      const batchQty = item.qty > 0 ? item.qty + 10 : 15; // We'll simulate some sales below
      const totalCost = batchQty * item.cost;

      const [piRes] = await conn.query(
        'INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, total_cost) VALUES (?, ?, ?, ?, ?)',
        [p1.insertId, item.id, batchQty, item.cost, totalCost]
      );

      await conn.query(
        `INSERT INTO inventory_batches (business_id, product_id, purchase_item_id, initial_quantity, remaining_quantity, unit_cost, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [businessId, item.id, piRes.insertId, batchQty, item.qty, item.cost, daysAgo(10)]
      );

      await conn.query(
        `INSERT INTO stock_movements (business_id, product_id, movement_type, quantity_change, reference_type, reference_id, notes)
         VALUES (?, ?, 'PURCHASE', ?, 'purchase', ?, ?)`,
        [businessId, item.id, batchQty, p1.insertId, 'Demo initial stock purchase']
      );
    }

    // Sample Sales over the last 7 days + today
    const sampleSales = [
      {
        invoice: 'INV-1001',
        daysAgo: 5,
        method: 'Cash',
        customer: 'Walk-in Customer',
        items: [
          { sku: 'KIR-001', qty: 4 },
          { sku: 'KIR-003', qty: 5 },
          { sku: 'KIR-004', qty: 10 }
        ]
      },
      {
        invoice: 'INV-1002',
        daysAgo: 3,
        method: 'UPI',
        customer: 'Verma Ji',
        items: [
          { sku: 'KIR-006', qty: 3 },
          { sku: 'KIR-007', qty: 4 },
          { sku: 'KIR-005', qty: 12 }
        ]
      },
      {
        invoice: 'INV-1003',
        daysAgo: 1,
        method: 'UPI',
        customer: 'Sunita Devi',
        items: [
          { sku: 'KIR-002', qty: 8 },
          { sku: 'KIR-010', qty: 10 },
          { sku: 'KIR-008', qty: 3 }
        ]
      },
      {
        invoice: 'INV-1004',
        daysAgo: 0,
        method: 'Cash',
        customer: 'Walk-in Customer',
        items: [
          { sku: 'KIR-001', qty: 3 },
          { sku: 'KIR-009', qty: 6 },
          { sku: 'KIR-005', qty: 8 }
        ]
      }
    ];

    for (const s of sampleSales) {
      let subtotal = 0;
      let totalCogs = 0;
      const computedItems = s.items.map((it) => {
        const prod = productIds[it.sku];
        const lineTotal = prod.price * it.qty;
        const cogs = prod.cost * it.qty;
        subtotal += lineTotal;
        totalCogs += cogs;
        return {
          productId: prod.id,
          qty: it.qty,
          sellingPrice: prod.price,
          lineTotal,
          cogs,
          grossProfit: lineTotal - cogs
        };
      });

      const [saleRes] = await conn.query(
        `INSERT INTO sales (business_id, invoice_number, subtotal, total_amount, total_cogs, gross_profit, payment_method, customer_name, sale_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [businessId, s.invoice, subtotal, subtotal, totalCogs, subtotal - totalCogs, s.method, s.customer, daysAgo(s.daysAgo)]
      );

      for (const ci of computedItems) {
        await conn.query(
          `INSERT INTO sale_items (sale_id, product_id, quantity, selling_price, line_total, cogs, gross_profit)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [saleRes.insertId, ci.productId, ci.qty, ci.sellingPrice, ci.lineTotal, ci.cogs, ci.grossProfit]
        );
        await conn.query(
          `INSERT INTO stock_movements (business_id, product_id, movement_type, quantity_change, reference_type, reference_id, notes)
           VALUES (?, ?, 'SALE', ?, 'sale', ?, ?)`,
          [businessId, ci.productId, -ci.qty, saleRes.insertId, `Demo sale ${s.invoice}`]
        );
      }
    }

    // Sample Operating Expenses
    const formatDate = (d) => d.toISOString().slice(0, 10);
    const sampleExpenses = [
      { category: 'Shop Rent', amount: 4500, desc: 'Monthly shop rent', date: formatDate(daysAgo(6)) },
      { category: 'Electricity', amount: 850, desc: 'Shop electricity bill', date: formatDate(daysAgo(4)) },
      { category: 'Packaging', amount: 250, desc: 'Carry bags and paper pouches', date: formatDate(daysAgo(2)) },
      { category: 'Internet', amount: 399, desc: 'UPI & Wi-Fi broadband recharge', date: formatDate(daysAgo(0)) }
    ];

    for (const exp of sampleExpenses) {
      await conn.query(
        'INSERT INTO expenses (business_id, category, amount, description, expense_date) VALUES (?, ?, ?, ?, ?)',
        [businessId, exp.category, exp.amount, exp.desc, exp.date]
      );
    }

    return { businessId, email: DEMO_EMAIL };
  });
}

module.exports = {
  seedDemoBusiness,
  DEMO_EMAIL,
  DEMO_PASSWORD
};
