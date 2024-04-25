import { getCompatibleTags } from './data-view.js';
import { AccessingOpaque, CreatingOpaque } from './error.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { attachDescriptors, createConstructor } from './object.js';
import { convertToJSON, getDataViewDescriptor, getValueOf } from './special.js';
import { ALIGN, COMPAT, COPIER, SIZE, TYPE } from './symbol.js';

export function defineOpaque(structure, env) {
  const {
    byteSize,
    align,
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
  const constructor = structure.constructor = createConstructor(structure, { initializer }, env);
  const instanceDescriptors = {
    $: { get: valueAccessor, set: valueAccessor },
    dataView: getDataViewDescriptor(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    [Symbol.toPrimitive]: { value: toPrimitive },
    [COPIER]: { value: getMemoryCopier(byteSize) },
  };
  const staticDescriptors = {
    [COMPAT]: { value: getCompatibleTags(structure) },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [TYPE]: { value: structure.type },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
};
