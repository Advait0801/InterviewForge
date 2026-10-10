type intHeap struct {
	data []int
	less func(a, b int) bool
}

func (h *intHeap) Len() int            { return len(h.data) }
func (h *intHeap) Less(i, j int) bool  { return h.less(h.data[i], h.data[j]) }
func (h *intHeap) Swap(i, j int)       { h.data[i], h.data[j] = h.data[j], h.data[i] }
func (h *intHeap) Push(x interface{}) { h.data = append(h.data, x.(int)) }
func (h *intHeap) Pop() interface{} {
	x := h.data[len(h.data)-1]
	h.data = h.data[:len(h.data)-1]
	return x
}

type MedianFinder struct {
	low, high *intHeap
}

func Constructor() MedianFinder {
	return MedianFinder{
		low:  &intHeap{less: func(a, b int) bool { return a > b }},
		high: &intHeap{less: func(a, b int) bool { return a < b }},
	}
}

func (this *MedianFinder) AddNum(num int) {
	heap.Push(this.low, num)
	heap.Push(this.high, heap.Pop(this.low))
	if this.high.Len() > this.low.Len() {
		heap.Push(this.low, heap.Pop(this.high))
	}
}

func (this *MedianFinder) FindMedian() float64 {
	if this.low.Len() > this.high.Len() {
		return float64(this.low.data[0])
	}
	return float64(this.low.data[0]+this.high.data[0]) / 2
}
