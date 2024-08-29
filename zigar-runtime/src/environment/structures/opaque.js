import { getCompatibleTags } from '../../data-view.js';
import { AccessingOpaque, CreatingOpaque } from '../../error.js';
import { getDestructor, getMemoryCopier } from '../../memory.js';
import { convertToJSON, getDataViewDescriptor, getValueOf } from '../../special.js';
import { getIteratorIterator } from '../../struct.js';
import { ALIGN, COMPAT, COPIER, SIZE, TYPE } from '../../symbol.js';
import { mixin } from '../class.js';
import { StructureType } from './all.js';

mixin({
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
      dataView: getDataViewDescriptor(structure),
      valueOf: { value: getValueOf },
      toJSON: { value: convertToJSON },
      delete: { value: getDestructor(env) },
      [Symbol.iterator]: getIterator && { value: getIterator },
      [Symbol.toPrimitive]: { value: toPrimitive },
      [COPIER]: { value: getMemoryCopier(byteSize) },
    };
    const staticDescriptors = {
      [COMPAT]: { value: getCompatibleTags(structure) },
      [ALIGN]: { value: align },
      [SIZE]: { value: byteSize },
      [TYPE]: { value: structure.type },
    };
    this.attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
  },
});

export function isNeededByStructure(structure) {
  return structure.type === StructureType.Opaque;
}