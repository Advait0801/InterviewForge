class Solution:
    def minCut(self, s: str) -> int:
        n = len(s)
        cuts = list(range(-1, n))  # cuts[i]: fewest cuts for s[:i]; cuts[0] = -1
        for center in range(n):
            for odd in (0, 1):
                left, right = center, center + odd
                while left >= 0 and right < n and s[left] == s[right]:
                    cuts[right + 1] = min(cuts[right + 1], cuts[left] + 1)
                    left -= 1
                    right += 1
        return cuts[n]
