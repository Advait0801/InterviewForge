class LRUCache {
    int capacity;
    list<pair<int, int>> order;  // front = most recently used
    unordered_map<int, list<pair<int, int>>::iterator> where;
public:
    LRUCache(int capacity) : capacity(capacity) {}

    int get(int key) {
        auto it = where.find(key);
        if (it == where.end()) return -1;
        order.splice(order.begin(), order, it->second);
        return it->second->second;
    }

    void put(int key, int value) {
        auto it = where.find(key);
        if (it != where.end()) {
            it->second->second = value;
            order.splice(order.begin(), order, it->second);
            return;
        }
        if ((int)order.size() == capacity) {
            where.erase(order.back().first);
            order.pop_back();
        }
        order.push_front({key, value});
        where[key] = order.begin();
    }
};
