class Solution:
    def numDecodings(self, s: str) -> int:
        prev2, prev1 = 0, 1  # ways for prefixes of length i-2 and i-1
        for i in range(len(s)):
            cur = prev1 if s[i] != "0" else 0
            if i > 0 and (s[i - 1] == "1" or (s[i - 1] == "2" and s[i] <= "6")):
                cur += prev2
            prev2, prev1 = prev1, cur
        return prev1
