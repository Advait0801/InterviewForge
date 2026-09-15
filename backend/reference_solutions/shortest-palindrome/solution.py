class Solution:
    def shortestPalindrome(self, s: str) -> str:
        combined = s + "#" + s[::-1]
        fail = [0] * len(combined)
        for i in range(1, len(combined)):
            k = fail[i - 1]
            while k and combined[i] != combined[k]:
                k = fail[k - 1]
            if combined[i] == combined[k]:
                k += 1
            fail[i] = k
        return s[fail[-1]:][::-1] + s
