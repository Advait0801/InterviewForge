var generateParenthesis = function (n) {
  const out = [];
  const build = (s, open, close) => {
    if (s.length === 2 * n) return out.push(s);
    if (open < n) build(s + "(", open + 1, close);
    if (close < open) build(s + ")", open, close + 1);
  };
  build("", 0, 0);
  return out;
};
