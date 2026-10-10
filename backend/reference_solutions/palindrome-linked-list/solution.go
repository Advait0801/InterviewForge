func isPalindrome(head *ListNode) bool {
	vals := []int{}
	for ; head != nil; head = head.Next {
		vals = append(vals, head.Val)
	}
	for i, j := 0, len(vals)-1; i < j; i, j = i+1, j-1 {
		if vals[i] != vals[j] {
			return false
		}
	}
	return true
}
