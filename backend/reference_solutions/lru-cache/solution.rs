use std::collections::{BTreeMap, HashMap};

struct LRUCache {
    capacity: usize,
    tick: u64,
    items: HashMap<i32, (i32, u64)>, // key -> (value, last use)
    by_use: BTreeMap<u64, i32>,      // last use -> key
}

impl LRUCache {
    fn new(capacity: i32) -> Self {
        LRUCache { capacity: capacity as usize, tick: 0, items: HashMap::new(), by_use: BTreeMap::new() }
    }

    fn touch(&mut self, key: i32) {
        self.tick += 1;
        let entry = self.items.get_mut(&key).unwrap();
        self.by_use.remove(&entry.1);
        entry.1 = self.tick;
        self.by_use.insert(self.tick, key);
    }

    fn get(&mut self, key: i32) -> i32 {
        if !self.items.contains_key(&key) {
            return -1;
        }
        self.touch(key);
        self.items[&key].0
    }

    fn put(&mut self, key: i32, value: i32) {
        if let Some(entry) = self.items.get_mut(&key) {
            entry.0 = value;
            self.touch(key);
            return;
        }
        if self.items.len() == self.capacity {
            let (&oldest, &victim) = self.by_use.iter().next().unwrap();
            self.by_use.remove(&oldest);
            self.items.remove(&victim);
        }
        self.tick += 1;
        self.items.insert(key, (value, self.tick));
        self.by_use.insert(self.tick, key);
    }
}
