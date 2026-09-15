class Solution:
    def lowestCommonAncestor(self, root: 'TreeNode', p: 'TreeNode', q: 'TreeNode') -> 'TreeNode':
        lo, hi = min(p.val, q.val), max(p.val, q.val)
        node = root
        while node:
            if hi < node.val:
                node = node.left
            elif lo > node.val:
                node = node.right
            else:
                return node
        return None
