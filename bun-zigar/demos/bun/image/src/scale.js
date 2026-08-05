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
const s30 = {}, s31 = {}, s32 = {}, s33 = {}, s34 = {}, s35 = {}, s36 = {};

// declare objects
const o0 = {}, o1 = {}, o2 = {}, o3 = {}, o4 = {}, o5 = {}, o6 = {}, o7 = {}, o8 = {}, o9 = {};
const o10 = {}, o11 = {}, o12 = {}, o13 = {}, o14 = {}, o15 = {}, o16 = {}, o17 = {}, o18 = {}, o19 = {};
const o20 = {}, o21 = {}, o22 = {}, o23 = {}, o24 = {}, o25 = {}, o26 = {}, o27 = {}, o28 = {}, o29 = {};
const o30 = {}, o31 = {}, o32 = {}, o33 = {}, o34 = {}, o35 = {}, o36 = {}, o37 = {}, o38 = {}, o39 = {};
const o40 = {}, o41 = {}, o42 = {}, o43 = {}, o44 = {}, o45 = {}, o46 = {}, o47 = {}, o48 = {}, o49 = {};
const o50 = {}, o51 = {}, o52 = {}, o53 = {}, o54 = {}, o55 = {};

// define byte arrays
const U = i => new Uint8Array(i);
const a0 = U([ 0, 0, 0, 0, 1 ]);
const a1 = U(0);
const a2 = U(6);
const a3 = U(1);
const a4 = U(1);
const a5 = U([ 1 ]);
const a6 = U(32);
const a7 = U([ 0, 0, 0, 0, 0, 0, 0, 0, 1, 0 ]);
const a8 = U(12);
const a9 = U(1);
const a10 = U(32);
const a11 = U([ 0, 1 ]);
const a12 = U(3);
const a13 = U(a5);
const a14 = U(8);
const a15 = U(8);
const a16 = U(1);
const a17 = U(a5);
const a18 = U([ 2 ]);
const a19 = U(32);
const a20 = U(32);
const a21 = U(8);

// fill in object properties
const $ = Object.assign;
$(o0, {});
$(o1, {
  memory: { array: a0 },
});
$(o2, {});
$(o3, {});
$(o4, {
  slots: {
    0: o5, 1: o7, 2: o8,
  },
});
$(o5, {
  structure: s3,
  memory: { array: a1 },
  slots: {
    0: o6,
  },
});
$(o6, {
  structure: s2,
});
$(o7, {
  structure: s6,
  memory: { array: a2 },
});
$(o8, {
  structure: s4,
  memory: { array: a3 },
});
$(o9, {});
$(o10, {
  slots: {
    0: o11, 1: o12,
  },
});
$(o11, {
  structure: s12,
  memory: { array: a4 },
});
$(o12, {
  structure: s12,
  memory: { array: a5 },
});
$(o13, {
  memory: { array: a6 },
  handle: 153332,
  slots: {
    0: o14,
  },
});
$(o14, {
  structure: s10,
  memory: { array: a6, offset: 0, length: 16 },
  slots: {
    0: o15,
  },
});
$(o15, {
  structure: s7,
  memory: { array: a1 },
});
$(o16, {
  memory: { array: a7 },
});
$(o17, {});
$(o18, {});
$(o19, {
  slots: {
    0: o20, 1: o22, 2: o23,
  },
});
$(o20, {
  structure: s3,
  memory: { array: a1 },
  slots: {
    0: o21,
  },
});
$(o21, {
  structure: s15,
});
$(o22, {
  structure: s17,
  memory: { array: a8 },
});
$(o23, {
  structure: s4,
  memory: { array: a9 },
});
$(o24, {});
$(o25, {
  memory: { array: a10 },
  handle: 153332,
  slots: {
    0: o26,
  },
});
$(o26, {
  structure: s19,
  memory: { array: a6, offset: 0, length: 16 },
  slots: {
    0: o27,
  },
});
$(o27, {
  structure: s18,
  memory: { array: a1 },
});
$(o28, {
  memory: { array: a11 },
});
$(o29, {});
$(o30, {
  slots: {
    0: o31, 1: o33, 2: o34,
  },
});
$(o31, {
  structure: s3,
  memory: { array: a1 },
  slots: {
    0: o32,
  },
});
$(o32, {
  structure: s1,
});
$(o33, {
  structure: s22,
  memory: { array: a12 },
});
$(o34, {
  structure: s4,
  memory: { array: a13 },
});
$(o35, {});
$(o36, {
  memory: { array: a14 },
  handle: 153345,
  slots: {
    0: o37,
  },
});
$(o37, {
  structure: s24,
  memory: { array: a15 },
  handle: 153345,
  slots: {
    0: o38,
  },
});
$(o38, {
  structure: s23,
  memory: { array: a1 },
});
$(o39, {
  slots: {
    1: o40, 2: o41, 3: o42,
  },
});
$(o40, {
  structure: s26,
  memory: { array: a16 },
});
$(o41, {
  structure: s26,
  memory: { array: a17 },
});
$(o42, {
  structure: s26,
  memory: { array: a18 },
});
$(o43, {});
$(o44, {});
$(o45, {
  memory: { array: a19 },
  handle: 153332,
  slots: {
    0: o46,
  },
});
$(o46, {
  structure: s28,
  memory: { array: a6, offset: 0, length: 16 },
  slots: {
    0: o15,
  },
});
$(o47, {});
$(o48, {
  memory: { array: a20 },
  handle: 153332,
  slots: {
    0: o49,
  },
});
$(o49, {
  structure: s30,
  memory: { array: a6, offset: 0, length: 16 },
  slots: {
    0: o27,
  },
});
$(o50, {
  memory: { array: a21 },
  handle: 153345,
  slots: {
    0: o37,
  },
});
$(o51, {});
$(o52, {});
$(o53, {
  memory: { array: a1 },
  handle: 115684,
});
$(o54, {
  slots: {
    0: o55,
  },
});
$(o55, {
  structure: s35,
  memory: { array: a1 },
  handle: 92995,
});

// fill in structure properties
$(s0, {
  ...s,
  flags: 1,
  signature: 0xcb1f69cbe6954c96n,
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
  flags: 1,
  signature: 0x9ddcbac74b6ccec3n,
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
        structure: s1,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "u8",
});
$(s2, {
  ...s,
  type: 1,
  flags: 464,
  signature: 0x01bbbac96c660ad0n,
  length: 4,
  byteSize: 4,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 8,
        byteSize: 1,
        structure: s1,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "[4]u8",
});
$(s3, {
  ...s,
  type: 15,
  flags: 9,
  signature: 0x7fd3df143c9cd14an,
  byteSize: 0,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 6,
        slot: 0,
        structure: s3,
      },
    ],
    template: o0
  },
  static: {
    members: [],
  },
  name: "type",
});
$(s4, {
  ...s,
  flags: 1,
  signature: 0x31a09f12f6815cbdn,
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
        structure: s4,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "bool",
});
$(s5, {
  ...s,
  type: 2,
  flags: 10,
  signature: 0xebe67331912c712an,
  byteSize: 5,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        name: "value",
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 32,
        byteSize: 4,
        slot: 0,
        structure: s2,
      },
      {
        ...m,
        name: "is_required",
        type: 1,
        bitOffset: 32,
        bitSize: 1,
        byteSize: 1,
        slot: 1,
        structure: s4,
      },
    ],
    template: o1
  },
  static: {
    members: [],
  },
  name: "S0",
});
$(s6, {
  ...s,
  type: 7,
  flags: 43,
  signature: 0x7efb3eebc51718e6n,
  byteSize: 6,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 40,
        byteSize: 5,
        bitOffset: 0,
        slot: 0,
        structure: s5,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitOffset: 40,
        bitSize: 8,
        byteSize: 1,
        structure: s1,
      },
    ],
    template: o2
  },
  static: {
    members: [],
  },
  name: "?S0",
});
$(s7, {
  ...s,
  type: 9,
  flags: 410,
  signature: 0x5f7d4e08c57793e9n,
  byteSize: 4,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 32,
        byteSize: 4,
        structure: s2,
      },
    ],
    template: o3
  },
  static: {
    members: [],
    template: o4
  },
  name: "[_][4]u8",
});
$(s8, {
  ...s,
  flags: 1,
  signature: 0x209c47faded1c824n,
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
        structure: s8,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "u64",
});
$(s9, {
  ...s,
  flags: 33,
  signature: 0x2ee9c2d7fc6b1e44n,
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
        structure: s9,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "usize",
});
$(s10, {
  ...s,
  type: 8,
  flags: 380,
  signature: 0xc82aea63f0206cd4n,
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
        structure: s7,
      },
      {
        ...m,
        type: 3,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: s8,
      },
      {
        ...m,
        type: 3,
        bitOffset: 64,
        bitSize: 64,
        byteSize: 8,
        structure: s9,
      },
    ],
    template: o9
  },
  static: {
    members: [],
  },
  name: "[]const [4]u8",
});
$(s11, {
  ...s,
  flags: 1,
  signature: 0xa0953051ee32940an,
  byteSize: 4,
  align: 4,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 32,
        byteSize: 4,
        bitOffset: 0,
        structure: s11,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "u32",
});
$(s12, {
  ...s,
  type: 6,
  flags: 1,
  signature: 0xb8bcea51494b4eb3n,
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 1,
        byteSize: 1,
        bitOffset: 0,
        structure: s12,
      },
    ],
  },
  static: {
    members: [
      {
        ...m,
        name: "srgb",
        type: 5,
        flags: 4,
        slot: 0,
        structure: s12,
      },
      {
        ...m,
        name: "display-p3",
        type: 5,
        flags: 4,
        slot: 1,
        structure: s12,
      },
    ],
    template: o10
  },
  name: "EN0",
});
$(s13, {
  ...s,
  type: 2,
  purpose: 9,
  flags: 14,
  signature: 0x4764ee5e7b3e2246n,
  byteSize: 32,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "data",
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
        slot: 0,
        structure: s10,
      },
      {
        ...m,
        name: "width",
        type: 3,
        flags: 1,
        bitOffset: 128,
        bitSize: 32,
        byteSize: 4,
        slot: 1,
        structure: s11,
      },
      {
        ...m,
        name: "height",
        type: 3,
        flags: 1,
        bitOffset: 160,
        bitSize: 32,
        byteSize: 4,
        slot: 2,
        structure: s11,
      },
      {
        ...m,
        name: "colorSpace",
        type: 3,
        bitOffset: 192,
        bitSize: 1,
        byteSize: 1,
        slot: 3,
        structure: s12,
      },
    ],
    template: o13
  },
  static: {
    members: [],
  },
  name: "S1",
});
$(s14, {
  ...s,
  flags: 1,
  signature: 0x92399f17de7db807n,
  byteSize: 2,
  align: 2,
  instance: {
    members: [
      {
        ...m,
        type: 4,
        bitSize: 16,
        byteSize: 2,
        bitOffset: 0,
        structure: s14,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "f16",
});
$(s15, {
  ...s,
  type: 1,
  flags: 144,
  signature: 0x8b48dd32f9b1f164n,
  length: 4,
  byteSize: 8,
  align: 2,
  instance: {
    members: [
      {
        ...m,
        type: 4,
        bitSize: 16,
        byteSize: 2,
        structure: s14,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "[4]f16",
});
$(s16, {
  ...s,
  type: 2,
  flags: 10,
  signature: 0x46bdb01dbd156620n,
  byteSize: 10,
  align: 2,
  instance: {
    members: [
      {
        ...m,
        name: "value",
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: s15,
      },
      {
        ...m,
        name: "is_required",
        type: 1,
        bitOffset: 64,
        bitSize: 1,
        byteSize: 1,
        slot: 1,
        structure: s4,
      },
    ],
    template: o16
  },
  static: {
    members: [],
  },
  name: "S2",
});
$(s17, {
  ...s,
  type: 7,
  flags: 43,
  signature: 0x24013fa005d07adfn,
  byteSize: 12,
  align: 2,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 80,
        byteSize: 10,
        bitOffset: 0,
        slot: 0,
        structure: s16,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitOffset: 80,
        bitSize: 8,
        byteSize: 1,
        structure: s1,
      },
    ],
    template: o17
  },
  static: {
    members: [],
  },
  name: "?S2",
});
$(s18, {
  ...s,
  type: 9,
  flags: 154,
  signature: 0x1f99bbb644993974n,
  byteSize: 8,
  align: 2,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 64,
        byteSize: 8,
        structure: s15,
      },
    ],
    template: o18
  },
  static: {
    members: [],
    template: o19
  },
  name: "[_][4]f16",
});
$(s19, {
  ...s,
  type: 8,
  flags: 380,
  signature: 0xe816348a39454434n,
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
        structure: s18,
      },
      {
        ...m,
        type: 3,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: s8,
      },
      {
        ...m,
        type: 3,
        bitOffset: 64,
        bitSize: 64,
        byteSize: 8,
        structure: s9,
      },
    ],
    template: o24
  },
  static: {
    members: [],
  },
  name: "[]const [4]f16",
});
$(s20, {
  ...s,
  type: 2,
  purpose: 9,
  flags: 14,
  signature: 0x55622539a54e413an,
  byteSize: 32,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "data",
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
        slot: 0,
        structure: s19,
      },
      {
        ...m,
        name: "width",
        type: 3,
        flags: 1,
        bitOffset: 128,
        bitSize: 32,
        byteSize: 4,
        slot: 1,
        structure: s11,
      },
      {
        ...m,
        name: "height",
        type: 3,
        flags: 1,
        bitOffset: 160,
        bitSize: 32,
        byteSize: 4,
        slot: 2,
        structure: s11,
      },
      {
        ...m,
        name: "colorSpace",
        type: 3,
        bitOffset: 192,
        bitSize: 1,
        byteSize: 1,
        slot: 3,
        structure: s12,
      },
    ],
    template: o25
  },
  static: {
    members: [],
  },
  name: "S3",
});
$(s21, {
  ...s,
  type: 2,
  signature: 0x03fe2ef485ad3365n,
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
        structure: s1,
      },
      {
        ...m,
        name: "is_required",
        type: 1,
        bitOffset: 8,
        bitSize: 1,
        byteSize: 1,
        slot: 1,
        structure: s4,
      },
    ],
    template: o28
  },
  static: {
    members: [],
  },
  name: "S4",
});
$(s22, {
  ...s,
  type: 7,
  flags: 43,
  signature: 0x9547fe6aa04d896dn,
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
        structure: s21,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitOffset: 16,
        bitSize: 8,
        byteSize: 1,
        structure: s1,
      },
    ],
    template: o29
  },
  static: {
    members: [],
  },
  name: "?S4",
});
$(s23, {
  ...s,
  type: 9,
  flags: 976,
  signature: 0x3ee4c60c00bcc22cn,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 8,
        byteSize: 1,
        structure: s1,
      },
    ],
  },
  static: {
    members: [],
    template: o30
  },
  name: "anyopaque",
});
$(s24, {
  ...s,
  type: 8,
  flags: 668,
  signature: 0x83a54d808cf88dd6n,
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
        structure: s23,
      },
      {
        ...m,
        type: 3,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: s8,
      },
    ],
    template: o35
  },
  static: {
    members: [],
  },
  name: "*opaque",
});
$(s25, {
  ...s,
  type: 2,
  purpose: 11,
  flags: 14,
  signature: 0xe9d605263183ffe4n,
  byteSize: 8,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "ptr",
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: s24,
      },
    ],
    template: o36
  },
  static: {
    members: [],
  },
  name: "S5",
});
$(s26, {
  ...s,
  name: "Format",
  type: 6,
  flags: 1,
  signature: 0x62603de91bd3d3abn,
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 2,
        byteSize: 1,
        bitOffset: 0,
        structure: s26,
      },
    ],
  },
  static: {
    members: [
      {
        ...m,
        name: "web",
        type: 5,
        flags: 4,
        slot: 1,
        structure: s26,
      },
      {
        ...m,
        name: "web_hdr",
        type: 5,
        flags: 4,
        slot: 2,
        structure: s26,
      },
      {
        ...m,
        name: "gd",
        type: 5,
        flags: 4,
        slot: 3,
        structure: s26,
      },
    ],
    template: o39
  },
});
$(s27, {
  ...s,
  type: 3,
  purpose: 8,
  flags: 110,
  signature: 0xa46f52736eb522a5n,
  byteSize: 40,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "web",
        type: 5,
        bitOffset: 0,
        bitSize: 256,
        byteSize: 32,
        slot: 0,
        structure: s13,
      },
      {
        ...m,
        name: "web_hdr",
        type: 5,
        bitOffset: 0,
        bitSize: 256,
        byteSize: 32,
        slot: 1,
        structure: s20,
      },
      {
        ...m,
        name: "gd",
        type: 5,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 2,
        structure: s25,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitOffset: 256,
        bitSize: 2,
        byteSize: 1,
        structure: s26,
      },
    ],
    template: o43
  },
  static: {
    members: [],
  },
  name: "U0",
});
$(s28, {
  ...s,
  type: 8,
  flags: 124,
  signature: 0x92f6aef4878be491n,
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
        structure: s7,
      },
      {
        ...m,
        type: 3,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: s8,
      },
      {
        ...m,
        type: 3,
        bitOffset: 64,
        bitSize: 64,
        byteSize: 8,
        structure: s9,
      },
    ],
    template: o44
  },
  static: {
    members: [],
  },
  name: "[][4]u8",
});
$(s29, {
  ...s,
  type: 2,
  purpose: 9,
  flags: 14,
  signature: 0x1aff04a1f8782ec2n,
  byteSize: 32,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "data",
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
        slot: 0,
        structure: s28,
      },
      {
        ...m,
        name: "width",
        type: 3,
        flags: 1,
        bitOffset: 128,
        bitSize: 32,
        byteSize: 4,
        slot: 1,
        structure: s11,
      },
      {
        ...m,
        name: "height",
        type: 3,
        flags: 1,
        bitOffset: 160,
        bitSize: 32,
        byteSize: 4,
        slot: 2,
        structure: s11,
      },
      {
        ...m,
        name: "colorSpace",
        type: 3,
        bitOffset: 192,
        bitSize: 1,
        byteSize: 1,
        slot: 3,
        structure: s12,
      },
    ],
    template: o45
  },
  static: {
    members: [],
  },
  name: "S6",
});
$(s30, {
  ...s,
  type: 8,
  flags: 124,
  signature: 0x76cad0aae5ec8d10n,
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
        structure: s18,
      },
      {
        ...m,
        type: 3,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: s8,
      },
      {
        ...m,
        type: 3,
        bitOffset: 64,
        bitSize: 64,
        byteSize: 8,
        structure: s9,
      },
    ],
    template: o47
  },
  static: {
    members: [],
  },
  name: "[][4]f16",
});
$(s31, {
  ...s,
  type: 2,
  purpose: 9,
  flags: 14,
  signature: 0x1dfeffa19a825703n,
  byteSize: 32,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "data",
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
        slot: 0,
        structure: s30,
      },
      {
        ...m,
        name: "width",
        type: 3,
        flags: 1,
        bitOffset: 128,
        bitSize: 32,
        byteSize: 4,
        slot: 1,
        structure: s11,
      },
      {
        ...m,
        name: "height",
        type: 3,
        flags: 1,
        bitOffset: 160,
        bitSize: 32,
        byteSize: 4,
        slot: 2,
        structure: s11,
      },
      {
        ...m,
        name: "colorSpace",
        type: 3,
        bitOffset: 192,
        bitSize: 1,
        byteSize: 1,
        slot: 3,
        structure: s12,
      },
    ],
    template: o48
  },
  static: {
    members: [],
  },
  name: "S7",
});
$(s32, {
  ...s,
  type: 2,
  purpose: 11,
  flags: 14,
  signature: 0xe9d605263183ffe4n,
  byteSize: 8,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "ptr",
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: s24,
      },
    ],
    template: o50
  },
  static: {
    members: [],
  },
  name: "S8",
});
$(s33, {
  ...s,
  type: 3,
  purpose: 8,
  flags: 110,
  signature: 0xab25bae3c340b94dn,
  byteSize: 40,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "web",
        type: 5,
        bitOffset: 0,
        bitSize: 256,
        byteSize: 32,
        slot: 0,
        structure: s29,
      },
      {
        ...m,
        name: "web_hdr",
        type: 5,
        bitOffset: 0,
        bitSize: 256,
        byteSize: 32,
        slot: 1,
        structure: s31,
      },
      {
        ...m,
        name: "gd",
        type: 5,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 2,
        structure: s32,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitOffset: 256,
        bitSize: 2,
        byteSize: 1,
        structure: s26,
      },
    ],
    template: o51
  },
  static: {
    members: [],
  },
  name: "U1",
});
$(s34, {
  ...s,
  type: 12,
  flags: 14,
  signature: 0x9fcaf53c79b6dadfn,
  length: 2,
  byteSize: 80,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        flags: 1,
        bitOffset: 640,
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
        bitSize: 320,
        byteSize: 40,
        slot: 1,
        structure: s27,
      },
      {
        ...m,
        name: "1",
        type: 5,
        flags: 1,
        bitOffset: 320,
        bitSize: 320,
        byteSize: 40,
        slot: 2,
        structure: s33,
      },
    ],
    template: o52
  },
  static: {
    members: [],
  },
  name: "Arg(fn (U0, U1) void)",
});
$(s35, {
  ...s,
  type: 14,
  signature: 0xc5ec3ab469bfbcd8n,
  length: 2,
  byteSize: 0,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        structure: s34,
      },
    ],
    template: o53
  },
  static: {
    members: [],
  },
  name: "fn (U0, U1) void",
});
$(s36, {
  ...s,
  name: "scale",
  type: 2,
  flags: 256,
  signature: 0xa8a31dac43a38551n,
  byteSize: 0,
  align: 1,
  instance: {
    members: [],
  },
  static: {
    members: [
      {
        ...m,
        name: "scale",
        type: 5,
        flags: 2,
        slot: 0,
        structure: s35,
      },
    ],
    template: o54
  },
});
const structures = [
  s0, s1, s2, s3, s4, s5, s6, s7, s8, s9,
  s10, s11, s12, s13, s14, s15, s16, s17, s18, s19,
  s20, s21, s22, s23, s24, s25, s26, s27, s28, s29,
  s30, s31, s32, s33, s34, s35, s36,
];
const root = s36;
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
env.loadModule(resolve(__dirname, "../lib/scale.zigar", moduleName));
env.linkVariables(false);

// export root namespace and its methods and constants
const { constructor: v0 } = root;
const v1 = env.getSpecialExports();
const {
  scale: v2,
} = v0;
export {
  v0 as default,
  v1 as __zigar,
  v2 as scale,
};

function getPlatform() {
  let platform = os.platform();
  if (platform === "linux") {
    if (process.__gnu === void 0)
      if (process.versions?.electron || process.__nwjs)
        process.__gnu = !0;
      else {
        const list = [];
        try {
          const { closeSync, openSync, readSync } = require$1("fs"), fd = openSync(process.execPath, "r"), sig = new Uint8Array(8);
          readSync(fd, sig);
          for (const [index, value] of ["\x7F", "E", "L", "F"].entries())
            if (sig[index] !== value.charCodeAt(0))
              throw Error("Incorrect magic number");
          const bits = sig[4] * 32, le = sig[5] === 1, Ehdr = bits === 64 ? { size: 64, e_shoff: 40, e_shnum: 60 } : { size: 52, e_shoff: 32, e_shnum: 48 }, Shdr = bits === 64 ? { size: 64, sh_type: 4, sh_offset: 24, sh_size: 32, sh_link: 40 } : { size: 40, sh_type: 4, sh_offset: 16, sh_size: 20, sh_link: 24 }, Dyn = bits === 64 ? { size: 16, d_tag: 0, d_val: 8 } : { size: 8, d_tag: 0, d_val: 4 }, Usize = bits === 64 ? BigInt : Number, read = (position, size) => {
            const buf = new DataView(new ArrayBuffer(Number(size)));
            readSync(fd, buf, { position: Number(position) });
            buf.getUsize = bits === 64 ? buf.getBigUint64 : buf.getUint32;
            return buf;
          }, SHT_DYNAMIC = 6, DT_NEEDED = 1, ehdr = read(0, Ehdr.size);
          let position = ehdr.getUsize(Ehdr.e_shoff, le);
          const sectionCount = ehdr.getUint16(Ehdr.e_shnum, le), shdrs = [];
          for (let i = 0;i < sectionCount; i++, position += Usize(Shdr.size))
            shdrs.push(read(position, Shdr.size));
          for (const shdr of shdrs)
            if (shdr.getUint32(Shdr.sh_type, le) == SHT_DYNAMIC) {
              const link = shdr.getUint32(Shdr.sh_link, le), strTableOffset = shdrs[link].getUsize(Shdr.sh_offset, le), strTableSize = shdrs[link].getUsize(Shdr.sh_size, le), strTable = read(strTableOffset, strTableSize), dynamicOffset = shdr.getUsize(Shdr.sh_offset, le), dynamicSize = shdr.getUsize(Shdr.sh_size, le), entryCount = Number(dynamicSize / Usize(Dyn.size));
              position = dynamicOffset;
              for (let i = 0;i < entryCount; i++, position += Usize(Dyn.size)) {
                const entry = read(position, Dyn.size);
                if (entry.getUsize(Dyn.d_tag, le) === Usize(DT_NEEDED)) {
                  let offset = entry.getUsize(Dyn.d_val, le), name = "", c;
                  while (c = strTable.getUint8(Number(offset++)))
                    name += String.fromCharCode(c);
                  list.push(name);
                }
              }
            }
          closeSync(fd);
        } catch (err) {}
        process.__gnu = list.length > 0 ? list.indexOf("libc.so.6") != -1 : !0;
      }
    if (!process.__gnu)
      platform += "-musl";
  }
  return platform;
}

function getArch() {
  return os.arch();
}

function getLibraryExt(platform) {
  switch (platform) {
    case "win32":
      return "dll";
    case "darwin":
      return "dylib";
    default:
      return "so";
  }
}