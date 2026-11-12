# DukaanSaathi – C++ ADSA Engine Documentation

This directory contains the compiled C++17 **Analysis and Design of Algorithms (ADSA)** engine (`dukaansaathi_adsa`) and unit tests (`adsa_tests`). The Node.js backend invokes the compiled binary via `stdin`/`stdout` JSON in [`backend/services/adsaService.js`](../backend/services/adsaService.js).

---

## 1. Iterative Binary Search (`binary_search.cpp`)
- **Purpose:** Fast exact lookup of a product by sorted `id` or `sku`.
- **Input:** Sorted array of products (`id`, `sku`, `name`), search `key` (`id` | `sku`), and `target` value.
- **Output:** `{ found, item, comparisons, algorithm }`.
- **Data Structures Used:** Contiguous `std::vector<SearchProductItem>`.
- **Time Complexity:** $O(\log n)$.
- **Space Complexity:** $O(1)$ auxiliary space.
- **Real-World Application:** Instant SKU barcode / product code lookup at the shop counter.
- **Integration:** `GET /api/products/search?key=sku&value=KIR-001`.

## 2. Merge Sort (`merge_sort.cpp`)
- **Purpose:** Stable sorting of inventory products by `profit`, `price`, or `stock` in ascending or descending order.
- **Input:** Product list (`id`, `price`, `stock`, `profit`), `sortBy`, and `order` (`asc` | `desc`).
- **Output:** `{ sortedIds, algorithm }`.
- **Data Structures Used:** `std::vector<SortProductItem>` with temporary left/right merge subarrays.
- **Time Complexity:** $O(n \log n)$ in best, average, and worst cases.
- **Space Complexity:** $O(n)$ auxiliary space.
- **Real-World Application:** Identifying high-margin items or low-stock items for restocking.
- **Integration:** `GET /api/products/sort?by=profit&order=desc`.

## 3. Quick Sort (`quick_sort.cpp`)
- **Purpose:** Fast in-place sorting of sales transactions by `revenue` or `date` (`timestamp`).
- **Input:** Sales list (`id`, `revenue`, `timestamp`), `sortBy`, and `order` (`asc` | `desc`).
- **Output:** `{ sortedIds, algorithm }`.
- **Data Structures Used:** In-place `std::vector<SortSaleItem>` with median-of-three pivot selection.
- **Time Complexity:** $O(n \log n)$ average case; $O(n^2)$ worst case.
- **Space Complexity:** $O(\log n)$ average recursion stack.
- **Real-World Application:** Sorting daily bills by highest value or chronological order.
- **Integration:** `GET /api/sales?sortBy=revenue&order=desc`.

## 4. FIFO Inventory Costing (`inventory_fifo.cpp`)
- **Purpose:** Track inventory cost layers and calculate exact Cost of Goods Sold (COGS) using First-In, First-Out (FIFO) costing.
- **Input:** Chronological list of `inventory_batches` (`id`, `remaining_quantity`, `unit_cost`) and `quantity` to sell.
- **Output:** `{ totalCogs, remainingTotalUnits, remainingTotalValue, updatedBatches, algorithm }`.
- **Data Structures Used:** `std::deque<InventoryBatch>` representing FIFO cost layers.
- **Time Complexity:** $O(b)$ where $b$ is the number of batches processed.
- **Space Complexity:** $O(b)$.
- **Real-World Application:** Accurate retail accounting when wholesale prices fluctuate across purchases (e.g., 100 units @ ₹20 + 50 units @ ₹25 → selling 120 units yields COGS = ₹2,500 and remaining stock = 30 @ ₹25 = ₹750).
- **Integration:** `POST /api/sales` inside a MySQL transaction.

## 5. Top-Selling Products (`top_products.cpp`)
- **Purpose:** Aggregate units sold per product and rank the top $N$ (default 5) best-selling products.
- **Input:** Sale line items (`product_id`, `name`, `sku`, `quantity`, `revenue`) and `topN`.
- **Output:** `{ topProducts, algorithm }`.
- **Data Structures Used:** `std::unordered_map` for $O(1)$ average aggregation + `std::priority_queue` (max-heap) for ranking.
- **Time Complexity:** $O(m + k \log k)$ where $m$ is sale items and $k$ is distinct products.
- **Space Complexity:** $O(k)$.
- **Real-World Application:** Helping shopkeepers know which fast-moving items to keep well-stocked.
- **Integration:** `GET /api/dashboard`.

## 6. Product Profitability Analysis (`profitability.cpp`)
- **Purpose:** Compute total revenue, actual FIFO COGS, gross profit, and profit margin per product, and rank products by profitability.
- **Input:** Sale line items (`product_id`, `name`, `sku`, `quantity`, `revenue`, `cogs`).
- **Output:** `{ products, algorithm }`.
- **Data Structures Used:** `std::unordered_map` for aggregation + `std::vector` sorted by `grossProfit`.
- **Time Complexity:** $O(m + k \log k)$.
- **Space Complexity:** $O(k)$.
- **Real-World Application:** Highlighting the most profitable and loss-making products on the Dashboard and P&L Statement.
- **Integration:** `GET /api/dashboard`, `GET /api/pnl`, and `GET /api/reports/product_performance`.
