class Solution {
    private int count(TreeNode node, int best) {
        if (node == null) return 0;
        int good = node.val >= best ? 1 : 0;
        best = Math.max(best, node.val);
        return good + count(node.left, best) + count(node.right, best);
    }
    public int goodNodes(TreeNode root) { return count(root, root.val); }
}
