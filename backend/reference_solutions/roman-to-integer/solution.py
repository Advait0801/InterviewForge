class Solution:
    def romanToInt(self, s: str) -> int:
        value = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}
        total = 0
        for i, ch in enumerate(s):
            v = value[ch]
            if i + 1 < len(s) and v < value[s[i + 1]]:
                total -= v
            else:
                total += v
        return total
