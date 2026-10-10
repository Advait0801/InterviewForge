var isAnagram = function (s, t) {
  if (s.length !== t.length) return false;
  const count = new Map();
  for (const c of s) count.set(c, (count.get(c) || 0) + 1);
  for (const c of t) {
    if (!count.get(c)) return false;
    count.set(c, count.get(c) - 1);
  }
  return true;
};
