#include "adsa_types.hpp"

namespace adsa {

static bool compareProducts(
    const SortProductItem& a,
    const SortProductItem& b,
    const std::string& sortBy,
    bool ascending
) {
    double valA = a.profit;
    double valB = b.profit;

    if (sortBy == "price") {
        valA = a.price;
        valB = b.price;
    } else if (sortBy == "stock") {
        valA = static_cast<double>(a.stock);
        valB = static_cast<double>(b.stock);
    }

    if (valA == valB) {
        return ascending ? (a.id < b.id) : (a.id > b.id);
    }
    return ascending ? (valA <= valB) : (valA >= valB);
}

static void mergeRange(
    std::vector<SortProductItem>& items,
    int left,
    int mid,
    int right,
    const std::string& sortBy,
    bool ascending
) {
    int n1 = mid - left + 1;
    int n2 = right - mid;

    std::vector<SortProductItem> leftArr(items.begin() + left, items.begin() + mid + 1);
    std::vector<SortProductItem> rightArr(items.begin() + mid + 1, items.begin() + right + 1);

    int i = 0, j = 0, k = left;
    while (i < n1 && j < n2) {
        if (compareProducts(leftArr[i], rightArr[j], sortBy, ascending)) {
            items[k++] = leftArr[i++];
        } else {
            items[k++] = rightArr[j++];
        }
    }
    while (i < n1) items[k++] = leftArr[i++];
    while (j < n2) items[k++] = rightArr[j++];
}

static void mergeSortRecursive(
    std::vector<SortProductItem>& items,
    int left,
    int right,
    const std::string& sortBy,
    bool ascending
) {
    if (left >= right) return;
    int mid = left + (right - left) / 2;
    mergeSortRecursive(items, left, mid, sortBy, ascending);
    mergeSortRecursive(items, mid + 1, right, sortBy, ascending);
    mergeRange(items, left, mid, right, sortBy, ascending);
}

/**
 * Algorithm 2: Merge Sort
 * Purpose: Stable O(n log n) sorting of products by profit, price, or stock quantity.
 * Time Complexity: O(n log n) worst, average, and best case.
 * Space Complexity: O(n) auxiliary space for merging.
 */
void mergeSortProducts(
    std::vector<SortProductItem>& items,
    const std::string& sortBy,
    bool ascending
) {
    if (items.size() <= 1) return;
    mergeSortRecursive(items, 0, static_cast<int>(items.size()) - 1, sortBy, ascending);
}

} // namespace adsa
