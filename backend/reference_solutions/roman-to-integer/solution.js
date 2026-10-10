var romanToInt = function (s) {
  const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    total += i + 1 < s.length && v[s[i]] < v[s[i + 1]] ? -v[s[i]] : v[s[i]];
  }
  return total;
};
