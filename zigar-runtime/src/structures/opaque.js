import { StructureFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { AccessingOpaque, CreatingOpaque } from '../errors.js';
import { getZigIterator } from '../iterators.js';
import { StructureType } from './constants.js';

export default mixin({
  defineOpaque(structure, descriptors) {
    const {
      flags,
    } = structure;
    const initializer = () => { throw new CreatingOpaque(structure) };
    const valueAccessor = () => { throw new AccessingOpaque(structure) };
    const constructor = this.createConstructor(structure);
    descriptors.$ = { get: valueAccessor, set: valueAccessor };
    descriptors[Symbol.iterator] = (flags & StructureFlag.IsIterator) && {
      value: getZigIterator
    };
    descriptors[Symbol.toPrimitive] = {
      value(hint) {
        const { name } = structure;
        return `[opaque ${name}]`;
      },
    };
    return constructor;
  },
});

export function isNeededByStructure(structure) {
  return structure.type === StructureType.Opaque;
}