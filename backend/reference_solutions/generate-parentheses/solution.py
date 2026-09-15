class Solution:
    def generateParenthesis(self, n: int) -> List[str]:
        out = []
        def build(cur, opened, closed):
            if len(cur) == 2 * n:
                out.append(cur)
                return
            if opened < n:
                build(cur + "(", opened + 1, closed)
            if closed < opened:
                build(cur + ")", opened, closed + 1)
        build("", 0, 0)
        return out
