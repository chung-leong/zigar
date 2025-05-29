import { createRequire } from 'node:module';
import os from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const platform = getPlatform();
const arch = getArch();
const ext = getLibraryExt(platform);
const moduleName = `${platform}.${arch}.${ext}`;
const addonName = `${platform}.${arch}.node`;
const { createEnvironment } = require(resolve(__dirname, "../lib/node-zigar-addon", addonName));

// structure defaults
const s = {
  constructor: null,
  type: 0,
  flags: 0,
  signature: undefined,
  name: undefined,
  byteSize: 0,
  align: 0,
  instance: {
    members: [],
    template: null,
  },
  static: {
    members: [],
    template: null,
  },
};

// member defaults
const m = {
  type: 0,
  flags: 0,
};

// declare structure objects
const s0 = {}, s1 = {}, s2 = {}, s3 = {}, s4 = {}, s5 = {}, s6 = {}, s7 = {}, s8 = {}, s9 = {};
const s10 = {}, s11 = {}, s12 = {}, s13 = {}, s14 = {}, s15 = {}, s16 = {}, s17 = {}, s18 = {}, s19 = {};
const s20 = {}, s21 = {}, s22 = {}, s23 = {}, s24 = {}, s25 = {}, s26 = {}, s27 = {}, s28 = {}, s29 = {};
const s30 = {}, s31 = {}, s32 = {}, s33 = {}, s34 = {}, s35 = {}, s36 = {}, s37 = {};

// declare objects
const o0 = {}, o1 = {}, o2 = {}, o3 = {}, o4 = {}, o5 = {}, o6 = {}, o7 = {}, o8 = {}, o9 = {};
const o10 = {}, o11 = {}, o12 = {}, o13 = {}, o14 = {}, o15 = {}, o16 = {}, o17 = {}, o18 = {}, o19 = {};
const o20 = {}, o21 = {}, o22 = {}, o23 = {}, o24 = {}, o25 = {}, o26 = {}, o27 = {}, o28 = {}, o29 = {};
const o30 = {}, o31 = {}, o32 = {}, o33 = {}, o34 = {}, o35 = {}, o36 = {}, o37 = {}, o38 = {}, o39 = {};
const o40 = {}, o41 = {}, o42 = {}, o43 = {}, o44 = {}, o45 = {}, o46 = {}, o47 = {}, o48 = {}, o49 = {};
const o50 = {}, o51 = {}, o52 = {}, o53 = {}, o54 = {}, o55 = {}, o56 = {}, o57 = {}, o58 = {}, o59 = {};
const o60 = {};

// define byte arrays
const U = i => new Uint8Array(i);
const a0 = U([ 1, 0 ]);
const a1 = U([ 2, 0 ]);
const a2 = U([ 3, 0 ]);
const a3 = U([ 4, 0 ]);
const a4 = U([ 5, 0 ]);
const a5 = U([ 6, 0 ]);
const a6 = U([ 7, 0 ]);
const a7 = U([ 8, 0 ]);
const a8 = U([ 9, 0 ]);
const a9 = U([ 10, 0 ]);
const a10 = U([ 11, 0 ]);
const a11 = U([ 12, 0 ]);
const a12 = U([ 13, 0 ]);
const a13 = U([ 14, 0 ]);
const a14 = U([ 15, 0 ]);
const a15 = U([ 16, 0 ]);
const a16 = U([ 17, 0 ]);
const a17 = U([ 18, 0 ]);
const a18 = U([ 19, 0 ]);
const a19 = U([ 20, 0 ]);
const a20 = U([ 21, 0 ]);
const a21 = U([ 22, 0 ]);
const a22 = U([ 23, 0 ]);
const a23 = U([ 24, 0 ]);
const a24 = U([ 25, 0 ]);
const a25 = U([ 40, 0 ]);
const a26 = U([ 48, 0 ]);
const a27 = U([ 49, 0 ]);
const a28 = U([ 50, 0 ]);
const a29 = U([ 51, 0 ]);
const a30 = U([ 52, 0 ]);
const a31 = U(0);
const a32 = U(16);
const a33 = U(a0);
const a34 = U(a26);
const a35 = U(16);
const a36 = U(16);

// fill in object properties
const $ = Object.assign;
$(o0, {
  slots: {
    0: o1, 1: o2, 2: o3, 3: o4, 4: o5, 5: o6, 6: o7, 7: o8, 8: o9, 9: o10,
    10: o11, 11: o12, 12: o13, 13: o14, 14: o15, 15: o16, 16: o17, 17: o18, 18: o19, 19: o20,
    20: o21, 21: o22, 22: o23, 23: o24, 24: o25, 25: o26, 26: o27, 27: o28, 28: o29, 29: o30,
    30: o31,
  },
});
$(o1, {
  structure: s1,
  memory: { array: a0 },
  const: true,
});
$(o2, {
  structure: s1,
  memory: { array: a1 },
  const: true,
});
$(o3, {
  structure: s1,
  memory: { array: a2 },
  const: true,
});
$(o4, {
  structure: s1,
  memory: { array: a3 },
  const: true,
});
$(o5, {
  structure: s1,
  memory: { array: a4 },
  const: true,
});
$(o6, {
  structure: s1,
  memory: { array: a5 },
  const: true,
});
$(o7, {
  structure: s1,
  memory: { array: a6 },
  const: true,
});
$(o8, {
  structure: s1,
  memory: { array: a7 },
  const: true,
});
$(o9, {
  structure: s1,
  memory: { array: a8 },
  const: true,
});
$(o10, {
  structure: s1,
  memory: { array: a9 },
  const: true,
});
$(o11, {
  structure: s1,
  memory: { array: a10 },
  const: true,
});
$(o12, {
  structure: s1,
  memory: { array: a11 },
  const: true,
});
$(o13, {
  structure: s1,
  memory: { array: a12 },
  const: true,
});
$(o14, {
  structure: s1,
  memory: { array: a13 },
  const: true,
});
$(o15, {
  structure: s1,
  memory: { array: a14 },
  const: true,
});
$(o16, {
  structure: s1,
  memory: { array: a15 },
  const: true,
});
$(o17, {
  structure: s1,
  memory: { array: a16 },
  const: true,
});
$(o18, {
  structure: s1,
  memory: { array: a17 },
  const: true,
});
$(o19, {
  structure: s1,
  memory: { array: a18 },
  const: true,
});
$(o20, {
  structure: s1,
  memory: { array: a19 },
  const: true,
});
$(o21, {
  structure: s1,
  memory: { array: a20 },
  const: true,
});
$(o22, {
  structure: s1,
  memory: { array: a21 },
  const: true,
});
$(o23, {
  structure: s1,
  memory: { array: a22 },
  const: true,
});
$(o24, {
  structure: s1,
  memory: { array: a23 },
  const: true,
});
$(o25, {
  structure: s1,
  memory: { array: a24 },
  const: true,
});
$(o26, {
  structure: s1,
  memory: { array: a25 },
  const: true,
});
$(o27, {
  structure: s1,
  memory: { array: a26 },
  const: true,
});
$(o28, {
  structure: s1,
  memory: { array: a27 },
  const: true,
});
$(o29, {
  structure: s1,
  memory: { array: a28 },
  const: true,
});
$(o30, {
  structure: s1,
  memory: { array: a29 },
  const: true,
});
$(o31, {
  structure: s1,
  memory: { array: a30 },
  const: true,
});
$(o32, {
  memory: { array: a31 },
  handle: 135190,
});
$(o33, {
  memory: { array: a31 },
  handle: 149365,
});
$(o34, {
  memory: { array: a31 },
  handle: 152057,
});
$(o35, {
  memory: { array: a32 },
  handle: 148028,
  slots: {
    0: o36, 1: o38,
  },
});
$(o36, {
  structure: s9,
  memory: { array: a32, offset: 0, length: 8 },
  slots: {
    0: o37,
  },
});
$(o37, {
  structure: s8,
  memory: { array: a32, offset: 0, length: 8 },
});
$(o38, {
  structure: s12,
  memory: { array: a32, offset: 8, length: 8 },
  slots: {
    0: o39,
  },
});
$(o39, {
  structure: s11,
  memory: { array: a31 },
});
$(o40, {
  memory: { array: a31 },
  handle: 135551,
});
$(o41, {
  slots: {
    0: o42, 1: o43,
  },
});
$(o42, {
  structure: s16,
  memory: { array: a33 },
  const: true,
});
$(o43, {
  structure: s16,
  memory: { array: a34 },
  const: true,
});
$(o44, {
  memory: { array: a31 },
  handle: 152070,
});
$(o45, {
  memory: { array: a31 },
  handle: 153574,
});
$(o46, {
  memory: { array: a35 },
  handle: 148028,
  slots: {
    0: o47, 1: o49,
  },
});
$(o47, {
  structure: s18,
  memory: { array: a32, offset: 0, length: 8 },
  slots: {
    0: o48,
  },
});
$(o48, {
  structure: s7,
  memory: { array: a31 },
});
$(o49, {
  structure: s25,
  memory: { array: a32, offset: 8, length: 8 },
  slots: {
    0: o50,
  },
});
$(o50, {
  structure: s24,
  memory: { array: a31 },
});
$(o51, {
  memory: { array: a31 },
  handle: 153587,
});
$(o52, {
  memory: { array: a31 },
  handle: 155091,
});
$(o53, {
  memory: { array: a36 },
  handle: 148028,
  slots: {
    0: o36, 1: o54,
  },
});
$(o54, {
  structure: s33,
  memory: { array: a32, offset: 8, length: 8 },
  slots: {
    0: o55,
  },
});
$(o55, {
  structure: s32,
  memory: { array: a31 },
});
$(o56, {
  memory: { array: a31 },
  handle: 136214,
});
$(o57, {
  slots: {
    0: o58, 1: o59, 2: o60,
  },
});
$(o58, {
  structure: s5,
  memory: { array: a31 },
  handle: 126041,
});
$(o59, {
  structure: s15,
  memory: { array: a31 },
  handle: 126085,
});
$(o60, {
  structure: s36,
  memory: { array: a31 },
  handle: 126184,
});

// fill in structure properties
$(s0, {
  ...s,
  flags: 1,
  signature: 0xa310b7d01f11b8can,
  name: "void",
  align: 1,
  instance: {
    members: [
      {
        ...m,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        structure: s0,
      },
    ],
  },
});
$(s1, {
  ...s,
  type: 5,
  flags: 1,
  signature: 0x5062e16b4c329430n,
  name: "ES0",
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
        structure: s1,
      },
    ],
  },
  static: {
    members: [
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 0,
        name: "OutOfMemory",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 1,
        name: "Unknown",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 2,
        name: "UnableToAllocateMemory",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 3,
        name: "UnableToFreeMemory",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 4,
        name: "UnableToRetrieveMemoryLocation",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 5,
        name: "UnableToCreateDataView",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 6,
        name: "UnableToCreateObject",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 7,
        name: "UnableToObtainSlot",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 8,
        name: "UnableToRetrieveObject",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 9,
        name: "UnableToInsertObject",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 10,
        name: "UnableToStartStructureDefinition",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 11,
        name: "UnableToAddStructureMember",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 12,
        name: "UnableToAddStaticMember",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 13,
        name: "UnableToAddMethod",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 14,
        name: "UnableToCreateStructureTemplate",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 15,
        name: "UnableToCreateString",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 16,
        name: "UnableToAddStructureTemplate",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 17,
        name: "UnableToDefineStructure",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 18,
        name: "UnableToWriteToConsole",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 19,
        name: "UnableToCreateFunction",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 20,
        name: "UnableToUseThread",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 21,
        name: "NotInMainThread",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 22,
        name: "MainThreadNotFound",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 23,
        name: "MultithreadingNotEnabled",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 24,
        name: "TooManyArguments",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 25,
        name: "SystemResources",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 26,
        name: "Unexpected",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 27,
        name: "AlreadyInitialized",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 28,
        name: "Deinitializing",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 29,
        name: "ThreadQuotaExceeded",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 30,
        name: "LockedMemoryLimitExceeded",
        structure: s1,
      },
    ],
    template: o0
  },
});
$(s2, {
  ...s,
  type: 4,
  flags: 1,
  signature: 0x486b0cb193cc99edn,
  name: "ES0!void",
  byteSize: 2,
  align: 2,
  instance: {
    members: [
      {
        ...m,
        bitSize: 0,
        bitOffset: 16,
        byteSize: 0,
        slot: 0,
        structure: s0,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: s1,
      },
    ],
  },
});
$(s3, {
  ...s,
  flags: 17,
  signature: 0xad790f74c7d61933n,
  name: "usize",
  byteSize: 8,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: s3,
      },
    ],
  },
});
$(s4, {
  ...s,
  type: 12,
  flags: 42,
  signature: 0xdc467b8577879c03n,
  name: "Arg(fn (usize) ES0!void)",
  length: 1,
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 16,
        bitOffset: 64,
        byteSize: 2,
        slot: 0,
        name: "retval",
        structure: s2,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 1,
        name: "0",
        structure: s3,
      },
    ],
  },
});
$(s5, {
  ...s,
  type: 14,
  signature: 0xe4855c7a3f89eb94n,
  name: "fn (usize) ES0!void",
  length: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 128,
        byteSize: 16,
        structure: s4,
      },
    ],
    template: o32
  },
});
$(s6, {
  ...s,
  flags: 1,
  signature: 0x370ee22b85937307n,
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
        structure: s6,
      },
    ],
  },
});
$(s7, {
  ...s,
  type: 9,
  flags: 480,
  signature: 0x9b3f78f92307ba61n,
  name: "anyopaque",
  byteSize: undefined,
  align: 65535,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 8,
        byteSize: 1,
        structure: s6,
      },
    ],
  },
});
$(s8, {
  ...s,
  type: 8,
  flags: 332,
  signature: 0x4057fadddf1d8877n,
  name: "*opaque",
  byteSize: 8,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: s7,
      },
    ],
  },
});
$(s9, {
  ...s,
  type: 7,
  flags: 15,
  signature: 0xfd89f2070573d249n,
  name: "?*opaque",
  byteSize: 8,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: s8,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: s3,
      },
    ],
  },
});
$(s10, {
  ...s,
  type: 12,
  flags: 14,
  signature: 0xa4f4ca33336a9dbcn,
  name: "Arg(fn (?*opaque, void) void)",
  length: 2,
  byteSize: 8,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        flags: 1,
        bitSize: 0,
        bitOffset: 64,
        byteSize: 0,
        slot: 0,
        name: "retval",
        structure: s0,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 1,
        name: "0",
        structure: s9,
      },
      {
        ...m,
        flags: 1,
        bitSize: 0,
        bitOffset: 64,
        byteSize: 0,
        slot: 2,
        name: "1",
        structure: s0,
      },
    ],
  },
});
$(s11, {
  ...s,
  type: 14,
  signature: 0xab938596c6214c24n,
  name: "fn (?*opaque, void) void",
  length: 2,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 64,
        byteSize: 8,
        structure: s10,
      },
    ],
    template: o33
  },
  static: {
    members: [],
    template: o34
  },
});
$(s12, {
  ...s,
  type: 8,
  flags: 204,
  signature: 0x3383733aa3b32c56n,
  name: "*const fn (?*opaque, void) void",
  byteSize: 8,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: s11,
      },
    ],
  },
});
$(s13, {
  ...s,
  type: 2,
  flags: 526,
  signature: 0x0d15352f0eaaaee2n,
  name: "Promise",
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        name: "ptr",
        structure: s9,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 64,
        bitOffset: 64,
        byteSize: 8,
        slot: 1,
        name: "callback",
        structure: s12,
      },
    ],
    template: o35
  },
});
$(s14, {
  ...s,
  type: 12,
  flags: 94,
  signature: 0x4df95d08659081dcn,
  name: "Arg(fn (Promise) void)",
  length: 0,
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        flags: 1,
        bitSize: 0,
        bitOffset: 128,
        byteSize: 0,
        slot: 0,
        name: "retval",
        structure: s0,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 128,
        bitOffset: 0,
        byteSize: 16,
        slot: 1,
        name: "0",
        structure: s13,
      },
    ],
  },
});
$(s15, {
  ...s,
  type: 14,
  signature: 0xc449c79e7d730846n,
  name: "fn (Promise) void",
  length: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 128,
        byteSize: 16,
        structure: s14,
      },
    ],
    template: o40
  },
});
$(s16, {
  ...s,
  type: 5,
  flags: 1,
  signature: 0x2adad32524badd97n,
  name: "ES1",
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
        structure: s16,
      },
    ],
  },
  static: {
    members: [
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 0,
        name: "OutOfMemory",
        structure: s16,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 1,
        name: "Unexpected",
        structure: s16,
      },
    ],
    template: o41
  },
});
$(s17, {
  ...s,
  type: 4,
  flags: 1,
  signature: 0x6eca2207e5ac3565n,
  name: "ES1!void",
  byteSize: 2,
  align: 2,
  instance: {
    members: [
      {
        ...m,
        bitSize: 0,
        bitOffset: 16,
        byteSize: 0,
        slot: 0,
        structure: s0,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: s16,
      },
    ],
  },
});
$(s18, {
  ...s,
  type: 8,
  flags: 460,
  signature: 0x98abf42c3c09f315n,
  name: "*const opaque",
  byteSize: 8,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: s7,
      },
    ],
  },
});
$(s19, {
  ...s,
  type: 5,
  flags: 17,
  signature: 0xd44c72e3a91d7a13n,
  name: "anyerror",
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
        structure: s19,
      },
    ],
  },
});
$(s20, {
  ...s,
  type: 4,
  flags: 1,
  signature: 0xde5ac594824a5e52n,
  name: "anyerror!usize",
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: s3,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitSize: 16,
        bitOffset: 64,
        byteSize: 2,
        structure: s19,
      },
    ],
  },
});
$(s21, {
  ...s,
  type: 9,
  flags: 224,
  signature: 0x9b3f78f92307ba61n,
  name: "[_]u8",
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 8,
        byteSize: 1,
        structure: s6,
      },
    ],
  },
});
$(s22, {
  ...s,
  type: 8,
  flags: 188,
  signature: 0x7e2f0adf211d515en,
  name: "[]const u8",
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 128,
        byteSize: 16,
        slot: 0,
        structure: s21,
      },
    ],
  },
});
$(s23, {
  ...s,
  type: 12,
  flags: 46,
  signature: 0x1d25e6978b851ae8n,
  name: "Arg(fn (*const opaque, []const u8) anyerror!usize)",
  length: 2,
  byteSize: 40,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 128,
        bitOffset: 0,
        byteSize: 16,
        slot: 0,
        name: "retval",
        structure: s20,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 64,
        bitOffset: 128,
        byteSize: 8,
        slot: 1,
        name: "0",
        structure: s18,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 128,
        bitOffset: 192,
        byteSize: 16,
        slot: 2,
        name: "1",
        structure: s22,
      },
    ],
  },
});
$(s24, {
  ...s,
  type: 14,
  signature: 0x1d9c964af8eccc95n,
  name: "fn (*const opaque, []const u8) anyerror!usize",
  length: 2,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 320,
        byteSize: 40,
        structure: s23,
      },
    ],
    template: o44
  },
  static: {
    members: [],
    template: o45
  },
});
$(s25, {
  ...s,
  type: 8,
  flags: 204,
  signature: 0x0a0057cd103bd73en,
  name: "*const fn (*const opaque, []const u8) anyerror!usize",
  byteSize: 8,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: s24,
      },
    ],
  },
});
$(s26, {
  ...s,
  type: 2,
  flags: 16398,
  signature: 0x4837e98da467efb2n,
  name: "Writer",
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        name: "context",
        structure: s18,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 64,
        bitOffset: 64,
        byteSize: 8,
        slot: 1,
        name: "writeFn",
        structure: s25,
      },
    ],
    template: o46
  },
});
$(s27, {
  ...s,
  type: 9,
  flags: 14,
  signature: 0xc001c2bbe5847336n,
  name: "[_][]const u8",
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 128,
        byteSize: 16,
        structure: s22,
      },
    ],
  },
});
$(s28, {
  ...s,
  type: 8,
  flags: 188,
  signature: 0x5ed240e66e88c600n,
  name: "[]const []const u8",
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 128,
        byteSize: 16,
        slot: 0,
        structure: s27,
      },
    ],
  },
});
$(s29, {
  ...s,
  type: 5,
  flags: 17,
  signature: 0x3596180da264e267n,
  name: "anyerror",
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
        structure: s29,
      },
    ],
  },
});
$(s30, {
  ...s,
  type: 4,
  flags: 1,
  signature: 0x5a95f4d8316dada4n,
  name: "anyerror!void",
  byteSize: 2,
  align: 2,
  instance: {
    members: [
      {
        ...m,
        bitSize: 0,
        bitOffset: 16,
        byteSize: 0,
        slot: 0,
        structure: s0,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: s29,
      },
    ],
  },
});
$(s31, {
  ...s,
  type: 12,
  flags: 14,
  signature: 0x29d18d49b97be9cen,
  name: "Arg(fn (?*opaque, anyerror!void) void)",
  length: 2,
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        flags: 1,
        bitSize: 0,
        bitOffset: 80,
        byteSize: 0,
        slot: 0,
        name: "retval",
        structure: s0,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 1,
        name: "0",
        structure: s9,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 16,
        bitOffset: 64,
        byteSize: 2,
        slot: 2,
        name: "1",
        structure: s30,
      },
    ],
  },
});
$(s32, {
  ...s,
  type: 14,
  signature: 0x268510ca6d00efc3n,
  name: "fn (?*opaque, anyerror!void) void",
  length: 2,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 128,
        byteSize: 16,
        structure: s31,
      },
    ],
    template: o51
  },
  static: {
    members: [],
    template: o52
  },
});
$(s33, {
  ...s,
  type: 8,
  flags: 204,
  signature: 0x771b102a8d7a0f5dn,
  name: "*const fn (?*opaque, anyerror!void) void",
  byteSize: 8,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: s32,
      },
    ],
  },
});
$(s34, {
  ...s,
  type: 2,
  flags: 526,
  signature: 0x1dd368925fb30621n,
  name: "Promise",
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        name: "ptr",
        structure: s9,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 64,
        bitOffset: 64,
        byteSize: 8,
        slot: 1,
        name: "callback",
        structure: s33,
      },
    ],
    template: o53
  },
});
$(s35, {
  ...s,
  type: 12,
  flags: 126,
  signature: 0x09576b689730d5b9n,
  name: "Arg(fn (Writer, []const u8, []const []const u8, Promise) ES1!void)",
  length: 3,
  byteSize: 72,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 16,
        bitOffset: 512,
        byteSize: 2,
        slot: 0,
        name: "retval",
        structure: s17,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 128,
        bitOffset: 0,
        byteSize: 16,
        slot: 1,
        name: "0",
        structure: s26,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 128,
        bitOffset: 128,
        byteSize: 16,
        slot: 2,
        name: "1",
        structure: s22,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 128,
        bitOffset: 256,
        byteSize: 16,
        slot: 3,
        name: "2",
        structure: s28,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 128,
        bitOffset: 384,
        byteSize: 16,
        slot: 4,
        name: "3",
        structure: s34,
      },
    ],
  },
});
$(s36, {
  ...s,
  type: 14,
  signature: 0x875510d8bd83d1acn,
  name: "fn (Writer, []const u8, []const []const u8, Promise) ES1!void",
  length: 3,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 576,
        byteSize: 72,
        structure: s35,
      },
    ],
    template: o56
  },
});
$(s37, {
  ...s,
  type: 2,
  flags: 4096,
  signature: 0x239ab4f327f6ac1bn,
  name: "tar",
  align: 1,
  static: {
    members: [
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 0,
        name: "startup",
        structure: s5,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 1,
        name: "shutdown",
        structure: s15,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 2,
        name: "tar",
        structure: s36,
      },
    ],
    template: o57
  },
});
const structures = [
  s0, s1, s2, s3, s4, s5, s6, s7, s8, s9,
  s10, s11, s12, s13, s14, s15, s16, s17, s18, s19,
  s20, s21, s22, s23, s24, s25, s26, s27, s28, s29,
  s30, s31, s32, s33, s34, s35, s36, s37,
];
const root = s37;
const settings = {
  runtimeSafety: false,
  littleEndian: true,
  libc: true,
};

// create runtime environment
const env = createEnvironment();

// recreate structures
env.recreateStructures(structures, settings);
env.loadModule(resolve(__dirname, "../lib/tar.zigar", moduleName));
env.linkVariables(false);

// export root namespace and its methods and constants
const { constructor: v0 } = root;
const v1 = env.getSpecialExports();
const {
  startup: v2,
  shutdown: v3,
  tar: v4,
} = v0;
export {
  v0 as default,
  v1 as __zigar,
  v2 as startup,
  v3 as shutdown,
  v4 as tar,
};

function getPlatform() {
  let platform = os.platform();
  if (platform === 'linux') {
    // differentiate glibc from musl
    if (process.__gnu === undefined) {
      /* c8 ignore next 3 */
      if (process.versions?.electron || process.__nwjs) {
        process.__gnu = true;
      } else {
        const list = [];
        try {
          // scan ELF executable for imported shared libraries
          const { closeSync, openSync, readSync } = require('fs');
          const fd = openSync(process.execPath, 'r');
          const sig = new Uint8Array(8);
          readSync(fd, sig);
          for (const [ index, value ] of [ '\x7f', 'E', 'L', 'F' ].entries()) {
            if (sig[index] !== value.charCodeAt(0)) {
              throw new Error('Incorrect magic number');
            }
          }
          const bits = sig[4] * 32;
          const le = sig[5] === 1;
          const Ehdr = (bits === 64)
          ? { size: 64, e_shoff: 40, e_shnum: 60 }
          : { size: 52, e_shoff: 32, e_shnum: 48 };
          const Shdr = (bits === 64)
          ? { size: 64, sh_type: 4, sh_offset: 24, sh_size: 32, sh_link: 40 }
          : { size: 40, sh_type: 4, sh_offset: 16, sh_size: 20, sh_link: 24 };
          const Dyn = (bits === 64)
          ? { size: 16, d_tag: 0, d_val: 8 }
          : { size: 8, d_tag: 0, d_val: 4 };
          const Usize = (bits === 64) ? BigInt : Number;
          const read = (position, size) => {
            const buf = new DataView(new ArrayBuffer(Number(size)));
            // deno can't handle bigint position
            readSync(fd, buf, { position: Number(position) });
            buf.getUsize = (bits === 64) ? buf.getBigUint64 : buf.getUint32;
            return buf;
          };
          const SHT_DYNAMIC = 6;
          const DT_NEEDED = 1;
          const ehdr = read(0, Ehdr.size);
          let position = ehdr.getUsize(Ehdr.e_shoff, le);
          const sectionCount = ehdr.getUint16(Ehdr.e_shnum, le);
          const shdrs = [];
          for (let i = 0; i < sectionCount; i++, position += Usize(Shdr.size)) {
            shdrs.push(read(position, Shdr.size));
          }
          const decoder = new TextDecoder();
          for (const shdr of shdrs) {
            const sectionType = shdr.getUint32(Shdr.sh_type, le);
            if (sectionType == SHT_DYNAMIC) {
              const link = shdr.getUint32(Shdr.sh_link, le);
              const strTableOffset = shdrs[link].getUsize(Shdr.sh_offset, le);
              const strTableSize = shdrs[link].getUsize(Shdr.sh_size, le);
              const strTable = read(strTableOffset, strTableSize);
              const dynamicOffset = shdr.getUsize(Shdr.sh_offset, le);
              const dynamicSize = shdr.getUsize(Shdr.sh_size, le);
              const entryCount = Number(dynamicSize / Usize(Dyn.size));
              position = dynamicOffset;
              for (let i = 0; i < entryCount; i++, position += Usize(Dyn.size)) {
                const entry = read(position, Dyn.size);
                const tag = entry.getUsize(Dyn.d_tag, le);
                if (tag === Usize(DT_NEEDED)) {
                  let offset = entry.getUsize(Dyn.d_val, le);
                  let name = '', c;
                  while (c = strTable.getUint8(Number(offset++))) {
                    name += String.fromCharCode(c);
                  }
                  list.push(name);
                }
              }
            }
          }
          closeSync(fd);
        } catch (err) {
        }
        process.__gnu = (list.length > 0) ? list.indexOf('libc.so.6') != -1 : true;
      }
    }
    /* c8 ignore next 3 */
    if (!process.__gnu) {
      platform += '-musl';
    }
  }
  return platform;
}

function getArch() {
  return os.arch();
}

function getLibraryExt(platform) {
  switch (platform) {
    case 'win32': return 'dll';
    case 'darwin': return 'dylib';
    default: return 'so';
  }
}