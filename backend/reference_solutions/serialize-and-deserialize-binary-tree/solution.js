class Codec {
  // LeetCode's bracket format: "[1, 2, 3, null, null, 4, 5]", trailing nulls trimmed.
  serialize(root) {
    if (!root) return "[]";
    const out = [], queue = [root];
    for (let i = 0; i < queue.length; i++) {
      const node = queue[i];
      if (!node) { out.push("null"); continue; }
      out.push(String(node.val));
      queue.push(node.left, node.right);
    }
    while (out[out.length - 1] === "null") out.pop();
    return "[" + out.join(", ") + "]";
  }

  deserialize(data) {
    const body = data.trim().slice(1, -1).trim();
    if (!body) return null;
    const tokens = body.split(",").map((t) => t.trim());
    const root = new TreeNode(Number(tokens[0]));
    const queue = [root];
    let i = 1;
    for (let h = 0; h < queue.length && i < tokens.length; h++) {
      const node = queue[h];
      if (i < tokens.length && tokens[i] !== "null") queue.push((node.left = new TreeNode(Number(tokens[i]))));
      i++;
      if (i < tokens.length && tokens[i] !== "null") queue.push((node.right = new TreeNode(Number(tokens[i]))));
      i++;
    }
    return root;
  }
}
