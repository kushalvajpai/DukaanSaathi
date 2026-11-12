#include "adsa_types.hpp"
#include <utility>

namespace adsa {

static bool saleBefore(
    const SortSaleItem& a,
    const SortSaleItem& b,
    const std::string& sortBy,
    bool ascending
) {
    double valA = (sortBy == "revenue") ? a.revenue : static_cast<double>(a.timestamp);
    double valB = (sortBy == "revenue") ? b.revenue : static_cast<double>(b.timestamp);

    if (valA == valB) {
        return ascending ? (a.id < b.id) : (a.id > b.id);
    }
    return ascending ? (valA < valB) : (valA > valB);
}

static int partitionSales(
    std::vector<SortSaleItem>& items,
    int low,
    int high,
    const std::string& sortBy,
    bool ascending
) {
    // Median-of-three pivot selection to reduce worst-case O(n^2) probability
    int mid = low + (high - low) / 2;
    if (saleBefore(items[mid], items[low], sortBy, ascending)) std::swap(items[low], items[mid]);
    if (saleBefore(items[high], items[low], sortBy, ascending)) std::swap(items[low], items[high]);
    if (saleBefore(items[mid], items[high], sortBy, ascending)) std::swap(items[mid], items[high]);

    SortSaleItem pivot = items[high];
    int i = low - 1;

    for (int j = low; j < high; ++j) {
        if (saleBefore(items[j], pivot, sortBy, ascending)) {
            ++i;
            std::swap(items[i], items[j]);
        }
    }
    std::swap(items[i + 1], items[high]);
    return i + 1;
}

static void quickSortRecursive(
    std::vector<SortSaleItem>& items,
    int low,
    int high,
    const std::string& sortBy,
    bool ascending
) {
    if (low >= high) return;
    int pivotIdx = partitionSales(items, low, high, sortBy, ascending);
    quickSortRecursive(items, low, pivotIdx - 1, sortBy, ascending);
    quickSortRecursive(items, pivotIdx + 1, high, sortBy, ascending);
}

/**
 * Algorithm 3: Quick Sort
 * Purpose: Sort sales transactions by revenue or date (ascending/descending).
 * Time Complexity: O(n log n) average case; O(n^2) worst case.
 * Space Complexity: O(log n) average recursion stack.
 */
void quickSortSales(
    std::vector<SortSaleItem>& items,
    const std::string& sortBy,
    bool ascending
) {
    if (items.size() <= 1) return;
    quickSortRecursive(items, 0, static_cast<int>(items.size()) - 1, sortBy, ascending);
}

} // namespace adsa
