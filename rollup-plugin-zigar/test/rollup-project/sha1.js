import { usePrimitive, useSlice, usePointer, useArray, useArgStruct, useStruct, useInt, useObject, finalizeStructures, linkModule } from 'zigar-runtime';

// activate features
usePrimitive();
useSlice();
usePointer();
useArray();
useArgStruct();
useStruct();
useInt();
useObject();

// define structures
const s = {
  constructor: null,
  initializer: null,
  pointerCopier: null,
  pointerResetter: null,
  pointerDisabler: null,
  typedArray: null,
  type: 0,
  name: undefined,
  size: 4,
  align: 2,
  isConst: false,
  hasPointer: false,
  instance: {
    members: [],
    methods: [],
    template: null
  },
  static: {
    members: [],
    methods: [],
    template: null
  },
  options: {"runtimeSafety":false},
};
const m = {
  type: 0,
  isRequired: false,
  bitSize: 32,
  byteSize: 4,
};
const s0 = {
  ...s,
  name: "u8",
  size: 1,
  align: 0,
  instance: {
    members: [
      {
        ...m,
        type: 2,
        isSigned: false,
        bitOffset: 0,
        bitSize: 8,
        byteSize: 1,
        structure: undefined,
      },
    ],
    methods: [],
    template: null
  },
  slot: 5,
};
const s1 = {
  ...s,
  type: 12,
  name: "[_]const u8",
  size: 1,
  align: 0,
  instance: {
    members: [
      {
        ...m,
        type: 2,
        isSigned: false,
        bitSize: 8,
        byteSize: 1,
        structure: s0,
      },
    ],
    methods: [],
    template: null
  },
  slot: 3,
};
const s2 = {
  ...s,
  type: 11,
  name: "[]const u8",
  size: 8,
  isConst: true,
  hasPointer: true,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: s1,
      },
    ],
    methods: [],
    template: null
  },
  slot: 2,
};
const s3 = {
  ...s,
  type: 1,
  name: "[40]u8",
  size: 40,
  align: 0,
  instance: {
    members: [
      {
        ...m,
        type: 2,
        isSigned: false,
        bitSize: 8,
        byteSize: 1,
        structure: s0,
      },
    ],
    methods: [],
    template: null
  },
  slot: 4,
};
const s4 = {
  ...s,
  type: 3,
  name: "sha1",
  size: 48,
  hasPointer: true,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        isRequired: true,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        name: "0",
        structure: s2,
      },
      {
        ...m,
        type: 5,
        isRequired: true,
        bitOffset: 64,
        bitSize: 320,
        byteSize: 40,
        slot: 1,
        name: "retval",
        structure: s3,
      },
    ],
    methods: [],
    template: null
  },
  slot: 1,
};
const f0 = {
  argStruct: s4,
  thunk: 3,
  name: "sha1",
};
const s5 = {
  ...s,
  type: 2,
  name: "sha1",
  size: 0,
  align: 0,
  instance: {
    members: [],
    methods: [],
    template: {
    },
  },
  static: {
    members: [],
    methods: [ f0 ],
    template: null
  },
  slot: 0,
};

// finalize structures
const structures = [ s0, s1, s2, s3, s4, s5 ];
const linkage = finalizeStructures(structures);
const module = s5.constructor;

// initiate loading and compilation of WASM bytecodes
const wasmPromise = (async () => {
  const { readFile } = await import('fs/promises');
  const { fileURLToPath } = await import('url');
  const path = fileURLToPath(new URL('assets/sha1-e57d84bf.wasm', import.meta.url).href);
  return readFile(path);
})();
const __init = linkModule(wasmPromise, linkage);

// export functions, types, and constants
const {
  sha1,
} = module;

export { __init, module as default, sha1 };
