var numDecodings = function (s) {
  let prev = 1, cur = s[0] === "0" ? 0 : 1;
  for (let i = 1; i < s.length; i++) {
    let next = s[i] !== "0" ? cur : 0;
    const two = Number(s.slice(i - 1, i + 1));
    if (two >= 10 && two <= 26) next += prev;
    [prev, cur] = [cur, next];
  }
  return cur;
};
