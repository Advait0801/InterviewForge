var shortestPalindrome = function (s) {
  // KMP failure function of s + "#" + reverse(s): the longest palindromic prefix.
  const rev = [...s].reverse().join(""), t = s + "#" + rev;
  const fail = new Array(t.length).fill(0);
  for (let i = 1; i < t.length; i++) {
    let j = fail[i - 1];
    while (j > 0 && t[i] !== t[j]) j = fail[j - 1];
    if (t[i] === t[j]) j++;
    fail[i] = j;
  }
  return rev.slice(0, s.length - fail[t.length - 1]) + s;
};
