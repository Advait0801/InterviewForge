type cell struct{ h, r, c int }
type cellHeap []cell

func (h cellHeap) Len() int            { return len(h) }
func (h cellHeap) Less(i, j int) bool  { return h[i].h < h[j].h }
func (h cellHeap) Swap(i, j int)       { h[i], h[j] = h[j], h[i] }
func (h *cellHeap) Push(x interface{}) { *h = append(*h, x.(cell)) }
func (h *cellHeap) Pop() interface{} {
	old := *h
	x := old[len(old)-1]
	*h = old[:len(old)-1]
	return x
}

func trapRainWater(heightMap [][]int) int {
	rows, cols := len(heightMap), len(heightMap[0])
	seen := make([][]bool, rows)
	for r := range seen {
		seen[r] = make([]bool, cols)
	}
	h := &cellHeap{}
	for r := 0; r < rows; r++ {
		for c := 0; c < cols; c++ {
			if r == 0 || c == 0 || r == rows-1 || c == cols-1 {
				heap.Push(h, cell{heightMap[r][c], r, c})
				seen[r][c] = true
			}
		}
	}
	water := 0
	for h.Len() > 0 {
		cur := heap.Pop(h).(cell)
		for _, d := range [][2]int{{1, 0}, {-1, 0}, {0, 1}, {0, -1}} {
			r, c := cur.r+d[0], cur.c+d[1]
			if r < 0 || r >= rows || c < 0 || c >= cols || seen[r][c] {
				continue
			}
			seen[r][c] = true
			water += max(0, cur.h-heightMap[r][c])
			heap.Push(h, cell{max(cur.h, heightMap[r][c]), r, c})
		}
	}
	return water
}
