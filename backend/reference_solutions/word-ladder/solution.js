var ladderLength = function (beginWord, endWord, wordList) {
  const words = new Set(wordList);
  if (!words.has(endWord)) return 0;
  let level = [beginWord], steps = 1;
  words.delete(beginWord);
  while (level.length) {
    const next = [];
    for (const w of level) {
      if (w === endWord) return steps;
      for (let i = 0; i < w.length; i++)
        for (let c = 97; c <= 122; c++) {
          const cand = w.slice(0, i) + String.fromCharCode(c) + w.slice(i + 1);
          if (words.has(cand)) { words.delete(cand); next.push(cand); }
        }
    }
    level = next;
    steps++;
  }
  return 0;
};
