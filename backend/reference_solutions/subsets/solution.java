class Solution {
    public List<List<Integer>> subsets(int[] nums) {
        List<List<Integer>> out = new ArrayList<>();
        out.add(new ArrayList<>());
        for (int v : nums) {
            int size = out.size();
            for (int i = 0; i < size; i++) {
                List<Integer> next = new ArrayList<>(out.get(i));
                next.add(v);
                out.add(next);
            }
        }
        return out;
    }
}
