use std::collections::{BTreeMap, HashMap};

struct LFUCache {
    capacity: usize,
    tick: u64,
    items: HashMap<i32, (i32, u32, u64)>, // key -> (value, uses, last use)
    order: BTreeMap<(u32, u64), i32>,     // (uses, last use) -> key; first = next to evict
}

impl LFUCache {
    fn new(capacity: i32) -> Self {
        LFUCache { capacity: capacity as usize, tick: 0, items: HashMap::new(), order: BTreeMap::new() }
    }

    fn touch(&mut self, key: i32) {
        self.tick += 1;
        let e = self.items.get_mut(&key).unwrap();
        self.order.remove(&(e.1, e.2));
        e.1 += 1;
        e.2 = self.tick;
        self.order.insert((e.1, e.2), key);
    }

    fn get(&mut self, key: i32) -> i32 {
        if !self.items.contains_key(&key) {
            return -1;
        }
        self.touch(key);
        self.items[&key].0
    }

    fn put(&mut self, key: i32, value: i32) {
        if self.capacity == 0 {
            return;
        }
        if let Some(e) = self.items.get_mut(&key) {
            e.0 = value;
            self.touch(key);
            return;
        }
        if self.items.len() == self.capacity {
            let (&slot, &victim) = self.order.iter().next().unwrap();
            self.order.remove(&slot);
            self.items.remove(&victim);
        }
        self.tick += 1;
        self.items.insert(key, (value, 1, self.tick));
        self.order.insert((1, self.tick), key);
    }
}
