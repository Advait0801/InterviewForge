class Solution:
    def goodNodes(self, root: TreeNode) -> int:
        count, stack = 0, [(root, root.val)]
        while stack:
            node, best = stack.pop()
            if node.val >= best:
                count += 1
                best = node.val
            for child in (node.left, node.right):
                if child:
                    stack.append((child, best))
        return count
