var evalRPN = function (tokens) {
  const stack = [];
  for (const t of tokens) {
    if (!"+-*/".includes(t) || t.length > 1) { stack.push(Number(t)); continue; }
    const b = stack.pop(), a = stack.pop();
    stack.push(t === "+" ? a + b : t === "-" ? a - b : t === "*" ? a * b : Math.trunc(a / b));
  }
  return stack[0];
};
