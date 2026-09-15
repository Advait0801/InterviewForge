class Solution {
    private int best;
    private int height(TreeNode node) {
        if (node == null) return 0;
        int l = height(node.left), r = height(node.right);
        best = Math.max(best, l + r);
        return 1 + Math.max(l, r);
    }
    public int diameterOfBinaryTree(TreeNode root) {
        best = 0;
        height(root);
        return best;
    }
}
