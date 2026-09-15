class Solution {
    private void build(List<String> out, StringBuilder cur, int opened, int closed, int n) {
        if (cur.length() == 2 * n) { out.add(cur.toString()); return; }
        if (opened < n) { cur.append('('); build(out, cur, opened + 1, closed, n); cur.deleteCharAt(cur.length() - 1); }
        if (closed < opened) { cur.append(')'); build(out, cur, opened, closed + 1, n); cur.deleteCharAt(cur.length() - 1); }
    }
    public List<String> generateParenthesis(int n) {
        List<String> out = new ArrayList<>();
        build(out, new StringBuilder(), 0, 0, n);
        return out;
    }
}
