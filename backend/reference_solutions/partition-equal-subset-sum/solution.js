var canPartition = function (nums) {
  const total = nums.reduce((a, b) => a + b, 0);
  if (total % 2) return false;
  const half = total / 2, can = new Array(half + 1).fill(false);
  can[0] = true;
  for (const x of nums) for (let s = half; s >= x; s--) if (can[s - x]) can[s] = true;
  return can[half];
};
