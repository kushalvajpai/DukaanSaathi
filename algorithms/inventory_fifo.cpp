#include "adsa_types.hpp"
#include <algorithm>
#include <cmath>
#include <deque>
#include <stdexcept>

namespace adsa {

static double round2(double val) {
    return std::round(val * 100.0) / 100.0;
}

/**
 * Algorithm 4: FIFO Inventory Costing (Queue / Deque)
 * Purpose: Consume oldest inventory batches first to compute exact Cost of Goods Sold (COGS)
 *          and remaining inventory layers.
 * Data Structure: std::deque<InventoryBatch> representing chronological cost layers.
 * Time Complexity: O(b) where b is the number of batches processed.
 * Space Complexity: O(b) for storing the batch deque.
 */
FifoResult calculateFifoCogs(
    std::vector<InventoryBatch> batches,
    long long quantityToSell
) {
    if (quantityToSell < 0) {
        throw std::invalid_argument("Quantity to sell cannot be negative");
    }

    std::deque<InventoryBatch> fifoQueue(batches.begin(), batches.end());
    std::vector<InventoryBatch> updatedBatches;

    long long remainingToFulfill = quantityToSell;
    double totalCogs = 0.0;

    while (!fifoQueue.empty() && remainingToFulfill > 0) {
        InventoryBatch frontBatch = fifoQueue.front();
        fifoQueue.pop_front();

        if (frontBatch.remainingQuantity <= 0) {
            continue;
        }

        long long taken = std::min(frontBatch.remainingQuantity, remainingToFulfill);
        totalCogs += static_cast<double>(taken) * frontBatch.unitCost;
        frontBatch.remainingQuantity -= taken;
        remainingToFulfill -= taken;

        updatedBatches.push_back(frontBatch);
    }

    if (remainingToFulfill > 0) {
        throw std::runtime_error("Insufficient inventory across FIFO batches");
    }

    // Any untouched batches still in the deque remain intact
    while (!fifoQueue.empty()) {
        updatedBatches.push_back(fifoQueue.front());
        fifoQueue.pop_front();
    }

    long long remainingTotalUnits = 0;
    double remainingTotalValue = 0.0;
    for (const auto& b : updatedBatches) {
        if (b.remainingQuantity > 0) {
            remainingTotalUnits += b.remainingQuantity;
            remainingTotalValue += static_cast<double>(b.remainingQuantity) * b.unitCost;
        }
    }

    return FifoResult{
        round2(totalCogs),
        remainingTotalUnits,
        round2(remainingTotalValue),
        updatedBatches
    };
}

} // namespace adsa
