export function renderSearch(container, session, dbName, onDone) {
  onDone(session);
}
export function _filterConcepts(concepts, query) {
  if (!query) return concepts;
  const q = query.toLowerCase();
  return concepts.filter((c) => c.name.toLowerCase().includes(q));
}
