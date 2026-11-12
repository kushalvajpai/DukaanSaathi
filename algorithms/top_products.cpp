#include "adsa_types.hpp"
#include <queue>
#include <unordered_map>

namespace adsa {

struct TopHeapCompare {
    bool operator()(const TopProductStat& a, const TopProductStat& b) const {
        if (a.totalUnitsSold == b.totalUnitsSold) {
            return a.totalRevenue < b.totalRevenue;
        }
        return a.totalUnitsSold < b.totalUnitsSold; // Max-heap by units sold
    }
};

/**
 * Algorithm 5: Top-Selling Products (Hash Map + Priority Queue / Max-Heap)
 * Purpose: Aggregate units sold per product and extract the Top N best-selling products.
 * Time Complexity: O(m + k log k) where m is sale-item count and k is distinct products.
 * Space Complexity: O(k) for hash map and max-heap.
 */
std::vector<TopProductStat> getTopSellingProducts(
    const std::vector<SaleProductEntry>& entries,
    int topN
) {
    std::unordered_map<long long, TopProductStat> aggregated;
    for (const auto& e : entries) {
        auto& stat = aggregated[e.productId];
        if (stat.productId == 0) {
            stat.productId = e.productId;
            stat.name = e.name;
            stat.sku = e.sku;
        }
        stat.totalUnitsSold += e.quantity;
        stat.totalRevenue += e.revenue;
    }

    std::priority_queue<TopProductStat, std::vector<TopProductStat>, TopHeapCompare> maxHeap;
    for (const auto& [pid, stat] : aggregated) {
        maxHeap.push(stat);
    }

    std::vector<TopProductStat> result;
    while (!maxHeap.empty() && static_cast<int>(result.size()) < topN) {
        result.push_back(maxHeap.top());
        maxHeap.pop();
    }
    return result;
}

} // namespace adsa
