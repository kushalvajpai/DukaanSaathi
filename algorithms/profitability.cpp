#include "adsa_types.hpp"
#include <algorithm>
#include <cmath>
#include <unordered_map>

namespace adsa {

static double roundProfit2(double val) {
    return std::round(val * 100.0) / 100.0;
}

/**
 * Algorithm 6: Product Profitability Analysis
 * Purpose: Aggregate revenue, actual FIFO COGS, and gross profit per product,
 *          and rank products from highest to lowest gross profit.
 * Time Complexity: O(m + k log k) where m is sale-item count and k is distinct products.
 * Space Complexity: O(k) for aggregation map and output vector.
 */
std::vector<ProfitabilityStat> analyzeProductProfitability(
    const std::vector<SaleProductEntry>& entries
) {
    std::unordered_map<long long, ProfitabilityStat> aggregated;
    for (const auto& e : entries) {
        auto& stat = aggregated[e.productId];
        if (stat.productId == 0) {
            stat.productId = e.productId;
            stat.name = e.name;
            stat.sku = e.sku;
        }
        stat.unitsSold += e.quantity;
        stat.revenue += e.revenue;
        stat.cogs += e.cogs;
    }

    std::vector<ProfitabilityStat> result;
    result.reserve(aggregated.size());
    for (auto& [pid, stat] : aggregated) {
        stat.revenue = roundProfit2(stat.revenue);
        stat.cogs = roundProfit2(stat.cogs);
        stat.grossProfit = roundProfit2(stat.revenue - stat.cogs);
        stat.profitMargin = stat.revenue > 0.0
            ? roundProfit2((stat.grossProfit / stat.revenue) * 100.0)
            : 0.0;
        result.push_back(stat);
    }

    std::sort(result.begin(), result.end(), [](const ProfitabilityStat& a, const ProfitabilityStat& b) {
        if (a.grossProfit == b.grossProfit) {
            return a.revenue > b.revenue;
        }
        return a.grossProfit > b.grossProfit;
    });

    return result;
}

} // namespace adsa
