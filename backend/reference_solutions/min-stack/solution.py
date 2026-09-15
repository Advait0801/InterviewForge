class MinStack:

    def __init__(self):
        self.items = []  # (value, minimum at the time it was pushed)

    def push(self, val: int) -> None:
        self.items.append((val, min(val, self.items[-1][1]) if self.items else val))

    def pop(self) -> None:
        self.items.pop()

    def top(self) -> int:
        return self.items[-1][0]

    def getMin(self) -> int:
        return self.items[-1][1]
