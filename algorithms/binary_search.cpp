#include "adsa_types.hpp"
#include <algorithm>
#include <cctype>

namespace adsa {

static std::string toUpperTrimmed(const std::string& s) {
    std::string out;
    for (char c : s) {
        if (!std::isspace(static_cast<unsigned char>(c))) {
            out.push_back(static_cast<char>(std::toupper(static_cast<unsigned char>(c))));
        }
    }
    return out;
}

/**
 * Algorithm 1: Iterative Binary Search
 * Purpose: Efficiently locate a product by sorted product ID or SKU.
 * Time Complexity: O(log n)
 * Space Complexity: O(1) auxiliary space
 */
BinarySearchResult binarySearchProduct(
    const std::vector<SearchProductItem>& sortedItems,
    const std::string& key,
    const std::string& target
) {
    BinarySearchResult result{false, {}, 0};
    if (sortedItems.empty()) {
        return result;
    }

    int low = 0;
    int high = static_cast<int>(sortedItems.size()) - 1;

    if (key == "id") {
        long long targetId = 0;
        try {
            targetId = std::stoll(target);
        } catch (...) {
            return result;
        }

        while (low <= high) {
            int mid = low + (high - low) / 2;
            result.comparisons++;
            if (sortedItems[mid].id == targetId) {
                result.found = true;
                result.item = sortedItems[mid];
                return result;
            }
            if (sortedItems[mid].id < targetId) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
    } else {
        std::string targetSku = toUpperTrimmed(target);
        while (low <= high) {
            int mid = low + (high - low) / 2;
            result.comparisons++;
            std::string midSku = toUpperTrimmed(sortedItems[mid].sku);
            if (midSku == targetSku) {
                result.found = true;
                result.item = sortedItems[mid];
                return result;
            }
            if (midSku < targetSku) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
    }

    return result;
}

} // namespace adsa
