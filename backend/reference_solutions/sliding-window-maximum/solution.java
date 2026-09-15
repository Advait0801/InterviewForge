class Solution {
    public int[] maxSlidingWindow(int[] nums, int k) {
        int[] out = new int[nums.length - k + 1];
        Deque<Integer> window = new ArrayDeque<>();
        for (int i = 0; i < nums.length; i++) {
            while (!window.isEmpty() && nums[window.peekLast()] <= nums[i]) window.pollLast();
            window.addLast(i);
            if (window.peekFirst() <= i - k) window.pollFirst();
            if (i >= k - 1) out[i - k + 1] = nums[window.peekFirst()];
        }
        return out;
    }
}
