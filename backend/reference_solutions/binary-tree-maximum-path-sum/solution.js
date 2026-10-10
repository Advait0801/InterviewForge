var maxPathSum = function (root) {
  let best = -Infinity;
  const gain = (node) => {
    if (!node) return 0;
    const l = Math.max(0, gain(node.left)), r = Math.max(0, gain(node.right));
    best = Math.max(best, node.val + l + r);
    return node.val + Math.max(l, r);
  };
  gain(root);
  return best;
};
