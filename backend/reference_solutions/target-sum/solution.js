var findTargetSumWays = function (nums, target) {
  let ways = new Map([[0, 1]]);
  for (const x of nums) {
    const next = new Map();
    for (const [s, w] of ways) {
      next.set(s + x, (next.get(s + x) || 0) + w);
      next.set(s - x, (next.get(s - x) || 0) + w);
    }
    ways = next;
  }
  return ways.get(target) || 0;
};
