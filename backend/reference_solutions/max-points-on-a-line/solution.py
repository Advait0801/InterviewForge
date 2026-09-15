from collections import Counter
from math import gcd

class Solution:
    def maxPoints(self, points: List[List[int]]) -> int:
        n = len(points)
        if n <= 2:
            return n
        best = 1
        for i in range(n):
            slopes = Counter()
            x1, y1 = points[i]
            for j in range(i + 1, n):
                dx, dy = points[j][0] - x1, points[j][1] - y1
                g = gcd(dx, dy)
                dx, dy = dx // g, dy // g
                if dx < 0 or (dx == 0 and dy < 0):
                    dx, dy = -dx, -dy
                slopes[(dx, dy)] += 1
            if slopes:
                best = max(best, max(slopes.values()) + 1)
        return best
