type MinStack struct {
	vals, mins []int
}

func Constructor() MinStack {
	return MinStack{}
}

func (this *MinStack) Push(val int) {
	m := val
	if len(this.mins) > 0 {
		m = min(m, this.mins[len(this.mins)-1])
	}
	this.vals = append(this.vals, val)
	this.mins = append(this.mins, m)
}

func (this *MinStack) Pop() {
	this.vals = this.vals[:len(this.vals)-1]
	this.mins = this.mins[:len(this.mins)-1]
}

func (this *MinStack) Top() int {
	return this.vals[len(this.vals)-1]
}

func (this *MinStack) GetMin() int {
	return this.mins[len(this.mins)-1]
}
