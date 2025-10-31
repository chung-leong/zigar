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
  purpose: 0,
  flags: 0,
  signature: undefined,
  name: undefined,
  byteSize: undefined,
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
const s30 = {}, s31 = {}, s32 = {}, s33 = {}, s34 = {}, s35 = {}, s36 = {}, s37 = {}, s38 = {}, s39 = {};
const s40 = {}, s41 = {}, s42 = {};

// declare objects
const o0 = {}, o1 = {}, o2 = {}, o3 = {}, o4 = {}, o5 = {}, o6 = {}, o7 = {}, o8 = {}, o9 = {};
const o10 = {}, o11 = {}, o12 = {}, o13 = {}, o14 = {}, o15 = {}, o16 = {}, o17 = {}, o18 = {}, o19 = {};
const o20 = {}, o21 = {}, o22 = {}, o23 = {}, o24 = {}, o25 = {}, o26 = {}, o27 = {}, o28 = {}, o29 = {};
const o30 = {}, o31 = {}, o32 = {}, o33 = {}, o34 = {}, o35 = {}, o36 = {}, o37 = {}, o38 = {}, o39 = {};
const o40 = {}, o41 = {}, o42 = {}, o43 = {}, o44 = {}, o45 = {}, o46 = {}, o47 = {}, o48 = {}, o49 = {};
const o50 = {}, o51 = {}, o52 = {}, o53 = {}, o54 = {}, o55 = {}, o56 = {}, o57 = {}, o58 = {}, o59 = {};
const o60 = {}, o61 = {}, o62 = {}, o63 = {}, o64 = {}, o65 = {}, o66 = {}, o67 = {}, o68 = {}, o69 = {};
const o70 = {}, o71 = {}, o72 = {};

// define byte arrays
const U = i => new Uint8Array(i);
const a0 = U([ 10, 0 ]);
const a1 = U([ 11, 0 ]);
const a2 = U([ 13, 0 ]);
const a3 = U([ 14, 0 ]);
const a4 = U([ 15, 0 ]);
const a5 = U([ 16, 0 ]);
const a6 = U([ 17, 0 ]);
const a7 = U(0);
const a8 = U([ 0, 1 ]);
const a9 = U(3);
const a10 = U([ 1 ]);
const a11 = U(16);
const a12 = U(a0);
const a13 = U(a1);
const a14 = U(3);
const a15 = U(1);
const a16 = U(16);
const a17 = U([ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0 ]);
const a18 = U(32);
const a19 = U(1);
const a20 = U(16);

// fill in object properties
const $ = Object.assign;
$(o0, {
  slots: {
    0: o1, 1: o2, 2: o3, 3: o4, 4: o5, 5: o6, 6: o7,
  },
});
$(o1, {
  structure: s1,
  memory: { array: a0 },
});
$(o2, {
  structure: s1,
  memory: { array: a1 },
});
$(o3, {
  structure: s1,
  memory: { array: a2 },
});
$(o4, {
  structure: s1,
  memory: { array: a3 },
});
$(o5, {
  structure: s1,
  memory: { array: a4 },
});
$(o6, {
  structure: s1,
  memory: { array: a5 },
});
$(o7, {
  structure: s1,
  memory: { array: a6 },
});
$(o8, {});
$(o9, {
  memory: { array: a7 },
  handle: 181010,
});
$(o10, {});
$(o11, {
  memory: { array: a8 },
});
$(o12, {});
$(o13, {
  slots: {
    0: o14, 1: o16, 2: o17,
  },
});
$(o14, {
  structure: s7,
  memory: { array: a7 },
  slots: {
    0: o15,
  },
});
$(o15, {
  structure: s6,
});
$(o16, {
  structure: s10,
  memory: { array: a9 },
});
$(o17, {
  structure: s8,
  memory: { array: a10 },
});
$(o18, {});
$(o19, {});
$(o20, {});
$(o21, {
  memory: { array: a7 },
  handle: 230911,
});
$(o22, {
  memory: { array: a7 },
  handle: 235742,
});
$(o23, {});
$(o24, {
  memory: { array: a11 },
  handle: 228782,
  slots: {
    0: o25, 1: o27,
  },
});
$(o25, {
  structure: s13,
  memory: { array: a11, offset: 0, length: 8 },
  slots: {
    0: o26,
  },
});
$(o26, {
  structure: s12,
  memory: { array: a11, offset: 0, length: 8 },
});
$(o27, {
  structure: s16,
  memory: { array: a11, offset: 8, length: 8 },
  slots: {
    0: o28,
  },
});
$(o28, {
  structure: s15,
  memory: { array: a7 },
});
$(o29, {});
$(o30, {
  memory: { array: a7 },
  handle: 181712,
});
$(o31, {
  slots: {
    0: o32, 1: o33,
  },
});
$(o32, {
  structure: s20,
  memory: { array: a12 },
});
$(o33, {
  structure: s20,
  memory: { array: a13 },
});
$(o34, {});
$(o35, {
  slots: {
    0: o36, 1: o37, 2: o38,
  },
});
$(o36, {
  structure: s7,
  memory: { array: a7 },
  slots: {
    0: o15,
  },
});
$(o37, {
  structure: s10,
  memory: { array: a14 },
});
$(o38, {
  structure: s8,
  memory: { array: a15 },
});
$(o39, {});
$(o40, {});
$(o41, {
  memory: { array: a7 },
  handle: 235755,
});
$(o42, {
  memory: { array: a7 },
  handle: 237259,
});
$(o43, {});
$(o44, {
  memory: { array: a16 },
  handle: 228782,
  slots: {
    0: o45, 1: o47,
  },
});
$(o45, {
  structure: s22,
  memory: { array: a11, offset: 0, length: 8 },
  slots: {
    0: o46,
  },
});
$(o46, {
  structure: s11,
  memory: { array: a7 },
});
$(o47, {
  structure: s29,
  memory: { array: a11, offset: 8, length: 8 },
  slots: {
    0: o48,
  },
});
$(o48, {
  structure: s28,
  memory: { array: a7 },
});
$(o49, {
  memory: { array: a17 },
  handle: 241099,
  slots: {
    0: o50,
  },
});
$(o50, {
  structure: s26,
  memory: { array: a17, offset: 0, length: 16 },
  slots: {
    0: o51,
  },
});
$(o51, {
  structure: s25,
  memory: { array: a7 },
});
$(o52, {});
$(o53, {});
$(o54, {
  slots: {
    0: o55, 1: o57, 2: o58,
  },
});
$(o55, {
  structure: s7,
  memory: { array: a7 },
  slots: {
    0: o56,
  },
});
$(o56, {
  structure: s26,
});
$(o57, {
  structure: s32,
  memory: { array: a18 },
  handle: 229627,
});
$(o58, {
  structure: s8,
  memory: { array: a19 },
});
$(o59, {});
$(o60, {});
$(o61, {
  memory: { array: a7 },
  handle: 238112,
});
$(o62, {
  memory: { array: a7 },
  handle: 239616,
});
$(o63, {});
$(o64, {
  memory: { array: a20 },
  handle: 228782,
  slots: {
    0: o25, 1: o65,
  },
});
$(o65, {
  structure: s38,
  memory: { array: a11, offset: 8, length: 8 },
  slots: {
    0: o66,
  },
});
$(o66, {
  structure: s37,
  memory: { array: a7 },
});
$(o67, {});
$(o68, {
  memory: { array: a7 },
  handle: 205656,
});
$(o69, {
  slots: {
    0: o70, 1: o71, 2: o72,
  },
});
$(o70, {
  structure: s5,
  memory: { array: a7 },
  handle: 171482,
});
$(o71, {
  structure: s19,
  memory: { array: a7 },
  handle: 171495,
});
$(o72, {
  structure: s41,
  memory: { array: a7 },
  handle: 171508,
});

// fill in structure properties
$(s0, {
  ...s,
  flags: 1,
  signature: 0xa310b7d01f11b8can,
  byteSize: 0,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        bitSize: 0,
        byteSize: 0,
        bitOffset: 0,
        structure: s0,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "void",
});
$(s1, {
  ...s,
  type: 5,
  flags: 1,
  signature: 0x5c8ee1f4224f967dn,
  byteSize: 2,
  align: 2,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 16,
        byteSize: 2,
        bitOffset: 0,
        structure: s1,
      },
    ],
  },
  static: {
    members: [
      {
        ...m,
        name: "Unexpected",
        type: 5,
        flags: 4,
        slot: 0,
        structure: s1,
      },
      {
        ...m,
        name: "OutOfMemory",
        type: 5,
        flags: 4,
        slot: 1,
        structure: s1,
      },
      {
        ...m,
        name: "Deinitializing",
        type: 5,
        flags: 4,
        slot: 2,
        structure: s1,
      },
      {
        ...m,
        name: "UnableToUseThread",
        type: 5,
        flags: 4,
        slot: 3,
        structure: s1,
      },
      {
        ...m,
        name: "ThreadQuotaExceeded",
        type: 5,
        flags: 4,
        slot: 4,
        structure: s1,
      },
      {
        ...m,
        name: "SystemResources",
        type: 5,
        flags: 4,
        slot: 5,
        structure: s1,
      },
      {
        ...m,
        name: "LockedMemoryLimitExceeded",
        type: 5,
        flags: 4,
        slot: 6,
        structure: s1,
      },
    ],
    template: o0
  },
  name: "ES0",
});
$(s2, {
  ...s,
  type: 4,
  flags: 1,
  signature: 0x62953c5804784650n,
  byteSize: 2,
  align: 2,
  instance: {
    members: [
      {
        ...m,
        bitOffset: 16,
        bitSize: 0,
        byteSize: 0,
        slot: 0,
        structure: s0,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitOffset: 0,
        bitSize: 16,
        byteSize: 2,
        structure: s1,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "ES0!void",
});
$(s3, {
  ...s,
  flags: 33,
  signature: 0xad790f74c7d61933n,
  byteSize: 8,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 64,
        byteSize: 8,
        bitOffset: 0,
        structure: s3,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "usize",
});
$(s4, {
  ...s,
  type: 12,
  flags: 74,
  signature: 0x9365f8f0f6b6b7e4n,
  length: 1,
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 5,
        flags: 1,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        slot: 0,
        structure: s2,
      },
      {
        ...m,
        name: "0",
        type: 3,
        flags: 1,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 1,
        structure: s3,
      },
    ],
    template: o8
  },
  static: {
    members: [],
  },
  name: "Arg(fn (usize) ES0!void)",
});
$(s5, {
  ...s,
  type: 14,
  signature: 0xc9ebce58ac63edf6n,
  length: 1,
  byteSize: 0,
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
    template: o9
  },
  static: {
    members: [],
  },
  name: "fn (usize) ES0!void",
});
$(s6, {
  ...s,
  flags: 1,
  signature: 0x370ee22b85937307n,
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 8,
        byteSize: 1,
        bitOffset: 0,
        structure: s6,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "u8",
});
$(s7, {
  ...s,
  flags: 9,
  signature: 0x406b8a99e2cc9d59n,
  byteSize: 0,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 6,
        bitSize: 0,
        byteSize: 0,
        bitOffset: 0,
        slot: 0,
        structure: s7,
      },
    ],
    template: o10
  },
  static: {
    members: [],
  },
  name: "type",
});
$(s8, {
  ...s,
  flags: 1,
  signature: 0x6eddab4b13ff06c5n,
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 1,
        bitSize: 1,
        byteSize: 1,
        bitOffset: 0,
        structure: s8,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "bool",
});
$(s9, {
  ...s,
  type: 2,
  signature: 0x4485a9035cc2b0d7n,
  byteSize: 2,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        name: "value",
        type: 3,
        flags: 1,
        bitOffset: 0,
        bitSize: 8,
        byteSize: 1,
        slot: 0,
        structure: s6,
      },
      {
        ...m,
        name: "is_required",
        type: 1,
        bitOffset: 8,
        bitSize: 1,
        byteSize: 1,
        slot: 1,
        structure: s8,
      },
    ],
    template: o11
  },
  static: {
    members: [],
  },
  name: "S0",
});
$(s10, {
  ...s,
  type: 7,
  flags: 43,
  signature: 0x6cc1b27fb3d21636n,
  byteSize: 3,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 16,
        byteSize: 2,
        bitOffset: 0,
        slot: 0,
        structure: s9,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitOffset: 16,
        bitSize: 8,
        byteSize: 1,
        structure: s6,
      },
    ],
    template: o12
  },
  static: {
    members: [],
  },
  name: "?S0",
});
$(s11, {
  ...s,
  type: 9,
  flags: 976,
  signature: 0x9b3f78f92307ba61n,
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
  static: {
    members: [],
    template: o13
  },
  name: "anyopaque",
});
$(s12, {
  ...s,
  type: 8,
  flags: 668,
  signature: 0x4057fadddf1d8877n,
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
    template: o18
  },
  static: {
    members: [],
  },
  name: "*opaque",
});
$(s13, {
  ...s,
  type: 7,
  flags: 15,
  signature: 0xfd89f2070573d249n,
  byteSize: 8,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 64,
        byteSize: 8,
        bitOffset: 0,
        slot: 0,
        structure: s12,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: s3,
      },
    ],
    template: o19
  },
  static: {
    members: [],
  },
  name: "?*opaque",
});
$(s14, {
  ...s,
  type: 12,
  flags: 14,
  signature: 0xa4f4ca33336a9dbcn,
  length: 2,
  byteSize: 8,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        flags: 1,
        bitOffset: 64,
        bitSize: 0,
        byteSize: 0,
        slot: 0,
        structure: s0,
      },
      {
        ...m,
        name: "0",
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 1,
        structure: s13,
      },
      {
        ...m,
        name: "1",
        flags: 1,
        bitOffset: 64,
        bitSize: 0,
        byteSize: 0,
        slot: 2,
        structure: s0,
      },
    ],
    template: o20
  },
  static: {
    members: [],
  },
  name: "Arg(fn (?*opaque, void) void)",
});
$(s15, {
  ...s,
  type: 14,
  signature: 0xab938596c6214c24n,
  length: 2,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 64,
        byteSize: 8,
        structure: s14,
      },
    ],
    template: o21
  },
  static: {
    members: [],
    template: o22
  },
  name: "fn (?*opaque, void) void",
});
$(s16, {
  ...s,
  type: 8,
  flags: 396,
  signature: 0x3383733aa3b32c56n,
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
        structure: s15,
      },
    ],
    template: o23
  },
  static: {
    members: [],
  },
  name: "*const fn (?*opaque, void) void",
});
$(s17, {
  ...s,
  type: 2,
  purpose: 1,
  flags: 14,
  signature: 0x0d15352f0eaaaee2n,
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "ptr",
        type: 5,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: s13,
      },
      {
        ...m,
        name: "callback",
        type: 5,
        flags: 1,
        bitOffset: 64,
        bitSize: 64,
        byteSize: 8,
        slot: 1,
        structure: s16,
      },
    ],
    template: o24
  },
  static: {
    members: [],
  },
  name: "S1",
});
$(s18, {
  ...s,
  type: 12,
  flags: 174,
  signature: 0x4df95d08659081dcn,
  length: 0,
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        flags: 1,
        bitOffset: 128,
        bitSize: 0,
        byteSize: 0,
        slot: 0,
        structure: s0,
      },
      {
        ...m,
        name: "0",
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
        slot: 1,
        structure: s17,
      },
    ],
    template: o29
  },
  static: {
    members: [],
  },
  name: "Arg(fn (S1) void)",
});
$(s19, {
  ...s,
  type: 14,
  signature: 0xc449c79e7d730846n,
  length: 0,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 128,
        byteSize: 16,
        structure: s18,
      },
    ],
    template: o30
  },
  static: {
    members: [],
  },
  name: "fn (S1) void",
});
$(s20, {
  ...s,
  type: 5,
  flags: 1,
  signature: 0xc3ba8da026469b22n,
  byteSize: 2,
  align: 2,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 16,
        byteSize: 2,
        bitOffset: 0,
        structure: s20,
      },
    ],
  },
  static: {
    members: [
      {
        ...m,
        name: "Unexpected",
        type: 5,
        flags: 4,
        slot: 0,
        structure: s20,
      },
      {
        ...m,
        name: "OutOfMemory",
        type: 5,
        flags: 4,
        slot: 1,
        structure: s20,
      },
    ],
    template: o31
  },
  name: "ES1",
});
$(s21, {
  ...s,
  type: 4,
  flags: 1,
  signature: 0xa65ab153c9e26fc7n,
  byteSize: 2,
  align: 2,
  instance: {
    members: [
      {
        ...m,
        bitOffset: 16,
        bitSize: 0,
        byteSize: 0,
        slot: 0,
        structure: s0,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitOffset: 0,
        bitSize: 16,
        byteSize: 2,
        structure: s20,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "ES1!void",
});
$(s22, {
  ...s,
  type: 8,
  flags: 924,
  signature: 0x98abf42c3c09f315n,
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
    template: o34
  },
  static: {
    members: [],
  },
  name: "*const opaque",
});
$(s23, {
  ...s,
  name: "anyerror",
  type: 5,
  flags: 33,
  signature: 0xd44c72e3a91d7a13n,
  byteSize: 2,
  align: 2,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 16,
        byteSize: 2,
        bitOffset: 0,
        structure: s23,
      },
    ],
  },
  static: {
    members: [],
  },
});
$(s24, {
  ...s,
  type: 4,
  flags: 1,
  signature: 0xde5ac594824a5e52n,
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: s3,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: s23,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "anyerror!usize",
});
$(s25, {
  ...s,
  type: 9,
  flags: 464,
  signature: 0x9b3f78f92307ba61n,
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
  static: {
    members: [],
    template: o35
  },
  name: "[_]u8",
});
$(s26, {
  ...s,
  type: 8,
  flags: 380,
  signature: 0x7e2f0adf211d515en,
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
        structure: s25,
      },
    ],
    template: o39
  },
  static: {
    members: [],
  },
  name: "[]const u8",
});
$(s27, {
  ...s,
  type: 12,
  flags: 78,
  signature: 0x1d25e6978b851ae8n,
  length: 2,
  byteSize: 40,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
        slot: 0,
        structure: s24,
      },
      {
        ...m,
        name: "0",
        type: 5,
        flags: 1,
        bitOffset: 128,
        bitSize: 64,
        byteSize: 8,
        slot: 1,
        structure: s22,
      },
      {
        ...m,
        name: "1",
        type: 5,
        flags: 1,
        bitOffset: 192,
        bitSize: 128,
        byteSize: 16,
        slot: 2,
        structure: s26,
      },
    ],
    template: o40
  },
  static: {
    members: [],
  },
  name: "Arg(fn (*const opaque, []const u8) anyerror!usize)",
});
$(s28, {
  ...s,
  type: 14,
  signature: 0x1d9c964af8eccc95n,
  length: 2,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 320,
        byteSize: 40,
        structure: s27,
      },
    ],
    template: o41
  },
  static: {
    members: [],
    template: o42
  },
  name: "fn (*const opaque, []const u8) anyerror!usize",
});
$(s29, {
  ...s,
  type: 8,
  flags: 396,
  signature: 0x0a0057cd103bd73en,
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
        structure: s28,
      },
    ],
    template: o43
  },
  static: {
    members: [],
  },
  name: "*const fn (*const opaque, []const u8) anyerror!usize",
});
$(s30, {
  ...s,
  name: "Writer",
  type: 2,
  purpose: 7,
  flags: 14,
  signature: 0x4837e98da467efb2n,
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "context",
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: s22,
      },
      {
        ...m,
        name: "writeFn",
        type: 5,
        flags: 1,
        bitOffset: 64,
        bitSize: 64,
        byteSize: 8,
        slot: 1,
        structure: s29,
      },
    ],
    template: o44
  },
  static: {
    members: [],
  },
});
$(s31, {
  ...s,
  type: 2,
  flags: 14,
  signature: 0xd2de084ea0e336ban,
  byteSize: 24,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "value",
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
        slot: 0,
        structure: s26,
      },
      {
        ...m,
        name: "is_required",
        type: 1,
        bitOffset: 128,
        bitSize: 1,
        byteSize: 1,
        slot: 1,
        structure: s8,
      },
    ],
    template: o49
  },
  static: {
    members: [],
  },
  name: "S2",
});
$(s32, {
  ...s,
  type: 7,
  flags: 47,
  signature: 0xfb56cb615b1dc17dn,
  byteSize: 32,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 192,
        byteSize: 24,
        bitOffset: 0,
        slot: 0,
        structure: s31,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitOffset: 192,
        bitSize: 8,
        byteSize: 1,
        structure: s6,
      },
    ],
    template: o52
  },
  static: {
    members: [],
  },
  name: "?S2",
});
$(s33, {
  ...s,
  type: 9,
  flags: 30,
  signature: 0xc001c2bbe5847336n,
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 128,
        byteSize: 16,
        structure: s26,
      },
    ],
    template: o53
  },
  static: {
    members: [],
    template: o54
  },
  name: "[_][]const u8",
});
$(s34, {
  ...s,
  type: 8,
  flags: 380,
  signature: 0x5ed240e66e88c600n,
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
        structure: s33,
      },
    ],
    template: o59
  },
  static: {
    members: [],
  },
  name: "[]const []const u8",
});
$(s35, {
  ...s,
  type: 4,
  flags: 1,
  signature: 0x5a95f4d8316dada4n,
  byteSize: 2,
  align: 2,
  instance: {
    members: [
      {
        ...m,
        bitOffset: 16,
        bitSize: 0,
        byteSize: 0,
        slot: 0,
        structure: s0,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitOffset: 0,
        bitSize: 16,
        byteSize: 2,
        structure: s23,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "anyerror!void",
});
$(s36, {
  ...s,
  type: 12,
  flags: 14,
  signature: 0x29d18d49b97be9cen,
  length: 2,
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        flags: 1,
        bitOffset: 80,
        bitSize: 0,
        byteSize: 0,
        slot: 0,
        structure: s0,
      },
      {
        ...m,
        name: "0",
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 1,
        structure: s13,
      },
      {
        ...m,
        name: "1",
        type: 5,
        flags: 1,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        slot: 2,
        structure: s35,
      },
    ],
    template: o60
  },
  static: {
    members: [],
  },
  name: "Arg(fn (?*opaque, anyerror!void) void)",
});
$(s37, {
  ...s,
  type: 14,
  signature: 0x268510ca6d00efc3n,
  length: 2,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 128,
        byteSize: 16,
        structure: s36,
      },
    ],
    template: o61
  },
  static: {
    members: [],
    template: o62
  },
  name: "fn (?*opaque, anyerror!void) void",
});
$(s38, {
  ...s,
  type: 8,
  flags: 396,
  signature: 0x771b102a8d7a0f5dn,
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
        structure: s37,
      },
    ],
    template: o63
  },
  static: {
    members: [],
  },
  name: "*const fn (?*opaque, anyerror!void) void",
});
$(s39, {
  ...s,
  type: 2,
  purpose: 1,
  flags: 14,
  signature: 0x1dd368925fb30621n,
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "ptr",
        type: 5,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: s13,
      },
      {
        ...m,
        name: "callback",
        type: 5,
        flags: 1,
        bitOffset: 64,
        bitSize: 64,
        byteSize: 8,
        slot: 1,
        structure: s38,
      },
    ],
    template: o64
  },
  static: {
    members: [],
  },
  name: "S3",
});
$(s40, {
  ...s,
  type: 12,
  flags: 238,
  signature: 0x077b85be4b50ed1fn,
  length: 3,
  byteSize: 72,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 5,
        flags: 1,
        bitOffset: 512,
        bitSize: 16,
        byteSize: 2,
        slot: 0,
        structure: s21,
      },
      {
        ...m,
        name: "0",
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
        slot: 1,
        structure: s30,
      },
      {
        ...m,
        name: "1",
        type: 5,
        flags: 1,
        bitOffset: 128,
        bitSize: 128,
        byteSize: 16,
        slot: 2,
        structure: s26,
      },
      {
        ...m,
        name: "2",
        type: 5,
        flags: 1,
        bitOffset: 256,
        bitSize: 128,
        byteSize: 16,
        slot: 3,
        structure: s34,
      },
      {
        ...m,
        name: "3",
        type: 5,
        flags: 1,
        bitOffset: 384,
        bitSize: 128,
        byteSize: 16,
        slot: 4,
        structure: s39,
      },
    ],
    template: o67
  },
  static: {
    members: [],
  },
  name: "Arg(fn (Writer, []const u8, []const []const u8, S3) ES1!void)",
});
$(s41, {
  ...s,
  type: 14,
  signature: 0x378c1371960d9f43n,
  length: 3,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 576,
        byteSize: 72,
        structure: s40,
      },
    ],
    template: o68
  },
  static: {
    members: [],
  },
  name: "fn (Writer, []const u8, []const []const u8, S3) ES1!void",
});
$(s42, {
  ...s,
  name: "tar",
  type: 2,
  flags: 256,
  signature: 0x239ab4f327f6ac1bn,
  byteSize: 0,
  align: 1,
  instance: {
    members: [],
  },
  static: {
    members: [
      {
        ...m,
        name: "startup",
        type: 5,
        flags: 2,
        slot: 0,
        structure: s5,
      },
      {
        ...m,
        name: "shutdown",
        type: 5,
        flags: 2,
        slot: 1,
        structure: s19,
      },
      {
        ...m,
        name: "tar",
        type: 5,
        flags: 2,
        slot: 2,
        structure: s41,
      },
    ],
    template: o69
  },
});
const structures = [
  s0, s1, s2, s3, s4, s5, s6, s7, s8, s9,
  s10, s11, s12, s13, s14, s15, s16, s17, s18, s19,
  s20, s21, s22, s23, s24, s25, s26, s27, s28, s29,
  s30, s31, s32, s33, s34, s35, s36, s37, s38, s39,
  s40, s41, s42,
];
const root = s42;
const settings = {
  runtimeSafety: false,
  littleEndian: true,
  ioRedirection: true,
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