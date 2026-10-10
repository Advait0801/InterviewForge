var canConstruct = function (ransomNote, magazine) {
  const count = new Map();
  for (const c of magazine) count.set(c, (count.get(c) || 0) + 1);
  for (const c of ransomNote) {
    if (!count.get(c)) return false;
    count.set(c, count.get(c) - 1);
  }
  return true;
};
