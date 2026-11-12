const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { runADSA } = require('../services/adsaService');

function enrichProduct(p) {
  const purchasePrice = Number(p.purchase_price || 0);
  const sellingPrice = Number(p.selling_price || 0);
  const profitPerUnit = Number((sellingPrice - purchasePrice).toFixed(2));
  const profitMargin = sellingPrice > 0 ? Number(((profitPerUnit / sellingPrice) * 100).toFixed(2)) : 0;

  let stockStatus = 'In Stock';
  if (p.available_quantity <= 0) {
    stockStatus = 'Out of Stock';
  } else if (p.available_quantity <= p.min_stock_level) {
    stockStatus = 'Low Stock';
  }

  return {
    ...p,
    purchase_price: purchasePrice,
    selling_price: sellingPrice,
    profit_per_unit: profitPerUnit,
    profit_margin: profitMargin,
    stock_status: stockStatus
  };
}

async function listProducts(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const { search, category_id, include_archived } = req.query;

    let sql = `
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.business_id = ?
    `;
    const params = [businessId];

    if (include_archived !== 'true') {
      sql += ' AND p.is_archived = 0';
    }
    if (category_id) {
      sql += ' AND p.category_id = ?';
      params.push(Number(category_id));
    }
    if (search && search.trim()) {
      sql += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY p.id DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ products: rows.map(enrichProduct) });
  } catch (err) {
    next(err);
  }
}

async function getCategories(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, name FROM categories WHERE business_id = ? ORDER BY name ASC',
      [req.user.businessId]
    );
    res.json({ categories: rows });
  } catch (err) {
    next(err);
  }
}

async function createCategory(req, res, next) {
  try {
    const name = req.body.name.trim();
    const businessId = req.user.businessId;
    const [existing] = await pool.query(
      'SELECT id, name FROM categories WHERE business_id = ? AND name = ?',
      [businessId, name]
    );
    if (existing.length > 0) {
      return res.json({ category: existing[0] });
    }
    const [resInsert] = await pool.query(
      'INSERT INTO categories (business_id, name) VALUES (?, ?)',
      [businessId, name]
    );
    res.status(201).json({ category: { id: resInsert.insertId, name } });
  } catch (err) {
    next(err);
  }
}

/**
 * Search product by exact ID or SKU using C++ iterative Binary Search (O(log n)).
 */
async function binarySearchProduct(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const { key = 'sku', value } = req.query;
    if (!value || !String(value).trim()) {
      throw new AppError('Search value is required.', 400);
    }

    const orderCol = key === 'id' ? 'p.id' : 'p.sku';
    const [rows] = await pool.query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.business_id = ? AND p.is_archived = 0
       ORDER BY ${orderCol} ASC`,
      [businessId]
    );

    const enriched = rows.map(enrichProduct);
    const adsaResult = await runADSA('binary_search', {
      key: key === 'id' ? 'id' : 'sku',
      target: String(value).trim(),
      items: enriched.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name
      }))
    });

    if (!adsaResult.found) {
      return res.json({ found: false, product: null, algorithm: adsaResult.algorithm });
    }

    const matched = enriched.find((p) => p.id === adsaResult.item.id) || null;
    res.json({
      found: Boolean(matched),
      product: matched,
      comparisons: adsaResult.comparisons,
      algorithm: adsaResult.algorithm
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Sort products by price, stock, or profit using C++ Merge Sort (O(n log n)).
 */
async function sortProducts(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const { by = 'profit', order = 'desc' } = req.query;
    const allowedFields = ['price', 'stock', 'profit'];
    const sortBy = allowedFields.includes(by) ? by : 'profit';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const [rows] = await pool.query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.business_id = ? AND p.is_archived = 0`,
      [businessId]
    );

    const enriched = rows.map(enrichProduct);
    const adsaResult = await runADSA('merge_sort', {
      sortBy,
      order: sortOrder,
      items: enriched.map((p) => ({
        id: p.id,
        price: p.selling_price,
        stock: p.available_quantity,
        profit: p.profit_per_unit
      }))
    });

    const productMap = new Map(enriched.map((p) => [p.id, p]));
    const sortedProducts = adsaResult.sortedIds.map((id) => productMap.get(id)).filter(Boolean);

    res.json({
      products: sortedProducts,
      algorithm: adsaResult.algorithm
    });
  } catch (err) {
    next(err);
  }
}

async function getProductById(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = ? AND p.business_id = ?`,
      [Number(req.params.id), req.user.businessId]
    );
    if (rows.length === 0) {
      throw new AppError('Product not found.', 404);
    }

    const [batches] = await pool.query(
      `SELECT id, initial_quantity, remaining_quantity, unit_cost, received_at
       FROM inventory_batches
       WHERE product_id = ? AND business_id = ? AND remaining_quantity > 0
       ORDER BY received_at ASC, id ASC`,
      [Number(req.params.id), req.user.businessId]
    );

    res.json({
      product: enrichProduct(rows[0]),
      batches
    });
  } catch (err) {
    next(err);
  }
}

async function createProduct(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const {
      name,
      sku,
      category_id,
      category_name,
      description,
      purchase_price,
      selling_price,
      available_quantity = 0,
      min_stock_level = 5
    } = req.body;

    const cleanSku = sku.trim().toUpperCase();
    const [dup] = await pool.query(
      'SELECT id FROM products WHERE business_id = ? AND sku = ?',
      [businessId, cleanSku]
    );
    if (dup.length > 0) {
      throw new AppError(`SKU "${cleanSku}" already exists in your inventory.`, 409);
    }

    const productId = await withTransaction(async (conn) => {
      let resolvedCategoryId = category_id ? Number(category_id) : null;
      if (!resolvedCategoryId && category_name && category_name.trim()) {
        const [catRows] = await conn.query(
          'SELECT id FROM categories WHERE business_id = ? AND name = ?',
          [businessId, category_name.trim()]
        );
        if (catRows.length > 0) {
          resolvedCategoryId = catRows[0].id;
        } else {
          const [catIns] = await conn.query(
            'INSERT INTO categories (business_id, name) VALUES (?, ?)',
            [businessId, category_name.trim()]
          );
          resolvedCategoryId = catIns.insertId;
        }
      }

      const qty = Math.max(0, Number(available_quantity));
      const pPrice = Number(purchase_price);
      const sPrice = Number(selling_price);

      const [resInsert] = await conn.query(
        `INSERT INTO products (business_id, category_id, name, sku, description, purchase_price, selling_price, available_quantity, min_stock_level)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [businessId, resolvedCategoryId, name.trim(), cleanSku, description || null, pPrice, sPrice, qty, Number(min_stock_level)]
      );
      const newId = resInsert.insertId;

      if (qty > 0) {
        await conn.query(
          `INSERT INTO inventory_batches (business_id, product_id, purchase_item_id, initial_quantity, remaining_quantity, unit_cost, received_at)
           VALUES (?, ?, NULL, ?, ?, ?, NOW())`,
          [businessId, newId, qty, qty, pPrice]
        );
        await conn.query(
          `INSERT INTO stock_movements (business_id, product_id, movement_type, quantity_change, reference_type, reference_id, notes)
           VALUES (?, ?, 'INITIAL', ?, 'product', ?, 'Initial stock on product creation')`,
          [businessId, newId, qty, newId]
        );
      }

      return newId;
    });

    const [created] = await pool.query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = ?`,
      [productId]
    );

    res.status(201).json({
      message: 'Product created successfully',
      product: enrichProduct(created[0])
    });
  } catch (err) {
    next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const productId = Number(req.params.id);

    const [existingRows] = await pool.query(
      'SELECT * FROM products WHERE id = ? AND business_id = ?',
      [productId, businessId]
    );
    if (existingRows.length === 0) {
      throw new AppError('Product not found.', 404);
    }

    const {
      name,
      sku,
      category_id,
      description,
      purchase_price,
      selling_price,
      min_stock_level
    } = req.body;

    const cleanSku = sku.trim().toUpperCase();
    const [dup] = await pool.query(
      'SELECT id FROM products WHERE business_id = ? AND sku = ? AND id != ?',
      [businessId, cleanSku, productId]
    );
    if (dup.length > 0) {
      throw new AppError(`SKU "${cleanSku}" is already used by another product.`, 409);
    }

    await pool.query(
      `UPDATE products
       SET name = ?, sku = ?, category_id = ?, description = ?, purchase_price = ?, selling_price = ?, min_stock_level = ?
       WHERE id = ? AND business_id = ?`,
      [
        name.trim(),
        cleanSku,
        category_id ? Number(category_id) : null,
        description || null,
        Number(purchase_price),
        Number(selling_price),
        Number(min_stock_level),
        productId,
        businessId
      ]
    );

    const [updated] = await pool.query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = ?`,
      [productId]
    );

    res.json({
      message: 'Product updated successfully',
      product: enrichProduct(updated[0])
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Deletes a product if it has no historical sales or purchase transactions;
 * otherwise archives (soft-deletes) it to preserve financial & FIFO integrity.
 */
async function deleteProduct(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const productId = Number(req.params.id);

    const [existing] = await pool.query(
      'SELECT id, name FROM products WHERE id = ? AND business_id = ?',
      [productId, businessId]
    );
    if (existing.length === 0) {
      throw new AppError('Product not found.', 404);
    }

    const [[saleRef]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM sale_items WHERE product_id = ?',
      [productId]
    );
    const [[purchaseRef]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM purchase_items WHERE product_id = ?',
      [productId]
    );

    if (saleRef.cnt > 0 || purchaseRef.cnt > 0) {
      await pool.query(
        'UPDATE products SET is_archived = 1 WHERE id = ? AND business_id = ?',
        [productId, businessId]
      );
      return res.json({
        archived: true,
        deleted: false,
        message: `"${existing[0].name}" has historical transactions and was archived to preserve financial records.`
      });
    }

    await pool.query('DELETE FROM products WHERE id = ? AND business_id = ?', [productId, businessId]);
    res.json({
      archived: false,
      deleted: true,
      message: `"${existing[0].name}" deleted permanently.`
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProducts,
  getCategories,
  createCategory,
  binarySearchProduct,
  sortProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
