export function addJSONHandlers(s) {
  const {
    constructor
  } = s;
  Object.defineProperties(constructor.prototype, {
    toJSON: { value: getValueOf, configurable: true, writable: true },
    valueOf: { value: getValueOf, configurable: true, writable: true },
  })
}

export function getValueOf() {
  const map = new WeakMap();
  function extract(object) {
    let f;
    if (object[Symbol.iterator]) {
      const array = [];
      for (const element of object) {
        array.push(extract(element));
      }
      return array;
    } else if (object && typeof(object) === 'object') {
      let result = map.get(object);
      if (!result) {
        result = {};
        map.set(object, result);
        for (const [ name, child ] of Object.entries(object)) {
          result[name] = extract(child);
        }
        return result;
      }
      return result;
    } else {
      return object;
    }
  };
  return extract(this.$);
}

