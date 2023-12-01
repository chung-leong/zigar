/* COMPTIME-ONLY */
import { useAllMemberTypes } from './member.js';
import { useAllStructureTypes } from './structure.js';
import { WebAssemblyEnvironment } from './environment.js';

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
  useObject,
  useType,
  useComptime,
  useStatic,
  useLiteral,
} from './member.js';
/* RUNTIME-ONLY-END */