class Trie {
  constructor() {
    this.root = {};
  }

  insert(word) {
    let node = this.root;
    for (const c of word) node = node[c] || (node[c] = {});
    node.end = true;
  }

  find(prefix) {
    let node = this.root;
    for (const c of prefix) {
      node = node[c];
      if (!node) return null;
    }
    return node;
  }

  search(word) {
    const node = this.find(word);
    return Boolean(node && node.end);
  }

  startsWith(prefix) {
    return this.find(prefix) !== null;
  }
}
