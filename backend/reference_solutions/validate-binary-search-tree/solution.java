class Solution {
    public boolean isValidBST(TreeNode root) {
        Deque<TreeNode> st = new ArrayDeque<>();
        TreeNode node = root;
        Long prev = null;
        while (!st.isEmpty() || node != null) {
            while (node != null) { st.push(node); node = node.left; }
            node = st.pop();
            if (prev != null && node.val <= prev) return false;
            prev = (long) node.val;
            node = node.right;
        }
        return true;
    }
}
