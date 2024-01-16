import { WebAssemblyEnvironment } from './environment-wasm.js';
/* COMPTIME-ONLY */
import { useAllMemberTypes } from './member.js';
import { useAllStructureTypes } from './structure.js';

useAllMemberTypes();
useAllStructureTypes();
/* COMPTIME-ONLY-END */

export function createEnvironment(source) {
  return new WebAssemblyEnvironment();
}

/* RUNTIME-ONLY */
export {
  useBool, useBoolEx, useComptime, useEnumerationItem, useError, useFloat, useFloatEx, useInt,
  useIntEx, useLiteral, useNull, useObject, useStatic, useType, useUint, useUintEx, useUndefined,
  useVoid
} from './member.js';
export {
  useArgStruct, useArray, useBareUnion, useEnumeration, useErrorSet, useErrorUnion,
  useExternUnion, useOpaque, useOptional, usePointer, usePrimitive, useSlice, useStruct,
  useTaggedUnion, useVector
} from './structure.js';
/* RUNTIME-ONLY-END */