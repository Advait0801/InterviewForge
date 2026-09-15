class MedianFinder {
    priority_queue<int> low;
    priority_queue<int, vector<int>, greater<int>> high;

public:
    MedianFinder() {}

    void addNum(int num) {
        low.push(num);
        high.push(low.top()); low.pop();
        if (high.size() > low.size()) { low.push(high.top()); high.pop(); }
    }

    double findMedian() {
        if (low.size() > high.size()) return low.top();
        return ((double)low.top() + high.top()) / 2.0;
    }
};
