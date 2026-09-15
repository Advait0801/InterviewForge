class Solution {
    private int best;
    private int gain(TreeNode node) {
        if (node == null) return 0;
        int left = Math.max(gain(node.left), 0), right = Math.max(gain(node.right), 0);
        best = Math.max(best, node.val + left + right);
        return node.val + Math.max(left, right);
    }
    public int maxPathSum(TreeNode root) {
        best = root.val;
        gain(root);
        return best;
    }
}
