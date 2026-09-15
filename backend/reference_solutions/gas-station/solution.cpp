class Solution {
public:
    int canCompleteCircuit(vector<int>& gas, vector<int>& cost) {
        long long total = 0, tank = 0;
        int start = 0;
        for (int i = 0; i < (int)gas.size(); i++) {
            int delta = gas[i] - cost[i];
            total += delta;
            tank += delta;
            if (tank < 0) { start = i + 1; tank = 0; }
        }
        return total < 0 ? -1 : start;
    }
};
