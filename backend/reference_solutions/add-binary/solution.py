class Solution:
    def addBinary(self, a: str, b: str) -> str:
        i, j, carry, out = len(a) - 1, len(b) - 1, 0, []
        while i >= 0 or j >= 0 or carry:
            total = carry
            if i >= 0:
                total += ord(a[i]) - 48
                i -= 1
            if j >= 0:
                total += ord(b[j]) - 48
                j -= 1
            out.append(chr(48 + total % 2))
            carry = total // 2
        return "".join(reversed(out))
