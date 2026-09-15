struct ListNode* reverseKGroup(struct ListNode* head, int k) {
    struct ListNode dummy = {0, head};
    struct ListNode* groupPrev = &dummy;
    while (1) {
        struct ListNode* kth = groupPrev;
        for (int i = 0; i < k && kth; i++) kth = kth->next;
        if (!kth) break;
        struct ListNode* groupNext = kth->next;
        struct ListNode* prev = groupNext, *cur = groupPrev->next;
        while (cur != groupNext) {
            struct ListNode* next = cur->next;
            cur->next = prev;
            prev = cur;
            cur = next;
        }
        struct ListNode* first = groupPrev->next;
        groupPrev->next = kth;
        groupPrev = first;
    }
    return dummy.next;
}
