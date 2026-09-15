class Solution:
    def buildTree(self, preorder: List[int], inorder: List[int]) -> Optional[TreeNode]:
        index = {v: i for i, v in enumerate(inorder)}
        pos = 0
        def build(lo, hi):
            nonlocal pos
            if lo > hi:
                return None
            node = TreeNode(preorder[pos])
            pos += 1
            mid = index[node.val]
            node.left = build(lo, mid - 1)
            node.right = build(mid + 1, hi)
            return node
        return build(0, len(inorder) - 1)
