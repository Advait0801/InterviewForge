class Solution:
    def calculate(self, s: str) -> int:
        total, number, sign, stack = 0, 0, 1, []
        for ch in s:
            if ch.isdigit():
                number = number * 10 + (ord(ch) - 48)
            elif ch in "+-":
                total += sign * number
                number, sign = 0, (1 if ch == "+" else -1)
            elif ch == "(":
                stack.append((total, sign))
                total, sign = 0, 1
            elif ch == ")":
                total += sign * number
                saved_total, saved_sign = stack.pop()
                total, number = saved_total + saved_sign * total, 0
        return total + sign * number
