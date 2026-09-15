class Solution {
    private Map<Integer, Integer> index;
    private int pos;
    private TreeNode build(int[] preorder, int lo, int hi) {
        if (lo > hi) return null;
        TreeNode node = new TreeNode(preorder[pos++]);
        int mid = index.get(node.val);
        node.left = build(preorder, lo, mid - 1);
        node.right = build(preorder, mid + 1, hi);
        return node;
    }
    public TreeNode buildTree(int[] preorder, int[] inorder) {
        index = new HashMap<>();
        pos = 0;
        for (int i = 0; i < inorder.length; i++) index.put(inorder[i], i);
        return build(preorder, 0, inorder.length - 1);
    }
}
