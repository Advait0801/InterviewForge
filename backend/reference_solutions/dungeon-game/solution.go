func calculateMinimumHP(dungeon [][]int) int {
	rows, cols := len(dungeon), len(dungeon[0])
	need := make([]int, cols+1)
	for c := range need {
		need[c] = math.MaxInt
	}
	need[cols-1] = 1
	for r := rows - 1; r >= 0; r-- {
		next := make([]int, cols+1)
		next[cols] = math.MaxInt
		for c := cols - 1; c >= 0; c-- {
			next[c] = max(1, min(need[c], next[c+1])-dungeon[r][c])
		}
		need = next
	}
	return need[0]
}
