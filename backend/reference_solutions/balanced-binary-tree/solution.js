var isBalanced = function (root) {
  // Height, or -1 once any subtree is unbalanced.
  const height = (node) => {
    if (!node) return 0;
    const l = height(node.left), r = height(node.right);
    if (l < 0 || r < 0 || Math.abs(l - r) > 1) return -1;
    return 1 + Math.max(l, r);
  };
  return height(root) >= 0;
};
