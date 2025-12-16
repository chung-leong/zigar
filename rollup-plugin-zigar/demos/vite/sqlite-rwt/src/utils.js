export function isPromise(arg) {
  return typeof(arg?.then) === 'function';
}

export function split(arg) {
  if (!arg) return [];
  return arg.split(',');
}
