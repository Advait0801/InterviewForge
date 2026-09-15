class Solution {
    public int findKthLargest(int[] nums, int k) {
        PriorityQueue<Integer> heap = new PriorityQueue<>();
        for (int v : nums) {
            heap.offer(v);
            if (heap.size() > k) heap.poll();
        }
        return heap.peek();
    }
}
