var isPalindrome = function (x) {
  if (x < 0) return false;
  const s = String(x);
  return s === [...s].reverse().join("");
};
