import { StructurePurpose } from '../constants.js';
import { mixin } from '../environment.js';
import { AccessingOpaque, CreatingOpaque } from '../errors.js';
import { INITIALIZE } from '../symbols.js';
import { defineValue } from '../utils.js';

export default mixin({
  defineOpaque(structure, descriptors) {
    const {
      purpose,
    } = structure;
    const initializer = () => { throw new CreatingOpaque(structure) };
    const valueAccessor = () => { throw new AccessingOpaque(structure) };
    const constructor = this.createConstructor(structure);
    descriptors.$ = { get: valueAccessor, set: valueAccessor };
    descriptors[Symbol.iterator] = (purpose === StructurePurpose.Iterator) && this.defineZigIterator();
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
