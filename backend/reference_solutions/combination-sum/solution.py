class Solution:
    def combinationSum(self, candidates: List[int], target: int) -> List[List[int]]:
        out, path = [], []
        def search(start, remain):
            if remain == 0:
                out.append(list(path))
                return
            for i in range(start, len(candidates)):
                if candidates[i] <= remain:
                    path.append(candidates[i])
                    search(i, remain - candidates[i])
                    path.pop()
        search(0, target)
        return out
