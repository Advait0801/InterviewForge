class Solution {
    private boolean mirror(TreeNode a, TreeNode b) {
        if (a == null || b == null) return a == b;
        return a.val == b.val && mirror(a.left, b.right) && mirror(a.right, b.left);
    }
    public boolean isSymmetric(TreeNode root) {
        return mirror(root.left, root.right);
    }
}
