func groupAnagrams(strs []string) [][]string {
	groups := map[string][]string{}
	order := []string{}
	for _, s := range strs {
		b := []byte(s)
		sort.Slice(b, func(i, j int) bool { return b[i] < b[j] })
		key := string(b)
		if _, ok := groups[key]; !ok {
			order = append(order, key)
		}
		groups[key] = append(groups[key], s)
	}
	out := make([][]string, 0, len(order))
	for _, k := range order {
		out = append(out, groups[k])
	}
	return out
}
