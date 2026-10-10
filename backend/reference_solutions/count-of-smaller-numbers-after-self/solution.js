var countSmaller = function (nums) {
  // Fenwick tree over value ranks, scanned right to left.
  const sorted = [...new Set(nums)].sort((a, b) => a - b);
  const rank = new Map(sorted.map((v, i) => [v, i + 1]));
  const tree = new Array(sorted.length + 1).fill(0);
  const out = new Array(nums.length);
  for (let i = nums.length - 1; i >= 0; i--) {
    let r = rank.get(nums[i]) - 1, s = 0;
    for (; r > 0; r -= r & -r) s += tree[r];
    out[i] = s;
    for (let j = rank.get(nums[i]); j < tree.length; j += j & -j) tree[j]++;
  }
  return out;
};
