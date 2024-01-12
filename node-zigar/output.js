import { loadModule } from "file:///home/cleong/zigar/node-zigar-addon/dist/index.js";

// structure defaults
const s = {
  constructor: null,
  typedArray: null,
  type: 0,
  name: undefined,
  byteSize: 0,
  align: 0,
  isConst: false,
  hasPointer: false,
  instance: {"members":[],"methods":[],"template":null},
  static: {"members":[],"methods":[],"template":null},
};

// member defaults
const m = {
  type: 0,
  isRequired: false,
};

const s0 = {}, s1 = {}, s2 = {}, s3 = {}, s4 = {}, s5 = {}, s6 = {}, s7 = {}, s8 = {}, s9 = {};
const s10 = {}, s11 = {}, s12 = {};
const o0 = {}, o1 = {}, o2 = {}, o3 = {}, o4 = {}, o5 = {}, o6 = {}, o7 = {}, o8 = {}, o9 = {};
const o10 = {}, o11 = {}, o12 = {}, o13 = {}, o14 = {};
const a0 = new Uint8Array([ 43, 0 ]);
const a1 = new Uint8Array([ 44, 0 ]);
const a2 = new Uint8Array([ 0 ]);
const a3 = new Uint8Array([ 1 ]);
const a4 = new Uint8Array([ 2 ]);
const a5 = new Uint8Array();
const a6 = new Uint8Array();
const a7 = new Uint8Array([ 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]);

// define objects
Object.assign(o0, {
  slots: {
    0: o1, 1: o2,
  },
});
Object.assign(o1, {
  structure: s1,
  memory: { array: a0 },
});
Object.assign(o2, {
  structure: s1,
  memory: { array: a1 },
});
Object.assign(o3, {
  slots: {
    0: o4, 1: o5, 2: o6,
  },
});
Object.assign(o4, {
  structure: s7,
  memory: { array: a2 },
});
Object.assign(o5, {
  structure: s7,
  memory: { array: a3 },
});
Object.assign(o6, {
  structure: s7,
  memory: { array: a4 },
});
Object.assign(o7, {
  slots: {
    0: o8, 1: o10, 2: o12,
  },
});
Object.assign(o8, {
  structure: s0,
  memory: { array: a5 },
  slots: {
    0: o9,
  },
});
Object.assign(o9, {
  structure: s1,
});
Object.assign(o10, {
  structure: s0,
  memory: { array: a6 },
  slots: {
    0: o11,
  },
});
Object.assign(o11, {
  structure: s8,
});
Object.assign(o12, {
  structure: s9,
  memory: { array: a7 },
  reloc: 1042192,
  slots: {
    0: o13,
  },
});
Object.assign(o13, {
  structure: s8,
  memory: { array: a7, offset: 0, length: 24 },
  reloc: 1042192,
  slots: {
    0: o14,
  },
});
Object.assign(o14, {
  structure: s4,
  memory: { array: a7, offset: 0, length: 16 },
  reloc: 1042192,
});

// define functions
const f0 = {
  argStruct: s11,
  thunkId: 559392,
  name: "print",
};

// define structures
Object.assign(s0, {
  ...s,
  name: "type",
  instance: {
    members: [
      {
        ...m,
        type: 8,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        slot: 0,
        structure: s0,
      },
    ],
    methods: [],
  },
});
Object.assign(s1, {
  ...s,
  type: 8,
  name: "ErrorSet0000",
  byteSize: 2,
  align: 2,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      },
    ],
    methods: [],
  },
  static: {
    members: [
      {
        ...m,
        type: 9,
        slot: 0,
        name: "GoldfishDied",
        structure: s1,
      },
      {
        ...m,
        type: 9,
        slot: 1,
        name: "NoMoney",
        structure: s1,
      },
    ],
    methods: [],
    template: o0
  },
});
Object.assign(s2, {
  ...s,
  name: "u8",
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: s2,
      },
    ],
    methods: [],
  },
});
Object.assign(s3, {
  ...s,
  type: 12,
  name: "[_]const u8",
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 8,
        byteSize: 1,
        structure: s2,
      },
    ],
    methods: [],
  },
});
Object.assign(s4, {
  ...s,
  type: 11,
  name: "[]const u8",
  byteSize: 16,
  align: 8,
  isConst: true,
  hasPointer: true,
  instance: {
    members: [
      {
        ...m,
        type: 7,
        bitSize: 128,
        byteSize: 16,
        slot: 0,
        structure: s3,
      },
    ],
    methods: [],
  },
});
Object.assign(s5, {
  ...s,
  name: "u32",
  byteSize: 4,
  align: 4,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: s5,
      },
    ],
    methods: [],
  },
});
Object.assign(s6, {
  ...s,
  name: "f64",
  byteSize: 8,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 4,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: s6,
      },
    ],
    methods: [],
  },
});
Object.assign(s7, {
  ...s,
  type: 9,
  name: "in-error-union.ValueType",
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
      },
    ],
    methods: [],
  },
  static: {
    members: [
      {
        ...m,
        type: 9,
        slot: 0,
        name: "String",
        structure: s7,
      },
      {
        ...m,
        type: 9,
        slot: 1,
        name: "Integer",
        structure: s7,
      },
      {
        ...m,
        type: 9,
        slot: 2,
        name: "Float",
        structure: s7,
      },
    ],
    methods: [],
    template: o3
  },
});
Object.assign(s8, {
  ...s,
  type: 6,
  name: "in-error-union.Variant",
  byteSize: 24,
  align: 8,
  hasPointer: true,
  instance: {
    members: [
      {
        ...m,
        type: 7,
        bitSize: 128,
        bitOffset: 0,
        byteSize: 16,
        slot: 0,
        name: "String",
        structure: s4,
      },
      {
        ...m,
        type: 3,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        slot: 1,
        name: "Integer",
        structure: s5,
      },
      {
        ...m,
        type: 4,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 2,
        name: "Float",
        structure: s6,
      },
      {
        ...m,
        type: 5,
        bitSize: 2,
        bitOffset: 128,
        byteSize: 1,
        name: "selector",
        structure: s7,
      },
    ],
    methods: [],
  },
});
Object.assign(s9, {
  ...s,
  type: 7,
  name: "ErrorSet0000!in-error-union.Variant",
  byteSize: 32,
  align: 8,
  hasPointer: true,
  instance: {
    members: [
      {
        ...m,
        type: 7,
        bitSize: 192,
        bitOffset: 0,
        byteSize: 24,
        slot: 0,
        name: "value",
        structure: s8,
      },
      {
        ...m,
        type: 6,
        bitSize: 16,
        bitOffset: 192,
        byteSize: 2,
        name: "error",
        structure: s1,
      },
    ],
    methods: [],
  },
});
Object.assign(s10, {
  ...s,
  name: "void",
  instance: {
    members: [
      {
        ...m,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        structure: s10,
      },
    ],
    methods: [],
  },
});
Object.assign(s11, {
  ...s,
  type: 3,
  name: "print",
  instance: {
    members: [
      {
        ...m,
        isRequired: true,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        slot: 0,
        name: "retval",
        structure: s10,
      },
    ],
    methods: [],
  },
});
Object.assign(s12, {
  ...s,
  type: 2,
  name: "in-error-union",
  static: {
    members: [
      {
        ...m,
        type: 9,
        slot: 0,
        name: "Error",
        structure: s0,
      },
      {
        ...m,
        type: 9,
        slot: 1,
        name: "Variant",
        structure: s0,
      },
      {
        ...m,
        type: 10,
        slot: 2,
        name: "error_union",
        structure: s9,
      },
    ],
    methods: [
      f0,
    ],
    template: o7
  },
});
const structures = [
  s0, s1, s2, s3, s4, s5, s6, s7, s8, s9,
  s10, s11, s12,
];
const root = s12;

// create runtime environment
const env = loadModule("/home/cleong/zigar/node-zigar/zigar-cache/linux/x64/Debug/98c7d23f4588d4d013989fc1f669f5f5/libin-error-union.so");
const __zigar = env.getControlObject();
env.recreateStructures(structures);
env.linkVariables(false);

const { constructor } = root;
export { constructor as default, __zigar }
export const { print, Error, Variant } = constructor;
await __zigar.init();