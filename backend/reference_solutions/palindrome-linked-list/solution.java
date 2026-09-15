class Solution {
    public boolean isPalindrome(ListNode head) {
        ListNode slow = head, fast = head, prev = null;
        while (fast != null && fast.next != null) { slow = slow.next; fast = fast.next.next; }
        while (slow != null) { ListNode next = slow.next; slow.next = prev; prev = slow; slow = next; }
        for (; prev != null; prev = prev.next, head = head.next) if (prev.val != head.val) return false;
        return true;
    }
}
