class Solution {
public:
    int jobScheduling(vector<int>& startTime, vector<int>& endTime, vector<int>& profit) {
        int n = startTime.size();
        vector<array<int, 3>> jobs(n);
        for (int i = 0; i < n; i++) jobs[i] = {endTime[i], startTime[i], profit[i]};
        sort(jobs.begin(), jobs.end());
        vector<long long> dp(n + 1, 0);
        for (int i = 1; i <= n; i++) {
            int start = jobs[i - 1][1];
            int k = upper_bound(jobs.begin(), jobs.begin() + (i - 1), start,
                                [](int value, const array<int, 3>& job) { return value < job[0]; }) - jobs.begin();
            dp[i] = max(dp[i - 1], dp[k] + jobs[i - 1][2]);
        }
        return (int)dp[n];
    }
};
