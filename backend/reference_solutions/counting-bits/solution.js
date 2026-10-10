var countBits = function (n) {
  const out = [0];
  for (let i = 1; i <= n; i++) out.push(out[i >> 1] + (i & 1));
  return out;
};
