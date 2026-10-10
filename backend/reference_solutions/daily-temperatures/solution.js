var dailyTemperatures = function (temperatures) {
  const out = new Array(temperatures.length).fill(0), stack = [];
  temperatures.forEach((t, i) => {
    while (stack.length && temperatures[stack[stack.length - 1]] < t) {
      const j = stack.pop();
      out[j] = i - j;
    }
    stack.push(i);
  });
  return out;
};
