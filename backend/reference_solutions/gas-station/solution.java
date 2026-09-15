class Solution {
    public int canCompleteCircuit(int[] gas, int[] cost) {
        long total = 0, tank = 0;
        int start = 0;
        for (int i = 0; i < gas.length; i++) {
            int delta = gas[i] - cost[i];
            total += delta;
            tank += delta;
            if (tank < 0) { start = i + 1; tank = 0; }
        }
        return total < 0 ? -1 : start;
    }
}
