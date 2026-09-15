class Solution:
    def longestCommonPrefix(self, strs: List[str]) -> str:
        length = len(strs[0])
        for s in strs[1:]:
            j = 0
            while j < length and j < len(s) and s[j] == strs[0][j]:
                j += 1
            length = j
        return strs[0][:length]
