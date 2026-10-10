var findWords = function (board, words) {
  const root = {};
  for (const w of words) {
    let node = root;
    for (const c of w) node = node[c] || (node[c] = {});
    node.word = w;
  }
  const rows = board.length, cols = board[0].length, found = [];
  const dfs = (r, c, parent) => {
    const ch = board[r][c];
    const node = parent[ch];
    if (!node) return;
    if (node.word !== undefined) {
      found.push(node.word);
      delete node.word;
    }
    board[r][c] = "#";
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc] !== "#") dfs(nr, nc, node);
    }
    board[r][c] = ch;
  };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) dfs(r, c, root);
  return found;
};
