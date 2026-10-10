type lfuEntry struct {
	key, value, freq int
}

type LFUCache struct {
	capacity, minFreq int
	items             map[int]*list.Element
	byFreq            map[int]*list.List // front = most recent
}

func Constructor(capacity int) LFUCache {
	return LFUCache{capacity: capacity, items: map[int]*list.Element{}, byFreq: map[int]*list.List{}}
}

func (this *LFUCache) bucket(f int) *list.List {
	if this.byFreq[f] == nil {
		this.byFreq[f] = list.New()
	}
	return this.byFreq[f]
}

func (this *LFUCache) touch(el *list.Element) *list.Element {
	e := el.Value.(*lfuEntry)
	old := this.byFreq[e.freq]
	old.Remove(el)
	if old.Len() == 0 {
		delete(this.byFreq, e.freq)
		if this.minFreq == e.freq {
			this.minFreq++
		}
	}
	e.freq++
	moved := this.bucket(e.freq).PushFront(e)
	this.items[e.key] = moved
	return moved
}

func (this *LFUCache) Get(key int) int {
	el, ok := this.items[key]
	if !ok {
		return -1
	}
	return this.touch(el).Value.(*lfuEntry).value
}

func (this *LFUCache) Put(key int, value int) {
	if this.capacity <= 0 {
		return
	}
	if el, ok := this.items[key]; ok {
		el.Value.(*lfuEntry).value = value
		this.touch(el)
		return
	}
	if len(this.items) >= this.capacity {
		bucket := this.byFreq[this.minFreq]
		last := bucket.Back()
		bucket.Remove(last)
		if bucket.Len() == 0 {
			delete(this.byFreq, this.minFreq)
		}
		delete(this.items, last.Value.(*lfuEntry).key)
	}
	this.items[key] = this.bucket(1).PushFront(&lfuEntry{key, value, 1})
	this.minFreq = 1
}
