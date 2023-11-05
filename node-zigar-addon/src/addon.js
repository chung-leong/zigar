import {
  useVoid,
  useBoolEx,
  useIntEx,
  useUintEx,
  useFloatEx,
  useEnumerationItemEx,
  useObject,
  useType,
} from '../../zigar-runtime/src/member.js';
import {
  usePrimitive,
  useArray,
  useStruct,
  useArgStruct,
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
} from '../../zigar-runtime/src/structure.js';

// enable all member types (including extend types)
useVoid();
useBoolEx();
useIntEx();
useUintEx();
useFloatEx();
useEnumerationItemEx();
useObject();
useType();

// enable all structure types
usePrimitive();
useArray();
useStruct();
useArgStruct();
useExternUnion();
useBareUnion();
useTaggedUnion();
useErrorUnion();
useErrorSet();
useEnumeration();
useOptional();
usePointer();
useSlice();
useVector();
useOpaque();

export { NodeEnvironment } from '../../zigar-runtime/src/environment.js';
