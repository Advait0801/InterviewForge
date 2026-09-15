class Solution {
    public List<List<Integer>> generate(int numRows) {
        List<List<Integer>> rows = new ArrayList<>();
        for (int r = 0; r < numRows; r++) {
            List<Integer> row = new ArrayList<>();
            for (int c = 0; c <= r; c++) {
                row.add(c == 0 || c == r ? 1 : rows.get(r - 1).get(c - 1) + rows.get(r - 1).get(c));
            }
            rows.add(row);
        }
        return rows;
    }
}
