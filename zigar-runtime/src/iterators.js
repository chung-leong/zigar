import { PROPS, SELF } from './symbols.js';

export function getZigIterator() {
  const self = this;
  return {
    next() {
      const value = self.next();
      const done = value === null;
      return { value, done };
    },
  };
}

export function getStructEntries(options) {
  return {
    [Symbol.iterator]: getStructEntriesIterator.bind(this, options),
    length: this[PROPS].length,
  };
}

export function getStructIterator(options) {
  const entries = getStructEntries.call(this, options);
  return entries[Symbol.iterator]();
}

export function getStructEntriesIterator(options) {
  const handleError = getErrorHandler(options);
  const self = this;
  const props = this[PROPS];
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < props.length) {
        const current = props[index++];
        value = [ current, handleError(() => self[current]) ];
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

export function getArrayIterator() {
  const self = this[SELF] ?? this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        const current = index++;
        value = self.get(current);
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

export function getArrayEntriesIterator(options) {
  const handleError = getErrorHandler(options);
  const self = this[SELF] ?? this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        const current = index++;
        value = [ current, handleError(() => self.get(current)) ];
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

export function getArrayEntries(options) {
  return {
    [Symbol.iterator]: getArrayEntriesIterator.bind(this, options),
    length: this.length,
  };
}

export function getVectorIterator() {
  const self = this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        const current = index++;
        value = self[current];
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

export function getVectorEntriesIterator() {
  const self = this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        const current = index++;
        value = [ current, self[current] ];
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

export function getVectorEntries() {
  return {
    [Symbol.iterator]: getVectorEntriesIterator.bind(this),
    length: this.length,
  };
}

export function getUnionEntries(options) {
  return {
    [Symbol.iterator]: getUnionEntriesIterator.bind(this, options),
    length: this[PROPS].length,
  };
}

export function getUnionIterator(options) {
  const entries = getUnionEntries.call(this, options);
  return entries[Symbol.iterator]();
}

export function getUnionEntriesIterator(options) {
  const handleError = getErrorHandler(options);
  const self = this;
  const props = this[PROPS];
  const getters = this[GETTERS];
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < props.length) {
        const current = props[index++];
        // get value of prop with no check
        value = [ current, handleError(() => getters[current].call(self)) ];
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

export function getErrorHandler(options) {
  return (options?.error === 'return')
  ? (cb) => {
      try {
        return cb();
      } catch (err) {
        return err;
      }
    }
  : (cb) => cb();
}