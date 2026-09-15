class Solution {
    private void search(int[] cands, int start, int remain, List<Integer> path, List<List<Integer>> out) {
        if (remain == 0) { out.add(new ArrayList<>(path)); return; }
        for (int i = start; i < cands.length; i++) {
            if (cands[i] <= remain) {
                path.add(cands[i]);
                search(cands, i, remain - cands[i], path, out);
                path.remove(path.size() - 1);
            }
        }
    }
    public List<List<Integer>> combinationSum(int[] candidates, int target) {
        List<List<Integer>> out = new ArrayList<>();
        search(candidates, 0, target, new ArrayList<>(), out);
        return out;
    }
}
