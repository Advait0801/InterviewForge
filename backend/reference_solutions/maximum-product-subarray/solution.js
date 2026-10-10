var maxProduct = function (nums) {
  let hi = nums[0], lo = nums[0], best = nums[0];
  for (let i = 1; i < nums.length; i++) {
    const x = nums[i];
    [hi, lo] = [Math.max(x, hi * x, lo * x), Math.min(x, hi * x, lo * x)];
    best = Math.max(best, hi);
  }
  return best === 0 ? 0 : best; // no -0
};
