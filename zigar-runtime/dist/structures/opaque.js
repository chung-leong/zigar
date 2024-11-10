import { OpaqueFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { CreatingOpaque, AccessingOpaque } from '../errors.js';
import { getZigIterator } from '../iterators.js';
import { INITIALIZE } from '../symbols.js';
import { defineValue } from '../utils.js';

var opaque = mixin({
  defineOpaque(structure, descriptors) {
    const {
      flags,
    } = structure;
    const initializer = () => { throw new CreatingOpaque(structure) };
    const valueAccessor = () => { throw new AccessingOpaque(structure) };
    const constructor = this.createConstructor(structure);
    descriptors.$ = { get: valueAccessor, set: valueAccessor };
    descriptors[Symbol.iterator] = (flags & OpaqueFlag.IsIterator) && {
      value: getZigIterator
    };
    descriptors[Symbol.toPrimitive] = {
      value(hint) {
        const { name } = structure;
        return `[opaque ${name}]`;
      },
    };
    descriptors[INITIALIZE] = defineValue(initializer);
    return constructor;
  },
});

export { opaque as default };
