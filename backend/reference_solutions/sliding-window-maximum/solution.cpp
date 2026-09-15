class Solution {
public:
    vector<int> maxSlidingWindow(vector<int>& nums, int k) {
        deque<int> window;
        vector<int> out;
        for (int i = 0; i < (int)nums.size(); i++) {
            while (!window.empty() && nums[window.back()] <= nums[i]) window.pop_back();
            window.push_back(i);
            if (window.front() <= i - k) window.pop_front();
            if (i >= k - 1) out.push_back(nums[window.front()]);
        }
        return out;
    }
};
