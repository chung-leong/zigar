import { RELEASE_THUNK, SLOTS, CHILD_VIVIFICATOR, MEMORY } from '../../zigar-runtime/src/symbol.js';
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
import { initializeErrorSets } from '../../zigar-runtime/src/error-set.js';
import { throwZigError } from '../../zigar-runtime/src/error.js';
import { BaseEnvironment } from '../../zigar-runtime/src/environment.js';

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

class Environment extends BaseEnvironment {
  invokeFactory(thunk) {
    initializeErrorSets();
    const env = new Environment;
    const result = thunk.call(env);
    if (typeof(result) === 'string') {
      // an error message
      throwZigError(result);
    }
    let module = result.constructor;
    // attach __zigar object
    const initPromise = Promise.resolve();
    module.__zigar = {
      init: () => initPromise,
      abandon: () => initPromise.then(() => {
        if (module) {
          releaseModule(module);
        }
        module = null;
      }),
      released: () => initPromise.then(() => !module),
    };
    return module;
  }
}

function releaseModule(module) {
  const released = new Map();
  const replacement = function() {
    throw new Error(`Shared library was abandoned`);
  };
  const releaseClass = (cls) => {
    if (!cls || released.get(cls)) {
      return;
    }
    released.set(cls, true);
    // release static variables--vivificators return pointers
    const vivificators = cls[CHILD_VIVIFICATOR];
    if (vivificators) {
      for (const vivificator of Object.values(vivificators)) {
        const ptr = vivificator.call(cls);
        if (ptr) {
          releaseObject(ptr);
        }
      }
    }
    for (const [ name, { value, get, set }  ] of Object.entries(Object.getOwnPropertyDescriptors(cls))) {
      if (typeof(value) === 'function') {
        // release thunk of static function
        value[RELEASE_THUNK]?.(replacement);
      } else if (get && !set) {
        // the getter might return a type/class/constuctor
        const child = cls[name];
        if (typeof(child) === 'function') {
          releaseClass(child);
        }
      }
    }
    for (const [ name, { value } ] of Object.entries(Object.getOwnPropertyDescriptors(cls.prototype))) {
      if (typeof(value) === 'function') {
        // release thunk of instance function
        value[RELEASE_THUNK]?.(replacement);
      }
    }
  };
  const releaseObject = (obj) => {
    if (!obj || released.get(obj)) {
      return;
    }
    released.set(obj, true);
    const dv = obj[MEMORY];
    if (dv.buffer instanceof SharedArrayBuffer) {
      // create new buffer and copy content from shared memory
      const ta = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      const ta2 = new Uint8Array(ta);
      const dv2 = new DataView(ta2.buffer);
      obj[MEMORY] = dv2;
    }
    const slots = obj[SLOTS];
    if (slots) {
      // TODO: refactoring
      // for (const child of Object.values(slots)) {
      //   // deal with pointers in structs
      //   if (child.hasOwnProperty(ZIG)) {
      //     releaseObject(child);
      //   }
      // }
      // if (obj.hasOwnProperty(ZIG)) {
      //   // a pointer--release what it's pointing to
      //   releaseObject(obj[SLOTS][0]);
      // } else {
      //   // force recreation of child objects so they'll use non-shared memory
      //   obj[SLOTS] = {};
      // }
    }
  };
  releaseClass(module);
}

export { Environment };
