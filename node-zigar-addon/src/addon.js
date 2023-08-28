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
import {
  initializeErrorSets,
} from '../../zigar-runtime/src/error-set.js';

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

export function invokeFactory(thunk) {
  initializeErrorSets();
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

const decoder = new TextDecoder();
let consolePending = '', consoleTimeout = 0;

export function writeToConsole(buffer) {
  try {
    const ta = new Uint8Array(buffer);
    const s = decoder.decode(ta);
    // send text up to the last newline character
    const index = s.lastIndexOf('\n');
    if (index === -1) {
      consolePending += s;
    } else {
      console.log(consolePending + s.substring(0, index));
      consolePending = s.substring(index + 1);
    }
    clearTimeout(consoleTimeout);
    if (consolePending) {
      consoleTimeout = setTimeout(() => {
        console.log(consolePending);
        consolePending = '';
      }, 250);
    }
  } catch (err) {
    console.error(err);
  }
}

export function flushConsole() {
  if (consolePending) {
    console.log(consolePending);
    consolePending = '';
    clearTimeout(consoleTimeout);
  }
}

export {
  beginStructure,
  attachMember,
  attachMethod,
  attachTemplate,
  finalizeStructure,
} from '../../zigar-runtime/src/structure.js';

