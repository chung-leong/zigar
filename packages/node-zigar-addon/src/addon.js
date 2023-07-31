import { MEMORY, SLOTS } from '../../zigar-runtime/src/symbol.js';
import { invokeThunk } from '../../zigar-runtime/src/method.js';
import {
  useVoid,
  useBoolEx,
  useIntEx,
  useFloatEx,
  useEnumerationItemEx,
  useObject,
  useType,
} from '../../zigar-runtime/src/member.js';
import {
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
  useOpaque,
  useArgStruct,
} from '../../zigar-runtime/src/structure.js';

// enable all member types (including extend types)
useVoid();
useBoolEx();
useIntEx();
useFloatEx();
useEnumerationItemEx();
useObject();
useType();

// enable all structure types
usePrimitive();
useArray();
useStruct();
useExternUnion();
useBareUnion();
useTaggedUnion();
useErrorUnion();
useErrorSet();
useEnumeration();
useOptional();
usePointer();
useSlice();
useOpaque();
useArgStruct();

export function invokeFactory(thunk) {
  // our C++ code cannot call invokeThunk() directly since it doesn't have the symbol SLOTS
  // yet and therefore cannot create (or read from) the argument object
  const args = { [SLOTS]: {} };
  invokeThunk(thunk, args);
  return args[SLOTS][0].constructor;
}

export function getArgumentBuffers(args) {
  const buffers = [];
  const included = new WeakMap();
  const scanned = new WeakMap();
  const scan = (object) => {
    if (!object || scanned.get(object)) {
      return;
    }
    const memory = object[MEMORY];
    if (memory && memory.buffer[Symbol.toStringTag] === 'ArrayBuffer') {
      if (!included.get(memory.buffer)) {
        buffers.push(memory.buffer);
        included.set(memory.buffer, true);
      }
    }
    scanned.set(object, true);
    const slots = object[SLOTS];
    if (slots) {
      for (const child of Object.values(slots)) {
        scan(child);
      }
    }
  };
  scan(args);
  return buffers;
}

export {
  beginStructure,
  attachMember,
  attachMethod,
  attachTemplate,
  finalizeStructure,
} from '../../zigar-runtime/src/structure.js';

