class Solution {
public:
    ListNode* addTwoNumbers(ListNode* l1, ListNode* l2) {
        ListNode dummy(0);
        ListNode* tail = &dummy;
        int carry = 0;
        while (l1 || l2 || carry) {
            int total = carry + (l1 ? l1->val : 0) + (l2 ? l2->val : 0);
            tail->next = new ListNode(total % 10);
            tail = tail->next;
            carry = total / 10;
            if (l1) l1 = l1->next;
            if (l2) l2 = l2->next;
        }
        return dummy.next;
    }
};
