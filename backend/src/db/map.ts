/** Mongo document with UUID stored in `_id`. */
export type MongoDoc<T extends { id: string }> = Omit<T, 'id'> & { _id: string };

export function toDoc<T extends { id: string }>(entity: T): MongoDoc<T> {
  const { id, ...rest } = entity;
  return { _id: id, ...(rest as Omit<T, 'id'>) };
}

export function fromDoc<T extends { id: string }>(doc: unknown): T | null {
  if (!doc || typeof doc !== 'object') return null;
  const record = doc as Record<string, unknown>;
  if (typeof record._id !== 'string') return null;
  const { _id, ...rest } = record;
  return { id: _id, ...rest } as T;
}

export function fromDocs<T extends { id: string }>(docs: unknown[]): T[] {
  return docs
    .map((doc) => fromDoc<T>(doc))
    .filter((item): item is T => item !== null);
}
