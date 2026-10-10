var mergeKLists = function (lists) {
  const vals = [];
  for (let node of lists) for (; node; node = node.next) vals.push(node.val);
  vals.sort((a, b) => a - b);
  const dummy = new ListNode();
  let tail = dummy;
  for (const v of vals) tail = tail.next = new ListNode(v);
  return dummy.next;
};
