func addTwoNumbers(l1 *ListNode, l2 *ListNode) *ListNode {
	dummy := &ListNode{}
	tail, carry := dummy, 0
	for l1 != nil || l2 != nil || carry > 0 {
		s := carry
		if l1 != nil {
			s += l1.Val
			l1 = l1.Next
		}
		if l2 != nil {
			s += l2.Val
			l2 = l2.Next
		}
		tail.Next = &ListNode{Val: s % 10}
		tail = tail.Next
		carry = s / 10
	}
	return dummy.Next
}
