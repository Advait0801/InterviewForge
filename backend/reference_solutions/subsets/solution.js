var subsets = function (nums) {
  let out = [[]];
  for (const x of nums) out = out.concat(out.map((s) => [...s, x]));
  return out;
};
