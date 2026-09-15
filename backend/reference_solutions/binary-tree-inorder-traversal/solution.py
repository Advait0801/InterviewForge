class Solution:
    def inorderTraversal(self, root: Optional[TreeNode]) -> List[int]:
        out, stack, node = [], [], root
        while node or stack:
            while node:
                stack.append(node)
                node = node.left
            node = stack.pop()
            out.append(node.val)
            node = node.right
        return out
