var moveZeroes = function (nums) {
  let w = 0;
  for (let i = 0; i < nums.length; i++) if (nums[i] !== 0) nums[w++] = nums[i];
  while (w < nums.length) nums[w++] = 0;
};
