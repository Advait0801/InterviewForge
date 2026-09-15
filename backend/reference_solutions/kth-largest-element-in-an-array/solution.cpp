class Solution {
public:
    int findKthLargest(vector<int>& nums, int k) {
        priority_queue<int, vector<int>, greater<int>> heap;
        for (int v : nums) {
            heap.push(v);
            if ((int)heap.size() > k) heap.pop();
        }
        return heap.top();
    }
};
