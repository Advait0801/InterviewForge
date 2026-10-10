var goodNodes = function (root) {
  const count = (node, max) => {
    if (!node) return 0;
    const good = node.val >= max ? 1 : 0;
    const m = Math.max(max, node.val);
    return good + count(node.left, m) + count(node.right, m);
  };
  return count(root, -Infinity);
};
