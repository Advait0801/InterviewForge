struct ListNode* removeNthFromEnd(struct ListNode* head, int n) {
    struct ListNode dummy = {0, head};
    struct ListNode* lead = &dummy, *trail = &dummy;
    for (int i = 0; i <= n; i++) lead = lead->next;
    while (lead) { lead = lead->next; trail = trail->next; }
    trail->next = trail->next->next;
    return dummy.next;
}
