class Solution:
    def countSubstrings(self, s: str) -> int:
        count = 0
        for center in range(2 * len(s) - 1):
            left, right = center // 2, center // 2 + center % 2
            while left >= 0 and right < len(s) and s[left] == s[right]:
                count += 1
                left -= 1
                right += 1
        return count
