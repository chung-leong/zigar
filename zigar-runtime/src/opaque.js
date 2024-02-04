import { getCompatibleTags } from './data-view.js';
import { throwAccessingOpaque, throwCreatingOpaque } from './error.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { convertToJSON, getDataViewDescriptor, getValueOf } from './special.js';
import { attachDescriptors, createConstructor } from './structure.js';
import { ALIGN, COMPAT, COPIER, NORMALIZER, SIZE } from './symbol.js';

export function defineOpaque(structure, env) {
  const {
    byteSize,
    align,
  } = structure;
  const initializer = function() {
    throwCreatingOpaque(structure);
  };
  const valueAccessor = function() {
    throwAccessingOpaque(structure);
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
    [NORMALIZER]: { value: normalizeOpaque },
  };
  const staticDescriptors = {
    [COMPAT]: { value: getCompatibleTags(structure) },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
};

function normalizeOpaque(map, forJSON) {
  return {};
}