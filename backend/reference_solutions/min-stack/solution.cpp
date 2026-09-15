class MinStack {
    vector<pair<int, int>> items;  // (value, minimum at push time)
public:
    MinStack() {}

    void push(int val) {
        items.push_back({val, items.empty() ? val : min(val, items.back().second)});
    }

    void pop() { items.pop_back(); }

    int top() { return items.back().first; }

    int getMin() { return items.back().second; }
};
