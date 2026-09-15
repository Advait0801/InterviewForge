class Solution {
    private int height(TreeNode node) {
        if (node == null) return 0;
        int l = height(node.left);
        if (l < 0) return -1;
        int r = height(node.right);
        if (r < 0 || Math.abs(l - r) > 1) return -1;
        return 1 + Math.max(l, r);
    }
    public boolean isBalanced(TreeNode root) { return height(root) >= 0; }
}
