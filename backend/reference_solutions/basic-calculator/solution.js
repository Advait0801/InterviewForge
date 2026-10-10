var calculate = function (s) {
  let result = 0, sign = 1, num = 0;
  const stack = [];
  for (const ch of s) {
    if (ch >= "0" && ch <= "9") num = num * 10 + (ch.charCodeAt(0) - 48);
    else if (ch === "+" || ch === "-") {
      result += sign * num;
      num = 0;
      sign = ch === "+" ? 1 : -1;
    } else if (ch === "(") {
      stack.push(result, sign);
      result = 0;
      sign = 1;
    } else if (ch === ")") {
      result += sign * num;
      num = 0;
      const prevSign = stack.pop(), prevResult = stack.pop();
      result = prevResult + prevSign * result;
    }
  }
  return result + sign * num;
};
