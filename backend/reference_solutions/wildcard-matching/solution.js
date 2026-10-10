var isMatch = function (s, p) {
  const m = s.length, n = p.length;
  let prev = new Array(n + 1).fill(false);
  prev[0] = true;
  for (let j = 1; j <= n; j++) prev[j] = prev[j - 1] && p[j - 1] === "*";
  for (let i = 1; i <= m; i++) {
    const cur = [false];
    for (let j = 1; j <= n; j++) {
      if (p[j - 1] === "*") cur[j] = cur[j - 1] || prev[j];
      else cur[j] = prev[j - 1] && (p[j - 1] === "?" || p[j - 1] === s[i - 1]);
    }
    prev = cur;
  }
  return prev[n];
};
