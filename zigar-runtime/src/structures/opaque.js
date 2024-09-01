import { mixin } from '../environment.js';
import { AccessingOpaque, CreatingOpaque } from '../errors.js';
import { getIteratorIterator } from '../struct.js';
import { StructureType } from './all.js';

export default mixin({
  defineOpaque(structure) {
    const {
      byteSize,
      align,
      isIterator,
    } = structure;
    const initializer = function() {
      throw new CreatingOpaque(structure);
    };
    const valueAccessor = function() {
      throw new AccessingOpaque(structure);
    };
    const toPrimitive = function(hint) {
      const { name } = structure;
      return `[opaque ${name}]`;
    };
    const constructor = structure.constructor = this.createConstructor(structure, { initializer });
    const getIterator = (isIterator) ? getIteratorIterator : null;
    const instanceDescriptors = {
      $: { get: valueAccessor, set: valueAccessor },
      [Symbol.iterator]: getIterator && { value: getIterator },
      [Symbol.toPrimitive]: { value: toPrimitive },
    };
    const staticDescriptors = {};
    return this.attachDescriptors(structure, instanceDescriptors, staticDescriptors);
  },
});

export function isNeededByStructure(structure) {
  return structure.type === StructureType.Opaque;
}