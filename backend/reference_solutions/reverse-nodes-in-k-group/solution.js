var reverseKGroup = function (head, k) {
  const dummy = new ListNode(0, head);
  let groupPrev = dummy;
  for (;;) {
    let kth = groupPrev;
    for (let i = 0; i < k && kth; i++) kth = kth.next;
    if (!kth) break;
    const groupNext = kth.next;
    let prev = groupNext, cur = groupPrev.next;
    while (cur !== groupNext) [cur.next, prev, cur] = [prev, cur, cur.next];
    const first = groupPrev.next;
    groupPrev.next = kth;
    groupPrev = first;
  }
  return dummy.next;
};
