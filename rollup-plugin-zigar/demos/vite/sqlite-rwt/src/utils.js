import { useState } from "react";

export function isPromise(arg) {
  return typeof(arg?.then) === 'function';
}

export function usePagination(cb, count = 20) {
  const [ objects, setObjects ] = useState(() => cb(0, count));
  const more = async () => {
    const existing = await objects;
    const extra = await cb(existing.length, count);
    if (extra.length > 0) {
      setObjects([ ...existing, ...extra ]);
    }
  };
  return [ objects, more ];
}

export function parseRoute(location) {
  const url = new URL(location);
  const parts = url.pathname.split('/').filter(p => !!p);
  const query = {};
  for (const [ name, value ] of url.searchParams) {
    query[name] = value;
  }
  return { parts, query };
}
