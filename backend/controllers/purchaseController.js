const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

async function listPurchases(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const { search, supplier_id, start_date, end_date } = req.query;

    let sql = `
      SELECT pu.id, pu.supplier_id, s.name AS supplier_name, s.contact AS supplier_contact,
             pu.total_amount, pu.payment_status, pu.purchase_date, pu.notes, pu.created_at,
             pi.id AS purchase_item_id, pi.product_id, pr.name AS product_name, pr.sku,
             pi.quantity, pi.unit_cost, pi.total_cost
      FROM purchases pu
      LEFT JOIN suppliers s ON s.id = pu.supplier_id
      JOIN purchase_items pi ON pi.purchase_id = pu.id
      JOIN products pr ON pr.id = pi.product_id
      WHERE pu.business_id = ?
    `;
    const params = [businessId];

    if (supplier_id) {
      sql += ' AND pu.supplier_id = ?';
      params.push(Number(supplier_id));
    }
    if (start_date) {
      sql += ' AND DATE(pu.purchase_date) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND DATE(pu.purchase_date) <= ?';
      params.push(end_date);
    }
    if (search && search.trim()) {
      sql += ' AND (pr.name LIKE ? OR pr.sku LIKE ? OR s.name LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY pu.purchase_date DESC, pu.id DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ purchases: rows });
  } catch (err) {
    next(err);
  }
}

async function listSuppliers(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, contact FROM suppliers WHERE business_id = ? ORDER BY name ASC',
      [req.user.businessId]
    );
    res.json({ suppliers: rows });
  } catch (err) {
    next(err);
  }
}

async function createPurchase(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const {
      product_id,
      supplier_name,
      supplier_contact,
      quantity,
      unit_cost,
      purchase_date,
      payment_status = 'Paid',
      notes
    } = req.body;

    const qty = Number(quantity);
    const cost = Number(unit_cost);
    const totalAmount = Number((qty * cost).toFixed(2));
    const pDate = purchase_date ? new Date(purchase_date) : new Date();

    const createdId = await withTransaction(async (conn) => {
      const [prodRows] = await conn.query(
        'SELECT id, name FROM products WHERE id = ? AND business_id = ? FOR UPDATE',
        [Number(product_id), businessId]
      );
      if (prodRows.length === 0) {
        throw new AppError('Selected product does not exist.', 404);
      }

      // Resolve or create supplier
      let supplierId = null;
      if (supplier_name && supplier_name.trim()) {
        const [supRows] = await conn.query(
          'SELECT id FROM suppliers WHERE business_id = ? AND name = ? LIMIT 1',
          [businessId, supplier_name.trim()]
        );
        if (supRows.length > 0) {
          supplierId = supRows[0].id;
          if (supplier_contact) {
            await conn.query('UPDATE suppliers SET contact = ? WHERE id = ?', [supplier_contact.trim(), supplierId]);
          }
        } else {
          const [supIns] = await conn.query(
            'INSERT INTO suppliers (business_id, name, contact) VALUES (?, ?, ?)',
            [businessId, supplier_name.trim(), supplier_contact ? supplier_contact.trim() : null]
          );
          supplierId = supIns.insertId;
        }
      }

      const [purchaseIns] = await conn.query(
        `INSERT INTO purchases (business_id, supplier_id, total_amount, payment_status, purchase_date, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [businessId, supplierId, totalAmount, payment_status, pDate, notes || null]
      );
      const purchaseId = purchaseIns.insertId;

      const [piIns] = await conn.query(
        `INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, total_cost)
         VALUES (?, ?, ?, ?, ?)`,
        [purchaseId, Number(product_id), qty, cost, totalAmount]
      );

      // Create FIFO inventory cost layer
      await conn.query(
        `INSERT INTO inventory_batches (business_id, product_id, purchase_item_id, initial_quantity, remaining_quantity, unit_cost, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [businessId, Number(product_id), piIns.insertId, qty, qty, cost, pDate]
      );

      // Increase available product stock & update latest reference purchase price
      await conn.query(
        `UPDATE products
         SET available_quantity = available_quantity + ?, purchase_price = ?
         WHERE id = ? AND business_id = ?`,
        [qty, cost, Number(product_id), businessId]
      );

      await conn.query(
        `INSERT INTO stock_movements (business_id, product_id, movement_type, quantity_change, reference_type, reference_id, notes)
         VALUES (?, ?, 'PURCHASE', ?, 'purchase', ?, ?)`,
        [businessId, Number(product_id), qty, purchaseId, `Purchased ${qty} units @ ₹${cost}`]
      );

      return purchaseId;
    });

    res.status(201).json({
      message: 'Purchase recorded and FIFO inventory batch created',
      purchaseId: createdId
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Safely updates purchase metadata (payment_status, notes, supplier_contact)
 * without corrupting already-consumed FIFO inventory layers.
 */
async function updatePurchase(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const purchaseId = Number(req.params.id);
    const { payment_status, notes } = req.body;

    const [existing] = await pool.query(
      'SELECT id FROM purchases WHERE id = ? AND business_id = ?',
      [purchaseId, businessId]
    );
    if (existing.length === 0) {
      throw new AppError('Purchase record not found.', 404);
    }

    await pool.query(
      'UPDATE purchases SET payment_status = ?, notes = ? WHERE id = ? AND business_id = ?',
      [payment_status, notes || null, purchaseId, businessId]
    );

    res.json({ message: 'Purchase updated successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPurchases,
  listSuppliers,
  createPurchase,
  updatePurchase
};
