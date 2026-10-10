type entry struct {
	key, value int
}

type LRUCache struct {
	capacity int
	order    *list.List // front = most recent
	items    map[int]*list.Element
}

func Constructor(capacity int) LRUCache {
	return LRUCache{capacity: capacity, order: list.New(), items: map[int]*list.Element{}}
}

func (this *LRUCache) Get(key int) int {
	el, ok := this.items[key]
	if !ok {
		return -1
	}
	this.order.MoveToFront(el)
	return el.Value.(*entry).value
}

func (this *LRUCache) Put(key int, value int) {
	if el, ok := this.items[key]; ok {
		el.Value.(*entry).value = value
		this.order.MoveToFront(el)
		return
	}
	this.items[key] = this.order.PushFront(&entry{key, value})
	if this.order.Len() > this.capacity {
		last := this.order.Back()
		this.order.Remove(last)
		delete(this.items, last.Value.(*entry).key)
	}
}
