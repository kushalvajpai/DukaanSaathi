#include "adsa_types.hpp"
#include <iostream>
#include <sstream>
#include <string>

using namespace adsa;

int main() {
    try {
        std::ostringstream buffer;
        buffer << std::cin.rdbuf();
        std::string input = buffer.str();

        if (input.empty()) {
            std::cout << JsonValue(JsonObject{{"error", "Empty input"}}).dump() << std::endl;
            return 1;
        }

        JsonParser parser(input);
        JsonValue root = parser.parse();
        std::string command = root.get("command").asString();
        const JsonValue& payload = root.get("payload");

        if (command == "binary_search") {
            std::string key = payload.get("key").asString("sku");
            std::string target = payload.get("target").asString();
            std::vector<SearchProductItem> items;
            for (const auto& el : payload.get("items").asArray()) {
                items.push_back(SearchProductItem{
                    el.get("id").asInt(),
                    el.get("sku").asString(),
                    el.get("name").asString()
                });
            }
            BinarySearchResult res = binarySearchProduct(items, key, target);
            JsonObject out;
            out["algorithm"] = "C++ Iterative Binary Search O(log n)";
            out["found"] = res.found;
            out["comparisons"] = res.comparisons;
            if (res.found) {
                out["item"] = JsonObject{
                    {"id", res.item.id},
                    {"sku", res.item.sku},
                    {"name", res.item.name}
                };
            }
            std::cout << JsonValue(out).dump() << std::endl;
            return 0;
        }

        if (command == "merge_sort") {
            std::string sortBy = payload.get("sortBy").asString("profit");
            bool ascending = payload.get("order").asString("desc") == "asc";
            std::vector<SortProductItem> items;
            for (const auto& el : payload.get("items").asArray()) {
                items.push_back(SortProductItem{
                    el.get("id").asInt(),
                    el.get("price").asNumber(),
                    el.get("stock").asInt(),
                    el.get("profit").asNumber()
                });
            }
            mergeSortProducts(items, sortBy, ascending);
            JsonArray ids;
            for (const auto& it : items) {
                ids.push_back(JsonValue(it.id));
            }
            JsonObject out;
            out["algorithm"] = "C++ Merge Sort O(n log n)";
            out["sortedIds"] = ids;
            std::cout << JsonValue(out).dump() << std::endl;
            return 0;
        }

        if (command == "quick_sort") {
            std::string sortBy = payload.get("sortBy").asString("date");
            bool ascending = payload.get("order").asString("desc") == "asc";
            std::vector<SortSaleItem> items;
            for (const auto& el : payload.get("items").asArray()) {
                items.push_back(SortSaleItem{
                    el.get("id").asInt(),
                    el.get("revenue").asNumber(),
                    el.get("timestamp").asInt()
                });
            }
            quickSortSales(items, sortBy, ascending);
            JsonArray ids;
            for (const auto& it : items) {
                ids.push_back(JsonValue(it.id));
            }
            JsonObject out;
            out["algorithm"] = "C++ Quick Sort O(n log n) avg / O(n^2) worst";
            out["sortedIds"] = ids;
            std::cout << JsonValue(out).dump() << std::endl;
            return 0;
        }

        if (command == "inventory_fifo") {
            long long quantity = payload.get("quantity").asInt();
            std::vector<InventoryBatch> batches;
            for (const auto& el : payload.get("batches").asArray()) {
                batches.push_back(InventoryBatch{
                    el.get("id").asInt(),
                    el.get("remaining_quantity").asInt(),
                    el.get("unit_cost").asNumber()
                });
            }
            FifoResult res = calculateFifoCogs(batches, quantity);
            JsonArray updatedArr;
            for (const auto& b : res.updatedBatches) {
                updatedArr.push_back(JsonObject{
                    {"id", b.id},
                    {"remaining_quantity", b.remainingQuantity},
                    {"unit_cost", b.unitCost}
                });
            }
            JsonObject out;
            out["algorithm"] = "C++ FIFO Inventory Deque O(b)";
            out["totalCogs"] = res.totalCogs;
            out["remainingTotalUnits"] = res.remainingTotalUnits;
            out["remainingTotalValue"] = res.remainingTotalValue;
            out["updatedBatches"] = updatedArr;
            std::cout << JsonValue(out).dump() << std::endl;
            return 0;
        }

        if (command == "top_products") {
            int topN = static_cast<int>(payload.get("topN").asInt(5));
            std::vector<SaleProductEntry> entries;
            for (const auto& el : payload.get("items").asArray()) {
                entries.push_back(SaleProductEntry{
                    el.get("product_id").asInt(),
                    el.get("name").asString(),
                    el.get("sku").asString(),
                    el.get("quantity").asInt(),
                    el.get("revenue").asNumber(),
                    0.0
                });
            }
            auto top = getTopSellingProducts(entries, topN);
            JsonArray arr;
            for (const auto& t : top) {
                arr.push_back(JsonObject{
                    {"product_id", t.productId},
                    {"name", t.name},
                    {"sku", t.sku},
                    {"units_sold", t.totalUnitsSold},
                    {"revenue", t.totalRevenue}
                });
            }
            JsonObject out;
            out["algorithm"] = "C++ Max-Heap Priority Queue O(m + k log k)";
            out["topProducts"] = arr;
            std::cout << JsonValue(out).dump() << std::endl;
            return 0;
        }

        if (command == "profitability") {
            std::vector<SaleProductEntry> entries;
            for (const auto& el : payload.get("items").asArray()) {
                entries.push_back(SaleProductEntry{
                    el.get("product_id").asInt(),
                    el.get("name").asString(),
                    el.get("sku").asString(),
                    el.get("quantity").asInt(),
                    el.get("revenue").asNumber(),
                    el.get("cogs").asNumber()
                });
            }
            auto stats = analyzeProductProfitability(entries);
            JsonArray arr;
            for (const auto& s : stats) {
                arr.push_back(JsonObject{
                    {"product_id", s.productId},
                    {"name", s.name},
                    {"sku", s.sku},
                    {"units_sold", s.unitsSold},
                    {"revenue", s.revenue},
                    {"cogs", s.cogs},
                    {"gross_profit", s.grossProfit},
                    {"profit_margin", s.profitMargin}
                });
            }
            JsonObject out;
            out["algorithm"] = "C++ Profitability Aggregation & Ranking O(m + k log k)";
            out["products"] = arr;
            std::cout << JsonValue(out).dump() << std::endl;
            return 0;
        }

        std::cout << JsonValue(JsonObject{{"error", "Unknown command: " + command}}).dump() << std::endl;
        return 1;
    } catch (const std::exception& ex) {
        std::cout << JsonValue(JsonObject{{"error", ex.what()}}).dump() << std::endl;
        return 1;
    }
}
