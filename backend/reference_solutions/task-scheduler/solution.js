var leastInterval = function (tasks, n) {
  const count = new Map();
  for (const t of tasks) count.set(t, (count.get(t) || 0) + 1);
  const max = Math.max(...count.values());
  let maxCount = 0;
  for (const v of count.values()) if (v === max) maxCount++;
  return Math.max(tasks.length, (max - 1) * (n + 1) + maxCount);
};
