impl Solution {
    pub fn can_complete_circuit(gas: Vec<i32>, cost: Vec<i32>) -> i32 {
        let (mut total, mut tank, mut start) = (0, 0, 0);
        for i in 0..gas.len() {
            total += gas[i] - cost[i];
            tank += gas[i] - cost[i];
            if tank < 0 {
                start = i + 1;
                tank = 0;
            }
        }
        if total < 0 { -1 } else { start as i32 }
    }
}
