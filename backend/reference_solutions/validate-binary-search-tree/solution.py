class Solution:
    def isValidBST(self, root: Optional[TreeNode]) -> bool:
        stack, prev, node = [], None, root
        while stack or node:
            while node:
                stack.append(node)
                node = node.left
            node = stack.pop()
            if prev is not None and node.val <= prev:
                return False
            prev = node.val
            node = node.right
        return True
