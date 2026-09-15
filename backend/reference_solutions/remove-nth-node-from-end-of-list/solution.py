class Solution:
    def removeNthFromEnd(self, head: Optional[ListNode], n: int) -> Optional[ListNode]:
        dummy = ListNode(0, head)
        lead = trail = dummy
        for _ in range(n + 1):
            lead = lead.next
        while lead:
            lead, trail = lead.next, trail.next
        trail.next = trail.next.next
        return dummy.next
