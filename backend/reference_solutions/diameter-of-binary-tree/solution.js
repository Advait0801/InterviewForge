var diameterOfBinaryTree = function (root) {
  let best = 0;
  const depth = (node) => {
    if (!node) return 0;
    const l = depth(node.left), r = depth(node.right);
    best = Math.max(best, l + r);
    return 1 + Math.max(l, r);
  };
  depth(root);
  return best;
};
