class Solution:
    def countSmaller(self, nums: List[int]) -> List[int]:
        offset, size = 10001, 20002
        tree = [0] * (size + 1)
        out = [0] * len(nums)
        for i in range(len(nums) - 1, -1, -1):
            idx = nums[i] + offset
            q, total = idx - 1, 0
            while q > 0:
                total += tree[q]
                q -= q & -q
            out[i] = total
            while idx <= size:
                tree[idx] += 1
                idx += idx & -idx
        return out
