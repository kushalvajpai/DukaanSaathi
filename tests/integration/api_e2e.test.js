const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const app = require('../../backend/server');
const { pool } = require('../../backend/config/db');
const { seedDemoBusiness, DEMO_EMAIL, DEMO_PASSWORD } = require('../../backend/services/seedService');

let server;
let baseUrl;

async function request(method, urlPath, body = null, cookie = '') {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const setCookie = res.headers.get('set-cookie');
  const nextCookie = setCookie ? setCookie.split(';')[0] : cookie;
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  return { status: res.status, data, cookie: nextCookie };
}

test.before(async () => {
  await seedDemoBusiness();
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await pool.end();
});

test('1. Protected route rejects unauthenticated requests', async () => {
  const res = await request('GET', '/products');
  assert.equal(res.status, 401);
});

test('2. Demo account login & seeded data verification', async () => {
  const loginRes = await request('POST', '/auth/login', {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD
  });
  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.data.user.storeName, 'Sharma General Store');

  const dashRes = await request('GET', '/dashboard?range=month', null, loginRes.cookie);
  assert.equal(dashRes.status, 200);
  assert.equal(dashRes.data.kpis.totalProducts, 10);
});

test('3. Full business workflow, FIFO financial test, C++ ADSA algorithms, & user isolation', async () => {
  const uniqueEmail = `test_${Date.now()}@store.in`;
  const regRes = await request('POST', '/auth/register', {
    ownerName: 'Test Owner',
    email: uniqueEmail,
    phone: '9988776655',
    password: 'Password123',
    storeName: 'Test Kirana',
    businessType: 'Kirana / General Store'
  });
  assert.equal(regRes.status, 201);
  const cookieA = regRes.cookie;

  // Create product with 0 initial stock
  const prodRes = await request('POST', '/products', {
    name: 'Test Basmati Rice',
    sku: 'RICE-101',
    purchase_price: 20,
    selling_price: 40,
    available_quantity: 0,
    min_stock_level: 10
  }, cookieA);
  assert.equal(prodRes.status, 201);
  const productId = prodRes.data.product.id;

  // Create a second unused product to test permanent deletion
  const unusedRes = await request('POST', '/products', {
    name: 'Unused Item',
    sku: 'UNUSED-1',
    purchase_price: 10,
    selling_price: 15,
    available_quantity: 0,
    min_stock_level: 5
  }, cookieA);
  assert.equal(unusedRes.status, 201);
  const unusedId = unusedRes.data.product.id;

  // Purchase 100 units @ ₹20
  const pur1 = await request('POST', '/purchases', {
    product_id: productId,
    supplier_name: 'Supplier Alpha',
    quantity: 100,
    unit_cost: 20,
    payment_status: 'Paid'
  }, cookieA);
  assert.equal(pur1.status, 201);

  // Purchase 50 units @ ₹25
  const pur2 = await request('POST', '/purchases', {
    product_id: productId,
    supplier_name: 'Supplier Beta',
    quantity: 50,
    unit_cost: 25,
    payment_status: 'Paid'
  }, cookieA);
  assert.equal(pur2.status, 201);

  // Sell 120 units @ ₹40
  const saleRes = await request('POST', '/sales', {
    items: [{ product_id: productId, quantity: 120 }],
    payment_method: 'UPI',
    customer_name: 'Ramesh'
  }, cookieA);
  assert.equal(saleRes.status, 201);
  assert.equal(saleRes.data.sale.subtotal, 4800);
  assert.equal(saleRes.data.sale.totalCogs, 2500);
  assert.equal(saleRes.data.sale.grossProfit, 2300);

  // Insufficient stock prevention (only 30 remain)
  const badSale = await request('POST', '/sales', {
    items: [{ product_id: productId, quantity: 50 }],
    payment_method: 'Cash'
  }, cookieA);
  assert.equal(badSale.status, 400);

  // Record operating expense of ₹300
  const today = new Date().toISOString().slice(0, 10);
  const expRes = await request('POST', '/expenses', {
    category: 'Electricity',
    amount: 300,
    description: 'Shop electricity',
    expense_date: today
  }, cookieA);
  assert.equal(expRes.status, 201);

  // Verify Profit & Loss
  const pnlRes = await request('GET', '/pnl?range=today', null, cookieA);
  assert.equal(pnlRes.status, 200);
  assert.equal(pnlRes.data.pnl.revenue, 4800);
  assert.equal(pnlRes.data.pnl.cogs, 2500);
  assert.equal(pnlRes.data.pnl.grossProfit, 2300);
  assert.equal(pnlRes.data.pnl.operatingExpenses, 300);
  assert.equal(pnlRes.data.pnl.netProfit, 2000);

  // Verify remaining inventory = 30 units @ ₹25 = ₹750
  const invRep = await request('GET', '/reports/inventory', null, cookieA);
  assert.equal(invRep.status, 200);
  const riceRow = invRep.data.rows.find((r) => r.id === productId);
  assert.equal(riceRow.available_quantity, 30);
  assert.equal(Number(riceRow.fifo_stock_value), 750);

  // Verify C++ Binary Search & Merge Sort & Quick Sort
  const bSearch = await request('GET', '/products/search?key=sku&value=RICE-101', null, cookieA);
  assert.equal(bSearch.status, 200);
  assert.equal(bSearch.data.found, true);
  assert.match(bSearch.data.algorithm, /Binary Search/);

  const mSort = await request('GET', '/products/sort?by=profit&order=desc', null, cookieA);
  assert.equal(mSort.status, 200);
  assert.match(mSort.data.algorithm, /Merge Sort/);

  const qSort = await request('GET', '/sales?sortBy=revenue&order=desc', null, cookieA);
  assert.equal(qSort.status, 200);

  // Verify CSV Export
  const csvRes = await request('GET', '/reports/sales/csv?range=today', null, cookieA);
  assert.equal(csvRes.status, 200);
  assert.match(csvRes.data, /invoice_number/);

  // Product deletion safeguards: unused deletes permanently, used archives
  const delUnused = await request('DELETE', `/products/${unusedId}`, null, cookieA);
  assert.equal(delUnused.status, 200);
  assert.equal(delUnused.data.deleted, true);

  const delUsed = await request('DELETE', `/products/${productId}`, null, cookieA);
  assert.equal(delUsed.status, 200);
  assert.equal(delUsed.data.archived, true);

  // User data isolation: Demo user B cannot access User A's product
  const demoLogin = await request('POST', '/auth/login', {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD
  });
  const crossAccess = await request('GET', `/products/${productId}`, null, demoLogin.cookie);
  assert.equal(crossAccess.status, 404);

  // Logout clears session
  const logoutRes = await request('POST', '/auth/logout', {}, cookieA);
  assert.equal(logoutRes.status, 200);

  // Clean up test user in safe FK order
  const [bizRows] = await pool.query(
    'SELECT b.id FROM businesses b JOIN users u ON u.id = b.user_id WHERE u.email = ?',
    [uniqueEmail]
  );
  if (bizRows.length > 0) {
    const bid = bizRows[0].id;
    await pool.query('DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE business_id = ?)', [bid]);
    await pool.query('DELETE FROM sales WHERE business_id = ?', [bid]);
    await pool.query('DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE business_id = ?)', [bid]);
    await pool.query('DELETE FROM purchases WHERE business_id = ?', [bid]);
  }
  await pool.query('DELETE FROM users WHERE email = ?', [uniqueEmail]);
});
