class Solution:
    def maxPathSum(self, root: Optional[TreeNode]) -> int:
        best = root.val
        def gain(node):
            nonlocal best
            if not node:
                return 0
            left, right = max(gain(node.left), 0), max(gain(node.right), 0)
            best = max(best, node.val + left + right)
            return node.val + max(left, right)
        gain(root)
        return best
