import bisect


class Solution:
    def jobScheduling(self, startTime: List[int], endTime: List[int], profit: List[int]) -> int:
        jobs = sorted(zip(endTime, startTime, profit))
        ends = [job[0] for job in jobs]
        dp = [0] * (len(jobs) + 1)
        for i, (end, start, gain) in enumerate(jobs, start=1):
            k = bisect.bisect_right(ends, start, 0, i - 1)
            dp[i] = max(dp[i - 1], dp[k] + gain)
        return dp[-1]
