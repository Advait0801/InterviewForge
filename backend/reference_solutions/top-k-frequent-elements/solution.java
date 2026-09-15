class Solution {
    public int[] topKFrequent(int[] nums, int k) {
        Map<Integer, Integer> freq = new HashMap<>();
        for (int x : nums) freq.merge(x, 1, Integer::sum);
        List<Integer> keys = new ArrayList<>(freq.keySet());
        keys.sort((a, b) -> !freq.get(a).equals(freq.get(b)) ? freq.get(b) - freq.get(a) : a - b);
        int[] out = new int[Math.min(k, keys.size())];
        for (int i = 0; i < out.length; i++) out[i] = keys.get(i);
        return out;
    }
}
