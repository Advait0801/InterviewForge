class Solution {
public:
    int leastInterval(vector<char>& tasks, int n) {
        int counts[26] = {0};
        for (char t : tasks) counts[t - 'A']++;
        int peak = *max_element(counts, counts + 26), atPeak = 0;
        for (int c : counts) if (c == peak) atPeak++;
        return max((int)tasks.size(), (peak - 1) * (n + 1) + atPeak);
    }
};
