struct ListNode* addTwoNumbers(struct ListNode* l1, struct ListNode* l2) {
    struct ListNode dummy = {0, NULL};
    struct ListNode* tail = &dummy;
    int carry = 0;
    while (l1 || l2 || carry) {
        int total = carry + (l1 ? l1->val : 0) + (l2 ? l2->val : 0);
        struct ListNode* node = (struct ListNode*)malloc(sizeof(struct ListNode));
        node->val = total % 10;
        node->next = NULL;
        carry = total / 10;
        tail->next = node;
        tail = node;
        if (l1) l1 = l1->next;
        if (l2) l2 = l2->next;
    }
    return dummy.next;
}
