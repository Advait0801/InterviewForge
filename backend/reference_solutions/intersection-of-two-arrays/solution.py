class Solution:
    def intersection(self, nums1: List[int], nums2: List[int]) -> List[int]:
        present = [False] * 1001
        for v in nums1:
            present[v] = True
        out = []
        for v in nums2:
            if present[v]:
                present[v] = False
                out.append(v)
        return out
