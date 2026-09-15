class TimeMap {
    unordered_map<string, vector<pair<int, string>>> history;
public:
    TimeMap() {}

    void set(string key, string value, int timestamp) {
        history[key].push_back({timestamp, value});
    }

    string get(string key, int timestamp) {
        auto it = history.find(key);
        if (it == history.end()) return "";
        auto& entries = it->second;
        int lo = 0, hi = entries.size();
        while (lo < hi) {
            int mid = (lo + hi) / 2;
            if (entries[mid].first <= timestamp) lo = mid + 1; else hi = mid;
        }
        return lo == 0 ? "" : entries[lo - 1].second;
    }
};
