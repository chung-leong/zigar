import { useState } from "react";

export function isPromise(arg) {
  return typeof(arg?.then) === 'function';
}

export function usePagination(cb, count = 20) {
  const [ objects, setObjects ] = useState(() => {
    const { hash } = window.location;
    const initialCount = /^#\d+$/.test(hash) ? parseInt(hash.slice(1)) : count;
    return cb(0, initialCount)
  });
  const more = async () => {
    const existing = await objects;
    const extra = await cb(existing.length, count);
    if (extra.length > 0) {
      const list = [ ...existing, ...extra ];
      setObjects(list);
      const url = new URL(window.location);
      url.hash = `#${list.length}`;
      window.history.replaceState({}, '', url);
    }
  };
  return [ objects, more ];
}

export function parseRoute(location, forward = false) {
  const url = new URL(location);
  const parts = url.pathname.split('/').filter(p => !!p);
  const params = {};
  for (const [ name, value ] of url.searchParams) {
    params[name] = value;
  }
  return { parts, params, forward };
}
