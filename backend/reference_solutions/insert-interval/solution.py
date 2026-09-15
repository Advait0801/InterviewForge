class Solution:
    def insert(self, intervals: List[List[int]], newInterval: List[int]) -> List[List[int]]:
        start, end = newInterval
        out, i = [], 0
        while i < len(intervals) and intervals[i][1] < start:
            out.append(intervals[i])
            i += 1
        while i < len(intervals) and intervals[i][0] <= end:
            start, end = min(start, intervals[i][0]), max(end, intervals[i][1])
            i += 1
        out.append([start, end])
        return out + intervals[i:]
