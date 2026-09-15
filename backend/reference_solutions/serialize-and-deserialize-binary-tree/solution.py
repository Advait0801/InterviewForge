from collections import deque


class Codec:
    """Level-order, LeetCode's bracket format.

    The test cases pin the serialized string itself, not just the round trip, so
    the format has to be exactly `[1, 2, 3, null, null, 4, 5]` -- ", " separators,
    `null` for gaps, trailing nulls trimmed, `[]` for an empty tree.
    """

    def serialize(self, root):
        if root is None:
            return "[]"
        out, queue = [], deque([root])
        while queue:
            node = queue.popleft()
            if node is None:
                out.append("null")
                continue
            out.append(str(node.val))
            queue.append(node.left)
            queue.append(node.right)
        while out and out[-1] == "null":
            out.pop()
        return "[" + ", ".join(out) + "]"

    def deserialize(self, data):
        body = data.strip()[1:-1].strip()
        if not body:
            return None
        tokens = [t.strip() for t in body.split(",")]
        root = TreeNode(int(tokens[0]))
        queue, i = deque([root]), 1
        while queue and i < len(tokens):
            node = queue.popleft()
            if i < len(tokens) and tokens[i] != "null":
                node.left = TreeNode(int(tokens[i]))
                queue.append(node.left)
            i += 1
            if i < len(tokens) and tokens[i] != "null":
                node.right = TreeNode(int(tokens[i]))
                queue.append(node.right)
            i += 1
        return root
