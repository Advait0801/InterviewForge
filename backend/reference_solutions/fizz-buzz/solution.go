func fizzBuzz(n int) []string {
	out := make([]string, n)
	for i := 1; i <= n; i++ {
		switch {
		case i%15 == 0:
			out[i-1] = "FizzBuzz"
		case i%3 == 0:
			out[i-1] = "Fizz"
		case i%5 == 0:
			out[i-1] = "Buzz"
		default:
			out[i-1] = strconv.Itoa(i)
		}
	}
	return out
}
