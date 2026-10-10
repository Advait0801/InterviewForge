type stamped struct {
	time  int
	value string
}

type TimeMap struct {
	store map[string][]stamped
}

func Constructor() TimeMap {
	return TimeMap{store: map[string][]stamped{}}
}

func (this *TimeMap) Set(key string, value string, timestamp int) {
	this.store[key] = append(this.store[key], stamped{timestamp, value})
}

func (this *TimeMap) Get(key string, timestamp int) string {
	list := this.store[key]
	i := sort.Search(len(list), func(i int) bool { return list[i].time > timestamp })
	if i == 0 {
		return ""
	}
	return list[i-1].value
}
