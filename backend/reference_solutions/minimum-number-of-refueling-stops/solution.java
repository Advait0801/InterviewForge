class Solution {
    public int minRefuelStops(int target, int startFuel, int[][] stations) {
        PriorityQueue<Integer> heap = new PriorityQueue<>(Collections.reverseOrder());
        long reach = startFuel;
        int stops = 0, i = 0;
        while (reach < target) {
            while (i < stations.length && stations[i][0] <= reach) heap.add(stations[i++][1]);
            if (heap.isEmpty()) return -1;
            reach += heap.poll();
            stops++;
        }
        return stops;
    }
}
