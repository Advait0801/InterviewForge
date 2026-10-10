var productExceptSelf = function (nums) {
  const n = nums.length, out = new Array(n).fill(1);
  let left = 1;
  for (let i = 0; i < n; i++) { out[i] = left; left *= nums[i]; }
  let right = 1;
  for (let i = n - 1; i >= 0; i--) { out[i] *= right; right *= nums[i]; }
  return out.map((x) => (x === 0 ? 0 : x)); // no -0
};
