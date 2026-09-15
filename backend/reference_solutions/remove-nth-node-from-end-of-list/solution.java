class Solution {
    public ListNode removeNthFromEnd(ListNode head, int n) {
        ListNode dummy = new ListNode(0, head), lead = dummy, trail = dummy;
        for (int i = 0; i <= n; i++) lead = lead.next;
        while (lead != null) { lead = lead.next; trail = trail.next; }
        trail.next = trail.next.next;
        return dummy.next;
    }
}
