var numDistinct = function (s, t) {
  // BigInt: intermediate counts can pass 2^53 even when the answer fits 32 bits.
  const dp = new Array(t.length + 1).fill(0n);
  dp[0] = 1n;
  for (const c of s)
    for (let j = t.length; j >= 1; j--) if (t[j - 1] === c) dp[j] += dp[j - 1];
  return Number(dp[t.length]);
};
