func canCompleteCircuit(gas []int, cost []int) int {
	total, tank, start := 0, 0, 0
	for i := range gas {
		total += gas[i] - cost[i]
		tank += gas[i] - cost[i]
		if tank < 0 {
			start, tank = i+1, 0
		}
	}
	if total < 0 {
		return -1
	}
	return start
}
