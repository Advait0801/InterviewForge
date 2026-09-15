class Solution {
    public List<Integer> inorderTraversal(TreeNode root) {
        List<Integer> out = new ArrayList<>();
        Deque<TreeNode> stack = new ArrayDeque<>();
        TreeNode node = root;
        while (node != null || !stack.isEmpty()) {
            while (node != null) { stack.push(node); node = node.left; }
            node = stack.pop();
            out.add(node.val);
            node = node.right;
        }
        return out;
    }
}
