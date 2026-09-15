class Codec {
    // LeetCode's bracket format: "[1, 2, 3, null, null, 4, 5]". The test cases
    // pin the serialized string itself, not just the round trip.
    public String serialize(TreeNode root) {
        if (root == null) return "[]";
        List<String> out = new ArrayList<>();
        Deque<TreeNode> q = new LinkedList<>();
        q.add(root);
        while (!q.isEmpty()) {
            TreeNode node = q.poll();
            if (node == null) { out.add("null"); continue; }
            out.add(String.valueOf(node.val));
            q.add(node.left);
            q.add(node.right);
        }
        while (!out.isEmpty() && out.get(out.size() - 1).equals("null")) out.remove(out.size() - 1);
        return "[" + String.join(", ", out) + "]";
    }

    public TreeNode deserialize(String data) {
        String body = data.trim();
        body = body.substring(1, body.length() - 1).trim();
        if (body.isEmpty()) return null;
        String[] tokens = body.split(",");
        for (int i = 0; i < tokens.length; i++) tokens[i] = tokens[i].trim();
        TreeNode root = new TreeNode(Integer.parseInt(tokens[0]));
        Deque<TreeNode> q = new ArrayDeque<>();
        q.add(root);
        int i = 1;
        while (!q.isEmpty() && i < tokens.length) {
            TreeNode node = q.poll();
            if (i < tokens.length && !tokens[i].equals("null")) { node.left = new TreeNode(Integer.parseInt(tokens[i])); q.add(node.left); }
            i++;
            if (i < tokens.length && !tokens[i].equals("null")) { node.right = new TreeNode(Integer.parseInt(tokens[i])); q.add(node.right); }
            i++;
        }
        return root;
    }
}
