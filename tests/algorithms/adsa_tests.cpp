#include "adsa_types.hpp"
#include <cassert>
#include <cmath>
#include <iostream>
#include <vector>

using namespace adsa;

static bool approxEqual(double a, double b, double eps = 0.01) {
    return std::fabs(a - b) < eps;
}

void testBinarySearch() {
    std::vector<SearchProductItem> items = {
        {1, "KIR-001", "Aashirvaad Atta"},
        {2, "KIR-002", "Amul Milk"},
        {3, "KIR-003", "Tata Salt"},
        {4, "KIR-004", "Parle-G"},
        {5, "KIR-005", "Maggi"}
    };

    auto res1 = binarySearchProduct(items, "sku", "kir-003");
    assert(res1.found);
    assert(res1.item.id == 3);

    auto res2 = binarySearchProduct(items, "id", "5");
    assert(res2.found);
    assert(res2.item.sku == "KIR-005");

    auto res3 = binarySearchProduct(items, "sku", "KIR-999");
    assert(!res3.found);
    std::cout << "[PASS] Binary Search O(log n)\n";
}

void testMergeSort() {
    std::vector<SortProductItem> items = {
        {1, 255.0, 40, 45.0},
        {2, 66.0, 25, 12.0},
        {3, 152.0, 8, 27.0}
    };

    mergeSortProducts(items, "profit", false);
    assert(items[0].id == 1 && items[1].id == 3 && items[2].id == 2);

    mergeSortProducts(items, "stock", true);
    assert(items[0].id == 3 && items[1].id == 2 && items[2].id == 1);
    std::cout << "[PASS] Merge Sort O(n log n)\n";
}

void testQuickSort() {
    std::vector<SortSaleItem> sales = {
        {101, 500.0, 1700000100},
        {102, 1800.0, 1700000300},
        {103, 950.0, 1700000200}
    };

    quickSortSales(sales, "revenue", false);
    assert(sales[0].id == 102 && sales[1].id == 103 && sales[2].id == 101);

    quickSortSales(sales, "date", true);
    assert(sales[0].id == 101 && sales[1].id == 103 && sales[2].id == 102);
    std::cout << "[PASS] Quick Sort O(n log n)\n";
}

void testFifoFinancialScenario() {
    // Required Financial Test:
    // Purchase 100 units @ Rs.20
    // Purchase 50 units @ Rs.25
    // Sell 120 units @ Rs.40
    // Expected: COGS = 2500, Remaining = 30 units @ Rs.25 = 750
    std::vector<InventoryBatch> batches = {
        {1, 100, 20.0},
        {2, 50, 25.0}
    };

    FifoResult res = calculateFifoCogs(batches, 120);
    assert(approxEqual(res.totalCogs, 2500.0));
    assert(res.remainingTotalUnits == 30);
    assert(approxEqual(res.remainingTotalValue, 750.0));
    assert(res.updatedBatches[0].remainingQuantity == 0);
    assert(res.updatedBatches[1].remainingQuantity == 30);

    double revenue = 120.0 * 40.0; // 4800
    double grossProfit = revenue - res.totalCogs; // 2300
    double opExpenses = 300.0;
    double netProfit = grossProfit - opExpenses; // 2000
    assert(approxEqual(revenue, 4800.0));
    assert(approxEqual(grossProfit, 2300.0));
    assert(approxEqual(netProfit, 2000.0));
    std::cout << "[PASS] FIFO Inventory & Financial Scenario (COGS=2500, Remaining=30@25=750)\n";
}

void testTopProductsAndProfitability() {
    std::vector<SaleProductEntry> entries = {
        {1, "Atta", "KIR-001", 10, 2550.0, 2100.0},
        {2, "Parle-G", "KIR-004", 50, 500.0, 400.0},
        {1, "Atta", "KIR-001", 5, 1275.0, 1050.0},
        {3, "Bread", "KIR-010", 20, 700.0, 800.0} // loss-making example
    };

    auto top = getTopSellingProducts(entries, 5);
    assert(top.size() == 3);
    assert(top[0].productId == 2 && top[0].totalUnitsSold == 50);
    assert(top[1].productId == 3 && top[1].totalUnitsSold == 20);
    assert(top[2].productId == 1 && top[2].totalUnitsSold == 15);

    auto prof = analyzeProductProfitability(entries);
    assert(prof.size() == 3);
    assert(prof[0].productId == 1 && approxEqual(prof[0].grossProfit, 675.0));
    assert(prof[2].productId == 3 && approxEqual(prof[2].grossProfit, -100.0));
    std::cout << "[PASS] Top-Selling Heap & Product Profitability\n";
}

int main() {
    testBinarySearch();
    testMergeSort();
    testQuickSort();
    testFifoFinancialScenario();
    testTopProductsAndProfitability();
    std::cout << "All C++ ADSA unit tests passed!\n";
    return 0;
}
