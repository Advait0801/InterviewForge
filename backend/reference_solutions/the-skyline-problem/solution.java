class Solution {
    public List<List<Integer>> getSkyline(int[][] buildings) {
        TreeSet<Integer> xs = new TreeSet<>();
        for (int[] b : buildings) { xs.add(b[0]); xs.add(b[1]); }
        PriorityQueue<int[]> heap = new PriorityQueue<>((a, b) -> Integer.compare(b[0], a[0]));  // {height, right}
        List<List<Integer>> out = new ArrayList<>();
        int i = 0;
        for (int x : xs) {
            while (i < buildings.length && buildings[i][0] <= x) { heap.add(new int[]{buildings[i][2], buildings[i][1]}); i++; }
            while (!heap.isEmpty() && heap.peek()[1] <= x) heap.poll();
            int height = heap.isEmpty() ? 0 : heap.peek()[0];
            if (out.isEmpty() || out.get(out.size() - 1).get(1) != height) out.add(Arrays.asList(x, height));
        }
        return out;
    }
}
