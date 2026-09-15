class Solution:
    def floodFill(self, image: List[List[int]], sr: int, sc: int, color: int) -> List[List[int]]:
        start = image[sr][sc]
        if start == color:
            return image
        stack = [(sr, sc)]
        while stack:
            r, c = stack.pop()
            if 0 <= r < len(image) and 0 <= c < len(image[0]) and image[r][c] == start:
                image[r][c] = color
                stack.extend([(r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)])
        return image
