import { mixin } from '../environment.js';
import { defineProperty, defineValue, getTypeName } from '../utils.js';

// handle retrieval of accessors

export default mixin({
  getAccessor(access, member) {
    const { bitOffset, byteSize } = member;
    const typeName = getTypeName(member)
    const accessorName = access + typeName + ((byteSize === undefined) ? `${bitOffset}` : '');
    // see if it's a built-in method of DataView
    let accessor = DataView.prototype[accessorName];
    if (accessor) {
      return accessor;
    }
    // check cache
    accessor = cache.get(accessorName);
    if (accessor) {
      return accessor;
    }
    accessor = this[`getAccessor${typeName}`]?.(access, member)
            ?? this[`getAccessor${typeName.replace(/\d+/, '') || '*'}`]?.(access, member)
            ?? this[`getAccessor${typeName.replace(/^\D+\d+/, '') || '*'}`]?.(access, member);
    /* c8 ignore start */
    if (!accessor) {
      throw new Error(`No accessor available: ${typeName}`);
    }
    /* c8 ignore end */
    defineProperty(accessor, 'name', defineValue(accessorName));
    cache.set(accessorName, accessor);
    return accessor;
  },
});

const cache = new Map();
