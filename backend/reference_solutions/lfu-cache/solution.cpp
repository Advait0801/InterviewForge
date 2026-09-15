class LFUCache {
    struct Entry { int value; int count; list<int>::iterator where; };
    int capacity, minCount = 0;
    unordered_map<int, Entry> entries;
    unordered_map<int, list<int>> groups;  // use count -> keys, most recently used at the front

    void use(int key) {
        Entry& e = entries[key];
        groups[e.count].erase(e.where);
        if (groups[e.count].empty()) {
            groups.erase(e.count);
            if (minCount == e.count) minCount++;
        }
        e.count++;
        groups[e.count].push_front(key);
        e.where = groups[e.count].begin();
    }
public:
    LFUCache(int capacity) : capacity(capacity) {}

    int get(int key) {
        auto it = entries.find(key);
        if (it == entries.end()) return -1;
        use(key);
        return entries[key].value;
    }

    void put(int key, int value) {
        auto it = entries.find(key);
        if (it != entries.end()) {
            it->second.value = value;
            use(key);
            return;
        }
        if ((int)entries.size() == capacity) {
            int victim = groups[minCount].back();
            groups[minCount].pop_back();
            if (groups[minCount].empty()) groups.erase(minCount);
            entries.erase(victim);
        }
        groups[1].push_front(key);
        entries[key] = {value, 1, groups[1].begin()};
        minCount = 1;
    }
};
