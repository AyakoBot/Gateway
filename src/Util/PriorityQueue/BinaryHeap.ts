/**
 * Generic Binary Heap (Max-Heap by default)
 * O(log n) insertion and extraction
 */
export class BinaryHeap<T> {
 private heap: T[] = [];
 private comparator: (a: T, b: T) => number;

 /**
  * Creates a new binary heap
  * @param comparator Function that returns:
  *   - negative if a should come before b (higher priority)
  *   - positive if b should come before a (higher priority)
  *   - zero if equal priority
  */
 constructor(comparator: (a: T, b: T) => number) {
  this.comparator = comparator;
 }

 /**
  * Number of items in the heap
  */
 get size(): number {
  return this.heap.length;
 }

 /**
  * Check if heap is empty
  */
 get isEmpty(): boolean {
  return this.heap.length === 0;
 }

 /**
  * Insert an item into the heap
  * O(log n)
  */
 push(item: T): void {
  this.heap.push(item);
  this.bubbleUp(this.heap.length - 1);
 }

 /**
  * Remove and return the highest priority item
  * O(log n)
  */
 pop(): T | undefined {
  if (this.heap.length === 0) return undefined;
  if (this.heap.length === 1) return this.heap.pop();

  const [top] = this.heap;
  this.heap[0] = this.heap.pop()!;
  this.bubbleDown(0);
  return top;
 }

 /**
  * Peek at the highest priority item without removing it
  * O(1)
  */
 peek(): T | undefined {
  return this.heap[0];
 }

 /**
  * Clear all items from the heap
  */
 clear(): void {
  this.heap = [];
 }

 /**
  * Get all items (for debugging/inspection)
  */
 toArray(): T[] {
  return [...this.heap];
 }

 /**
  * Remove an item that matches the predicate
  * O(n) - use sparingly
  */
 remove(predicate: (item: T) => boolean): T | undefined {
  const index = this.heap.findIndex(predicate);
  if (index === -1) return undefined;

  const item = this.heap[index];
  if (index === this.heap.length - 1) {
   this.heap.pop();
  } else {
   this.heap[index] = this.heap.pop()!;
   // May need to bubble up or down depending on new item
   const parent = Math.floor((index - 1) / 2);
   if (index > 0 && this.comparator(this.heap[index], this.heap[parent]) < 0) {
    this.bubbleUp(index);
   } else {
    this.bubbleDown(index);
   }
  }
  return item;
 }

 /**
  * Check if an item matching predicate exists
  * O(n)
  */
 has(predicate: (item: T) => boolean): boolean {
  return this.heap.some(predicate);
 }

 /**
  * Move item up the heap until heap property is satisfied
  */
 private bubbleUp(index: number): void {
  while (index > 0) {
   const parent = Math.floor((index - 1) / 2);
   if (this.comparator(this.heap[index], this.heap[parent]) >= 0) break;

   [this.heap[index], this.heap[parent]] = [this.heap[parent], this.heap[index]];
   index = parent;
  }
 }

 /**
  * Move item down the heap until heap property is satisfied
  */
 private bubbleDown(index: number): void {
  const { length } = this.heap;

  while (true) {
   const left = 2 * index + 1;
   const right = 2 * index + 2;
   let smallest = index;

   if (left < length && this.comparator(this.heap[left], this.heap[smallest]) < 0) {
    smallest = left;
   }
   if (right < length && this.comparator(this.heap[right], this.heap[smallest]) < 0) {
    smallest = right;
   }

   if (smallest === index) break;

   [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
   index = smallest;
  }
 }
}
