// Returns a new array with the element at `from` moved to index `to`.
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const result = [...items];
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved);
  return result;
}
