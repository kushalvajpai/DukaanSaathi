#ifndef DUKAANSAATHI_ADSA_TYPES_HPP
#define DUKAANSAATHI_ADSA_TYPES_HPP

#include <cctype>
#include <cstdint>
#include <iomanip>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <variant>
#include <vector>

namespace adsa {

// Lightweight, standard C++17 JSON Value representation
struct JsonValue;
using JsonObject = std::map<std::string, JsonValue>;
using JsonArray = std::vector<JsonValue>;

struct JsonValue {
    using Variant = std::variant<std::nullptr_t, bool, double, std::string, JsonArray, JsonObject>;
    Variant data;

    JsonValue() : data(nullptr) {}
    JsonValue(std::nullptr_t) : data(nullptr) {}
    JsonValue(bool b) : data(b) {}
    JsonValue(int i) : data(static_cast<double>(i)) {}
    JsonValue(long long i) : data(static_cast<double>(i)) {}
    JsonValue(double d) : data(d) {}
    JsonValue(const char* s) : data(std::string(s)) {}
    JsonValue(std::string s) : data(std::move(s)) {}
    JsonValue(JsonArray arr) : data(std::move(arr)) {}
    JsonValue(JsonObject obj) : data(std::move(obj)) {}

    bool isNull() const { return std::holds_alternative<std::nullptr_t>(data); }
    bool isBool() const { return std::holds_alternative<bool>(data); }
    bool isNumber() const { return std::holds_alternative<double>(data); }
    bool isString() const { return std::holds_alternative<std::string>(data); }
    bool isArray() const { return std::holds_alternative<JsonArray>(data); }
    bool isObject() const { return std::holds_alternative<JsonObject>(data); }

    double asNumber(double def = 0.0) const { return isNumber() ? std::get<double>(data) : def; }
    long long asInt(long long def = 0) const { return isNumber() ? static_cast<long long>(std::get<double>(data)) : def; }
    std::string asString(const std::string& def = "") const { return isString() ? std::get<std::string>(data) : def; }
    const JsonArray& asArray() const {
        static const JsonArray empty;
        return isArray() ? std::get<JsonArray>(data) : empty;
    }
    const JsonObject& asObject() const {
        static const JsonObject empty;
        return isObject() ? std::get<JsonObject>(data) : empty;
    }

    const JsonValue& get(const std::string& key) const {
        static const JsonValue nullVal;
        if (!isObject()) return nullVal;
        const auto& obj = std::get<JsonObject>(data);
        auto it = obj.find(key);
        return it != obj.end() ? it->second : nullVal;
    }

    static std::string escapeString(const std::string& s) {
        std::ostringstream oss;
        oss << '"';
        for (char c : s) {
            switch (c) {
                case '"': oss << "\\\""; break;
                case '\\': oss << "\\\\"; break;
                case '\b': oss << "\\b"; break;
                case '\f': oss << "\\f"; break;
                case '\n': oss << "\\n"; break;
                case '\r': oss << "\\r"; break;
                case '\t': oss << "\\t"; break;
                default:
                    if (static_cast<unsigned char>(c) < 0x20) {
                        oss << "\\u00" << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(c);
                    } else {
                        oss << c;
                    }
            }
        }
        oss << '"';
        return oss.str();
    }

    std::string dump() const {
        if (isNull()) return "null";
        if (isBool()) return std::get<bool>(data) ? "true" : "false";
        if (isNumber()) {
            double v = std::get<double>(data);
            std::ostringstream oss;
            if (v == static_cast<long long>(v)) {
                oss << static_cast<long long>(v);
            } else {
                oss << std::fixed << std::setprecision(4) << v;
                std::string s = oss.str();
                s.erase(s.find_last_not_of('0') + 1, std::string::npos);
                if (!s.empty() && s.back() == '.') s.pop_back();
                return s;
            }
            return oss.str();
        }
        if (isString()) return escapeString(std::get<std::string>(data));
        if (isArray()) {
            std::ostringstream oss;
            oss << '[';
            const auto& arr = std::get<JsonArray>(data);
            for (size_t i = 0; i < arr.size(); ++i) {
                if (i > 0) oss << ',';
                oss << arr[i].dump();
            }
            oss << ']';
            return oss.str();
        }
        if (isObject()) {
            std::ostringstream oss;
            oss << '{';
            const auto& obj = std::get<JsonObject>(data);
            bool first = true;
            for (const auto& [k, v] : obj) {
                if (!first) oss << ',';
                first = false;
                oss << escapeString(k) << ':' << v.dump();
            }
            oss << '}';
            return oss.str();
        }
        return "null";
    }
};

class JsonParser {
public:
    explicit JsonParser(const std::string& input) : src_(input), pos_(0) {}

    JsonValue parse() {
        skipWhitespace();
        JsonValue val = parseValue();
        skipWhitespace();
        return val;
    }

private:
    const std::string& src_;
    size_t pos_;

    void skipWhitespace() {
        while (pos_ < src_.size() && std::isspace(static_cast<unsigned char>(src_[pos_]))) {
            ++pos_;
        }
    }

    char peek() const { return pos_ < src_.size() ? src_[pos_] : '\0'; }
    char get() { return pos_ < src_.size() ? src_[pos_++] : '\0'; }

    JsonValue parseValue() {
        skipWhitespace();
        char c = peek();
        if (c == '{') return parseObject();
        if (c == '[') return parseArray();
        if (c == '"') return JsonValue(parseString());
        if (c == 't') { expect("true"); return JsonValue(true); }
        if (c == 'f') { expect("false"); return JsonValue(false); }
        if (c == 'n') { expect("null"); return JsonValue(nullptr); }
        if (c == '-' || std::isdigit(static_cast<unsigned char>(c))) return parseNumber();
        throw std::runtime_error("Unexpected character in JSON");
    }

    void expect(const std::string& kw) {
        if (src_.compare(pos_, kw.size(), kw) != 0) {
            throw std::runtime_error("Invalid keyword in JSON");
        }
        pos_ += kw.size();
    }

    std::string parseString() {
        if (get() != '"') throw std::runtime_error("Expected '\"'");
        std::string out;
        while (pos_ < src_.size()) {
            char c = get();
            if (c == '"') return out;
            if (c == '\\') {
                char esc = get();
                switch (esc) {
                    case '"': out.push_back('"'); break;
                    case '\\': out.push_back('\\'); break;
                    case '/': out.push_back('/'); break;
                    case 'b': out.push_back('\b'); break;
                    case 'f': out.push_back('\f'); break;
                    case 'n': out.push_back('\n'); break;
                    case 'r': out.push_back('\r'); break;
                    case 't': out.push_back('\t'); break;
                    default: out.push_back(esc); break;
                }
            } else {
                out.push_back(c);
            }
        }
        throw std::runtime_error("Unterminated string in JSON");
    }

    JsonValue parseNumber() {
        size_t start = pos_;
        if (peek() == '-') ++pos_;
        while (std::isdigit(static_cast<unsigned char>(peek()))) ++pos_;
        if (peek() == '.') {
            ++pos_;
            while (std::isdigit(static_cast<unsigned char>(peek()))) ++pos_;
        }
        if (peek() == 'e' || peek() == 'E') {
            ++pos_;
            if (peek() == '+' || peek() == '-') ++pos_;
            while (std::isdigit(static_cast<unsigned char>(peek()))) ++pos_;
        }
        return JsonValue(std::stod(src_.substr(start, pos_ - start)));
    }

    JsonValue parseArray() {
        get(); // '['
        JsonArray arr;
        skipWhitespace();
        if (peek() == ']') { get(); return JsonValue(arr); }
        while (true) {
            arr.push_back(parseValue());
            skipWhitespace();
            char c = get();
            if (c == ']') break;
            if (c != ',') throw std::runtime_error("Expected ',' or ']' in JSON array");
        }
        return JsonValue(arr);
    }

    JsonValue parseObject() {
        get(); // '{'
        JsonObject obj;
        skipWhitespace();
        if (peek() == '}') { get(); return JsonValue(obj); }
        while (true) {
            skipWhitespace();
            std::string key = parseString();
            skipWhitespace();
            if (get() != ':') throw std::runtime_error("Expected ':' in JSON object");
            obj[key] = parseValue();
            skipWhitespace();
            char c = get();
            if (c == '}') break;
            if (c != ',') throw std::runtime_error("Expected ',' or '}' in JSON object");
        }
        return JsonValue(obj);
    }
};

// --- Domain Structs & Algorithm Function Declarations ---

struct SearchProductItem {
    long long id;
    std::string sku;
    std::string name;
};

struct BinarySearchResult {
    bool found;
    SearchProductItem item;
    int comparisons;
};

BinarySearchResult binarySearchProduct(
    const std::vector<SearchProductItem>& sortedItems,
    const std::string& key,
    const std::string& target
);

struct SortProductItem {
    long long id;
    double price;
    long long stock;
    double profit;
};

void mergeSortProducts(
    std::vector<SortProductItem>& items,
    const std::string& sortBy,
    bool ascending
);

struct SortSaleItem {
    long long id;
    double revenue;
    long long timestamp;
};

void quickSortSales(
    std::vector<SortSaleItem>& items,
    const std::string& sortBy,
    bool ascending
);

struct InventoryBatch {
    long long id;
    long long remainingQuantity;
    double unitCost;
};

struct FifoResult {
    double totalCogs;
    long long remainingTotalUnits;
    double remainingTotalValue;
    std::vector<InventoryBatch> updatedBatches;
};

FifoResult calculateFifoCogs(
    std::vector<InventoryBatch> batches,
    long long quantityToSell
);

struct SaleProductEntry {
    long long productId;
    std::string name;
    std::string sku;
    long long quantity;
    double revenue;
    double cogs;
};

struct TopProductStat {
    long long productId;
    std::string name;
    std::string sku;
    long long totalUnitsSold;
    double totalRevenue;
};

std::vector<TopProductStat> getTopSellingProducts(
    const std::vector<SaleProductEntry>& entries,
    int topN
);

struct ProfitabilityStat {
    long long productId;
    std::string name;
    std::string sku;
    long long unitsSold;
    double revenue;
    double cogs;
    double grossProfit;
    double profitMargin;
};

std::vector<ProfitabilityStat> analyzeProductProfitability(
    const std::vector<SaleProductEntry>& entries
);

} // namespace adsa

#endif // DUKAANSAATHI_ADSA_TYPES_HPP
