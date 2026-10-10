var intersection = function (nums1, nums2) {
  const a = new Set(nums1);
  return [...new Set(nums2)].filter((x) => a.has(x));
};
