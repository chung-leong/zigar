import { MEMORY, SLOTS } from './symbol.js';
import { throwZigError } from './error.js';
import { WebAssemblyEnvironment } from './environment.js';

function createWebAssemblyInstance(source, env) {
  if (source[Symbol.toStringTag] === 'Response') {
    return WebAssembly.instantiateStreaming(source, { env });
  } else {
    return WebAssembly.instantiate(source, { env });
  }
}

export async function runFactoryFunction(source) {
  const env = new WebAssemblyEnvironment();
  const imports = env.createImports();
  const instance = await createWebAssemblyInstance(source, imports);
  const { define, safe } = instance.exports;
  const runtimeSafety = !!safe();
  const runDefine = env.createBridge(define, '', 'v', true)
  const result = runDefine();
  if (typeof(result) === 'string') {
    throwZigError(result);
  }
  const { structures } = env;
  fixOverlappingMemory(structures);
  return { structures, runtimeSafety };
}

export async function linkModule(sourcePromise, params = {}) {
  const {
    resolve,
    reject,
    promise,
    variables,
    methodRunner,
    writeBack = true,
  } = params;
  try {
    const source = await sourcePromise;
    const { imports, clearTables } = createImports(env);
    const instance = await createWebAssemblyInstance(source, imports);

    // link variables
    for (const { address, object } of variables) {
      linkObject(object, Number(address));
    }
    // link methods
    methodRunner[0] = function(thunkIndex, argStruct) {
      const argIndex = addObject(argStruct);
      const errorIndex = run(argIndex, thunkIndex);
      if (errorIndex !== 0) {
        throwError(errorIndex);
      }
    };
    const weakRef = new WeakRef(instance);
    const abandon = () => {
      instance = null;
      run = function() {
        throw new Error('WebAssembly instance was abandoned');
      };
      for (const { object } of variables) {
        unlinkObject(object);
      }
    };
    const released = () => {
      return !weakRef.deref();
    };
    resolve({ abandon, released });
  } catch (err) {
    reject(err);
  }
  return promise;
}


function fixOverlappingMemory(structures) {
  // look for buffers that requires linkage
  const list = [];
  const find = (object) => {
    if (!object) {
      return;
    }
    if (object[MEMORY]) {
      const dv = object[MEMORY];
      const { address } = dv;
      if (address) {
        list.push({ address, length: dv.byteLength, owner: object, replaced: false });
      }
    }
    if (object[SLOTS]) {
      for (const child of Object.values(object[SLOTS])) {
        find(child);
      }
    }
  };
  for (const structure of structures) {
    find(structure.instance.template);
    find(structure.static.template);
  }
  // larger memory blocks come first
  list.sort((a, b) => b.length - a.length);
  for (const a of list) {
    for (const b of list) {
      if (a !== b && !a.replaced) {
        if (a.address <= b.address && b.address + b.length <= a.address + a.length) {
          // B is inside A--replace it with a view of A's buffer
          const dv = a.owner[MEMORY];
          const offset = b.address - a.address + dv.byteOffset;
          const newDV = new DataView(dv.buffer, offset, b.length);
          newDV.address = b.address;
          b.owner[MEMORY] = newDV;
          b.replaced = true;
        }
      }
    }
  }
}

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
} from './member.js';
