import { WebAssemblyEnvironment } from './environment-wasm.js';
/* COMPTIME-ONLY */
import { useAllMemberTypes } from './member.js';
import { useAllStructureTypes } from './structure.js';

useAllMemberTypes();
useAllStructureTypes();
/* COMPTIME-ONLY-END */

export async function loadModule(source) {
  const env = new WebAssemblyEnvironment();
  if (source) {
    await env.loadModule(source);
  }
  return env;
}

/* RUNTIME-ONLY */
export {
  usePrimitive,
  useArray,
  useStruct,
  useExternUnion,
  useBareUnion,
  useTaggedUnion,
  useErrorUnion,
  useErrorSet,
  useEnumeration,
  useOptional,
  usePointer,
  useSlice,
  useVector,
  useOpaque,
  useArgStruct,
} from './structure.js';
export {
  useVoid,
  useBool,
  useBoolEx,
  useInt,
  useIntEx,
  useUint,
  useUintEx,
  useFloat,
  useFloatEx,
  useEnumerationItem,
  useEnumerationItemEx,
  useError,
  useObject,
  useType,
  useComptime,
  useStatic,
  useLiteral,
} from './member.js';
/* RUNTIME-ONLY-END */