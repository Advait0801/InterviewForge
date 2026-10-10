func addBinary(a string, b string) string {
	i, j, carry := len(a)-1, len(b)-1, 0
	out := []byte{}
	for i >= 0 || j >= 0 || carry > 0 {
		s := carry
		if i >= 0 {
			s += int(a[i] - '0')
			i--
		}
		if j >= 0 {
			s += int(b[j] - '0')
			j--
		}
		out = append(out, byte('0'+s%2))
		carry = s / 2
	}
	for l, r := 0, len(out)-1; l < r; l, r = l+1, r-1 {
		out[l], out[r] = out[r], out[l]
	}
	return string(out)
}
