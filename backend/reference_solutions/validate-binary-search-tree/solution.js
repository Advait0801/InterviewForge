var isValidBST = function (root) {
  const check = (node, lo, hi) =>
    !node || (node.val > lo && node.val < hi && check(node.left, lo, node.val) && check(node.right, node.val, hi));
  return check(root, -Infinity, Infinity);
};
