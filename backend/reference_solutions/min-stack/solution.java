class MinStack {
    private final Deque<int[]> items = new ArrayDeque<>();  // {value, minimum at push time}

    public MinStack() {}

    public void push(int val) {
        items.push(new int[]{val, items.isEmpty() ? val : Math.min(val, items.peek()[1])});
    }

    public void pop() { items.pop(); }

    public int top() { return items.peek()[0]; }

    public int getMin() { return items.peek()[1]; }
}
