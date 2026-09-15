class Solution:
    def plusOne(self, digits: List[int]) -> List[int]:
        out = list(digits)
        for i in range(len(out) - 1, -1, -1):
            if out[i] < 9:
                out[i] += 1
                return out
            out[i] = 0
        return [1] + out
