class Solution:
    def evalRPN(self, tokens: List[str]) -> int:
        stack = []
        for tok in tokens:
            if tok in ("+", "-", "*", "/"):
                b, a = stack.pop(), stack.pop()
                if tok == "+":
                    stack.append(a + b)
                elif tok == "-":
                    stack.append(a - b)
                elif tok == "*":
                    stack.append(a * b)
                else:
                    q = abs(a) // abs(b)
                    stack.append(q if (a < 0) == (b < 0) else -q)
            else:
                stack.append(int(tok))
        return stack[0]
