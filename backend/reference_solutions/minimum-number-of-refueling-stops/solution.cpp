class Solution {
public:
    int minRefuelStops(int target, int startFuel, vector<vector<int>>& stations) {
        priority_queue<int> heap;
        long long reach = startFuel;
        int stops = 0;
        size_t i = 0;
        while (reach < target) {
            while (i < stations.size() && stations[i][0] <= reach) heap.push(stations[i++][1]);
            if (heap.empty()) return -1;
            reach += heap.top();
            heap.pop();
            stops++;
        }
        return stops;
    }
};
