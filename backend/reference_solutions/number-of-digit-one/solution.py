class Solution:
    def countDigitOne(self, n: int) -> int:
        count, factor = 0, 1
        while factor <= n:
            higher, current, lower = n // (factor * 10), (n // factor) % 10, n % factor
            if current == 0:
                count += higher * factor
            elif current == 1:
                count += higher * factor + lower + 1
            else:
                count += (higher + 1) * factor
            factor *= 10
        return count
