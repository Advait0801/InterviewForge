class Trie {
    private static class Node {
        Node[] child = new Node[26];
        boolean end;
    }

    private final Node root = new Node();

    public Trie() {}

    public void insert(String word) {
        Node node = root;
        for (char c : word.toCharArray()) {
            if (node.child[c - 'a'] == null) node.child[c - 'a'] = new Node();
            node = node.child[c - 'a'];
        }
        node.end = true;
    }

    private Node walk(String s) {
        Node node = root;
        for (char c : s.toCharArray()) {
            node = node.child[c - 'a'];
            if (node == null) return null;
        }
        return node;
    }

    public boolean search(String word) {
        Node node = walk(word);
        return node != null && node.end;
    }

    public boolean startsWith(String prefix) {
        return walk(prefix) != null;
    }
}
