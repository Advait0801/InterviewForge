class Solution:
    def isPalindrome(self, s: str) -> bool:
        cleaned = [ch.lower() for ch in s if ch.isalnum()]
        return cleaned == cleaned[::-1]
