var isMatch = function (s, p) {
  const m = s.length, n = p.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(false));
  dp[m][n] = true;
  for (let i = m; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--) {
      const first = i < m && (p[j] === s[i] || p[j] === ".");
      dp[i][j] = j + 1 < n && p[j + 1] === "*" ? dp[i][j + 2] || (first && dp[i + 1][j]) : first && dp[i + 1][j + 1];
    }
  return dp[0][0];
};
