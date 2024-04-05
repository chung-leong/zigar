import { useAllExtendedTypes } from './data-view.js';
import { WebAssemblyEnvironment } from './environment-wasm.js';
/* COMPTIME-ONLY */
import { useAllMemberTypes } from './member.js';
import { useAllStructureTypes } from './structure.js';

useAllMemberTypes();
useAllStructureTypes();
useAllExtendedTypes();
/* COMPTIME-ONLY-END */

export function createEnvironment(source) {
  return new WebAssemblyEnvironment();
}

/* RUNTIME-ONLY */
export {
  useExtendedBool, useExtendedFloat, useExtendedInt, useExtendedUint
} from './data-view.js';
export {
  useBool, useComptime, useEnumerationItem, useError, useFloat, useInt, useLiteral, useNull,
  useObject, useStatic, useType, useUint, useUndefined, useVoid
} from './member.js';
export {
  useArgStruct, useArray, useBareUnion, useEnumeration, useErrorSet, useErrorUnion,
  useExternStruct, useExternUnion, useOpaque, useOptional, usePackedStruct, usePointer,
  usePrimitive, useSlice, useStruct, useTaggedUnion, useVector
} from './structure.js';
/* RUNTIME-ONLY-END */