var letterCombinations = function (digits) {
  if (!digits) return [];
  const keys = { 2: "abc", 3: "def", 4: "ghi", 5: "jkl", 6: "mno", 7: "pqrs", 8: "tuv", 9: "wxyz" };
  let out = [""];
  for (const d of digits) out = out.flatMap((p) => [...keys[d]].map((c) => p + c));
  return out;
};
