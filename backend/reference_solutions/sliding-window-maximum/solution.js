var maxSlidingWindow = function (nums, k) {
  const dq = [], out = [];
  let head = 0;
  for (let i = 0; i < nums.length; i++) {
    while (dq.length > head && nums[dq[dq.length - 1]] <= nums[i]) dq.pop();
    dq.push(i);
    if (dq[head] <= i - k) head++;
    if (i >= k - 1) out.push(nums[dq[head]]);
  }
  return out;
};
