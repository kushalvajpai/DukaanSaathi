const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { runADSA } = require('../services/adsaService');

async function listSales(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const { search, start_date, end_date, sortBy = 'date', order = 'desc' } = req.query;

    let sql = `
      SELECT s.id, s.invoice_number, s.subtotal, s.total_amount, s.total_cogs, s.gross_profit,
             s.payment_method, s.customer_name, s.sale_date, s.created_at,
             (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS item_count
      FROM sales s
      WHERE s.business_id = ?
    `;
    const params = [businessId];

    if (start_date) {
      sql += ' AND DATE(s.sale_date) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND DATE(s.sale_date) <= ?';
      params.push(end_date);
    }
    if (search && search.trim()) {
      sql += ' AND (s.invoice_number LIKE ? OR s.customer_name LIKE ? OR s.payment_method LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const [rows] = await pool.query(sql, params);

    if (rows.length <= 1) {
      return res.json({ sales: rows, algorithm: 'Quick Sort (trivial n<=1)' });
    }

    const adsaResult = await runADSA('quick_sort', {
      sortBy: sortBy === 'revenue' ? 'revenue' : 'date',
      order: order === 'asc' ? 'asc' : 'desc',
      items: rows.map((r) => ({
        id: r.id,
        revenue: Number(r.total_amount),
        timestamp: new Date(r.sale_date).getTime()
      }))
    });

    const saleMap = new Map(rows.map((r) => [r.id, r]));
    const sortedSales = adsaResult.sortedIds.map((id) => saleMap.get(id)).filter(Boolean);

    res.json({
      sales: sortedSales,
      algorithm: adsaResult.algorithm
    });
  } catch (err) {
    next(err);
  }
}

async function getSaleById(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const saleId = Number(req.params.id);

    const [sales] = await pool.query(
      `SELECT s.*, b.store_name, b.business_type
       FROM sales s
       JOIN businesses b ON b.id = s.business_id
       WHERE s.id = ? AND s.business_id = ?`,
      [saleId, businessId]
    );
    if (sales.length === 0) {
      throw new AppError('Invoice not found.', 404);
    }

    const [items] = await pool.query(
      `SELECT si.*, p.name AS product_name, p.sku
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = ?`,
      [saleId]
    );

    res.json({ sale: sales[0], items });
  } catch (err) {
    next(err);
  }
}

async function createSale(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const { items, payment_method = 'Cash', customer_name, sale_date } = req.body;

    // Combine duplicate product_id rows if submitted in the same bill
    const mergedMap = new Map();
    for (const raw of items) {
      const pid = Number(raw.product_id);
      const qty = Number(raw.quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        throw new AppError('Quantity must be a positive integer.', 400);
      }
      if (mergedMap.has(pid)) {
        mergedMap.set(pid, mergedMap.get(pid) + qty);
      } else {
        mergedMap.set(pid, qty);
      }
    }

    const saleTimestamp = sale_date ? new Date(sale_date) : new Date();

    const result = await withTransaction(async (conn) => {
      let subtotal = 0;
      let totalCogs = 0;
      const preparedItems = [];

      for (const [productId, qty] of mergedMap.entries()) {
        const [prodRows] = await conn.query(
          `SELECT id, name, selling_price, available_quantity, is_archived
           FROM products
           WHERE id = ? AND business_id = ?
           FOR UPDATE`,
          [productId, businessId]
        );
        if (prodRows.length === 0 || prodRows[0].is_archived) {
          throw new AppError(`Product ID ${productId} not found or is archived.`, 404);
        }

        const product = prodRows[0];
        if (product.available_quantity < qty) {
          throw new AppError(
            `Insufficient stock for "${product.name}". Available: ${product.available_quantity}, Requested: ${qty}.`,
            400
          );
        }

        const [batches] = await conn.query(
          `SELECT id, remaining_quantity, unit_cost
           FROM inventory_batches
           WHERE business_id = ? AND product_id = ? AND remaining_quantity > 0
           ORDER BY received_at ASC, id ASC
           FOR UPDATE`,
          [businessId, productId]
        );

        // Invoke C++ FIFO Inventory Engine to calculate exact COGS and updated layers
        const fifoResult = await runADSA('inventory_fifo', {
          quantity: qty,
          batches: batches.map((b) => ({
            id: b.id,
            remaining_quantity: b.remaining_quantity,
            unit_cost: Number(b.unit_cost)
          }))
        });

        for (const updatedBatch of fifoResult.updatedBatches) {
          await conn.query(
            'UPDATE inventory_batches SET remaining_quantity = ? WHERE id = ? AND business_id = ?',
            [updatedBatch.remaining_quantity, updatedBatch.id, businessId]
          );
        }

        const sellingPrice = Number(product.selling_price);
        const lineTotal = Number((sellingPrice * qty).toFixed(2));
        const itemCogs = Number(fifoResult.totalCogs.toFixed(2));
        const itemGrossProfit = Number((lineTotal - itemCogs).toFixed(2));

        subtotal += lineTotal;
        totalCogs += itemCogs;

        preparedItems.push({
          productId,
          qty,
          sellingPrice,
          lineTotal,
          itemCogs,
          itemGrossProfit
        });
      }

      subtotal = Number(subtotal.toFixed(2));
      totalCogs = Number(totalCogs.toFixed(2));
      const grossProfit = Number((subtotal - totalCogs).toFixed(2));

      // Generate unique invoice number
      const [[countRow]] = await conn.query(
        'SELECT COALESCE(MAX(id), 0) + 1 AS nextNum FROM sales WHERE business_id = ?',
        [businessId]
      );
      const invoiceNumber = `INV-${1000 + Number(countRow.nextNum)}-${Date.now().toString().slice(-4)}`;

      const [saleIns] = await conn.query(
        `INSERT INTO sales (business_id, invoice_number, subtotal, total_amount, total_cogs, gross_profit, payment_method, customer_name, sale_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          businessId,
          invoiceNumber,
          subtotal,
          subtotal,
          totalCogs,
          grossProfit,
          payment_method,
          customer_name ? customer_name.trim() : null,
          saleTimestamp
        ]
      );
      const saleId = saleIns.insertId;

      for (const item of preparedItems) {
        await conn.query(
          `INSERT INTO sale_items (sale_id, product_id, quantity, selling_price, line_total, cogs, gross_profit)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [saleId, item.productId, item.qty, item.sellingPrice, item.lineTotal, item.itemCogs, item.itemGrossProfit]
        );

        await conn.query(
          'UPDATE products SET available_quantity = available_quantity - ? WHERE id = ? AND business_id = ?',
          [item.qty, item.productId, businessId]
        );

        await conn.query(
          `INSERT INTO stock_movements (business_id, product_id, movement_type, quantity_change, reference_type, reference_id, notes)
           VALUES (?, ?, 'SALE', ?, 'sale', ?, ?)`,
          [businessId, item.productId, -item.qty, saleId, `Sale ${invoiceNumber}`]
        );
      }

      return {
        saleId,
        invoiceNumber,
        subtotal,
        totalCogs,
        grossProfit
      };
    });

    res.status(201).json({
      message: 'Sale recorded successfully',
      sale: result
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listSales,
  getSaleById,
  createSale
};
