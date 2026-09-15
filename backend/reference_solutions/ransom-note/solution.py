class Solution:
    def canConstruct(self, ransomNote: str, magazine: str) -> bool:
        counts = [0] * 26
        for ch in magazine:
            counts[ord(ch) - 97] += 1
        for ch in ransomNote:
            counts[ord(ch) - 97] -= 1
            if counts[ord(ch) - 97] < 0:
                return False
        return True
