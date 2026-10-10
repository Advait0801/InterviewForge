var rightSideView = function (root) {
  const out = [];
  let level = root ? [root] : [];
  while (level.length) {
    out.push(level[level.length - 1].val);
    level = level.flatMap((n) => [n.left, n.right].filter(Boolean));
  }
  return out;
};
