var countSubstrings = function (s) {
  let count = 0;
  for (let center = 0; center < 2 * s.length - 1; center++) {
    let l = center >> 1, r = l + (center & 1);
    while (l >= 0 && r < s.length && s[l] === s[r]) { count++; l--; r++; }
  }
  return count;
};
