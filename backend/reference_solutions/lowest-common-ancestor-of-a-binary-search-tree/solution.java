class Solution {
    public TreeNode lowestCommonAncestor(TreeNode root, TreeNode p, TreeNode q) {
        int lo = Math.min(p.val, q.val), hi = Math.max(p.val, q.val);
        TreeNode node = root;
        while (node != null) {
            if (hi < node.val) node = node.left;
            else if (lo > node.val) node = node.right;
            else return node;
        }
        return null;
    }
}
