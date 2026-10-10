var change = function (amount, coins) {
  const ways = new Array(amount + 1).fill(0);
  ways[0] = 1;
  for (const c of coins) for (let a = c; a <= amount; a++) ways[a] += ways[a - c];
  return ways[amount];
};
