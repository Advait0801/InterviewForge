#[derive(Default)]
struct Trie {
    children: [Option<Box<Trie>>; 26],
    end: bool,
}

impl Trie {
    fn new() -> Self {
        Default::default()
    }

    fn insert(&mut self, word: String) {
        let mut node = self;
        for b in word.bytes() {
            node = node.children[(b - b'a') as usize].get_or_insert_with(Default::default);
        }
        node.end = true;
    }

    fn find(&self, prefix: &str) -> Option<&Trie> {
        let mut node = self;
        for b in prefix.bytes() {
            node = node.children[(b - b'a') as usize].as_deref()?;
        }
        Some(node)
    }

    fn search(&mut self, word: String) -> bool {
        self.find(&word).map_or(false, |n| n.end)
    }

    fn starts_with(&mut self, prefix: String) -> bool {
        self.find(&prefix).is_some()
    }
}
