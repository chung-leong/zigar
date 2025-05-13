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
const s30 = {}, s31 = {}, s32 = {}, s33 = {}, s34 = {}, s35 = {}, s36 = {}, s37 = {}, s38 = {}, s39 = {};
const s40 = {}, s41 = {}, s42 = {}, s43 = {}, s44 = {}, s45 = {}, s46 = {}, s47 = {}, s48 = {}, s49 = {};
const s50 = {}, s51 = {}, s52 = {}, s53 = {}, s54 = {}, s55 = {}, s56 = {}, s57 = {}, s58 = {}, s59 = {};
const s60 = {}, s61 = {}, s62 = {}, s63 = {}, s64 = {}, s65 = {}, s66 = {}, s67 = {}, s68 = {}, s69 = {};
const s70 = {}, s71 = {}, s72 = {}, s73 = {}, s74 = {}, s75 = {}, s76 = {}, s77 = {}, s78 = {}, s79 = {};
const s80 = {}, s81 = {}, s82 = {}, s83 = {}, s84 = {}, s85 = {}, s86 = {}, s87 = {}, s88 = {}, s89 = {};
const s90 = {}, s91 = {}, s92 = {}, s93 = {}, s94 = {}, s95 = {}, s96 = {}, s97 = {}, s98 = {}, s99 = {};
const s100 = {}, s101 = {}, s102 = {}, s103 = {}, s104 = {}, s105 = {}, s106 = {}, s107 = {}, s108 = {}, s109 = {};
const s110 = {}, s111 = {}, s112 = {}, s113 = {}, s114 = {}, s115 = {}, s116 = {}, s117 = {}, s118 = {}, s119 = {};
const s120 = {}, s121 = {}, s122 = {}, s123 = {};

// declare objects
const o0 = {}, o1 = {}, o2 = {}, o3 = {}, o4 = {}, o5 = {}, o6 = {}, o7 = {}, o8 = {}, o9 = {};
const o10 = {}, o11 = {}, o12 = {}, o13 = {}, o14 = {}, o15 = {}, o16 = {}, o17 = {}, o18 = {}, o19 = {};
const o20 = {}, o21 = {}, o22 = {}, o23 = {}, o24 = {}, o25 = {}, o26 = {}, o27 = {}, o28 = {}, o29 = {};
const o30 = {}, o31 = {}, o32 = {}, o33 = {}, o34 = {}, o35 = {}, o36 = {}, o37 = {}, o38 = {}, o39 = {};
const o40 = {}, o41 = {}, o42 = {}, o43 = {}, o44 = {}, o45 = {}, o46 = {}, o47 = {}, o48 = {}, o49 = {};
const o50 = {}, o51 = {}, o52 = {}, o53 = {}, o54 = {}, o55 = {}, o56 = {}, o57 = {}, o58 = {}, o59 = {};
const o60 = {}, o61 = {}, o62 = {}, o63 = {}, o64 = {}, o65 = {}, o66 = {}, o67 = {}, o68 = {}, o69 = {};
const o70 = {}, o71 = {}, o72 = {}, o73 = {}, o74 = {}, o75 = {}, o76 = {}, o77 = {}, o78 = {}, o79 = {};
const o80 = {}, o81 = {}, o82 = {}, o83 = {}, o84 = {}, o85 = {}, o86 = {}, o87 = {}, o88 = {}, o89 = {};
const o90 = {}, o91 = {}, o92 = {}, o93 = {}, o94 = {}, o95 = {}, o96 = {}, o97 = {}, o98 = {}, o99 = {};
const o100 = {}, o101 = {}, o102 = {}, o103 = {}, o104 = {}, o105 = {}, o106 = {}, o107 = {}, o108 = {}, o109 = {};
const o110 = {}, o111 = {}, o112 = {}, o113 = {}, o114 = {}, o115 = {}, o116 = {}, o117 = {}, o118 = {}, o119 = {};
const o120 = {}, o121 = {}, o122 = {}, o123 = {}, o124 = {}, o125 = {}, o126 = {}, o127 = {}, o128 = {}, o129 = {};
const o130 = {}, o131 = {}, o132 = {}, o133 = {}, o134 = {}, o135 = {}, o136 = {}, o137 = {}, o138 = {}, o139 = {};
const o140 = {}, o141 = {}, o142 = {}, o143 = {}, o144 = {}, o145 = {}, o146 = {}, o147 = {}, o148 = {}, o149 = {};
const o150 = {}, o151 = {}, o152 = {}, o153 = {}, o154 = {}, o155 = {}, o156 = {}, o157 = {}, o158 = {}, o159 = {};
const o160 = {}, o161 = {}, o162 = {}, o163 = {}, o164 = {}, o165 = {}, o166 = {}, o167 = {}, o168 = {}, o169 = {};
const o170 = {}, o171 = {}, o172 = {}, o173 = {}, o174 = {}, o175 = {}, o176 = {}, o177 = {}, o178 = {}, o179 = {};
const o180 = {}, o181 = {}, o182 = {}, o183 = {}, o184 = {}, o185 = {}, o186 = {}, o187 = {}, o188 = {}, o189 = {};
const o190 = {}, o191 = {}, o192 = {}, o193 = {}, o194 = {}, o195 = {}, o196 = {}, o197 = {}, o198 = {}, o199 = {};
const o200 = {}, o201 = {}, o202 = {}, o203 = {}, o204 = {}, o205 = {}, o206 = {}, o207 = {}, o208 = {}, o209 = {};
const o210 = {}, o211 = {}, o212 = {}, o213 = {}, o214 = {}, o215 = {}, o216 = {};

// define byte arrays
const U = i => new Uint8Array(i);
const a0 = U(1);
const a1 = U(1);
const a2 = U(1);
const a3 = U(0);
const a4 = U(8);
const a5 = U([ 0, 0, 0, 0, 0, 0, 240, 63 ]);
const a6 = U(8);
const a7 = U([ 4 ]);
const a8 = U(a7);
const a9 = U([ 29, 142, 41, 80, 99, 127, 0, 0 ]);
const a10 = U([ 65, 73, 70, 0 ]);
const a11 = U([ 169, 137, 41, 80, 99, 127, 0, 0 ]);
const a12 = U([ 65, 100, 111, 98, 101, 32, 83, 121, 115, 116, 101, 109, 115, 0 ]);
const a13 = U([ 2 ]);
const a14 = U([ 29, 138, 41, 80, 99, 127, 0, 0 ]);
const a15 = U([ 97, 32, 118, 97, 114, 105, 97, 98, 108, 101, 32, 115, 101, 112, 105, 97, 32, 102, 105, 108, 116, 101, 114, 0 ]);
const a16 = U(1);
const a17 = U([ 1 ]);
const a18 = U(32);
const a19 = U(a7);
const a20 = U(32);
const a21 = U(32);
const a22 = U(32);
const a23 = U(a7);
const a24 = U(32);
const a25 = U(32);
const a26 = U(4);
const a27 = U([ 1, 0 ]);
const a28 = U(1);
const a29 = U(a17);
const a30 = U(a13);
const a31 = U([ 3 ]);
const a32 = U(a7);
const a33 = U([ 5 ]);
const a34 = U(1);
const a35 = U(a17);
const a36 = U(a13);
const a37 = U(1);
const a38 = U(a17);
const a39 = U(a13);
const a40 = U(a31);
const a41 = U(a7);
const a42 = U(a33);
const a43 = U([ 6 ]);
const a44 = U(32);
const a45 = U(a27);
const a46 = U(16);
const a47 = U(a27);
const a48 = U([ 2, 0 ]);
const a49 = U([ 3, 0 ]);
const a50 = U([ 4, 0 ]);
const a51 = U([ 5, 0 ]);
const a52 = U([ 6, 0 ]);
const a53 = U([ 7, 0 ]);
const a54 = U([ 8, 0 ]);
const a55 = U([ 9, 0 ]);
const a56 = U([ 10, 0 ]);
const a57 = U([ 11, 0 ]);
const a58 = U([ 12, 0 ]);
const a59 = U([ 13, 0 ]);
const a60 = U([ 14, 0 ]);
const a61 = U([ 15, 0 ]);
const a62 = U([ 16, 0 ]);
const a63 = U([ 17, 0 ]);
const a64 = U([ 18, 0 ]);
const a65 = U([ 19, 0 ]);
const a66 = U([ 20, 0 ]);
const a67 = U([ 21, 0 ]);
const a68 = U([ 22, 0 ]);
const a69 = U([ 23, 0 ]);
const a70 = U([ 24, 0 ]);
const a71 = U([ 25, 0 ]);
const a72 = U([ 40, 0 ]);
const a73 = U([ 48, 0 ]);
const a74 = U([ 49, 0 ]);
const a75 = U([ 50, 0 ]);
const a76 = U([ 51, 0 ]);
const a77 = U([ 52, 0 ]);
const a78 = U(16);
const a79 = U(a27);
const a80 = U(a73);
const a81 = U([ 53, 0 ]);
const a82 = U(16);
const a83 = U(8);
const a84 = U(8);

// fill in object properties
const $ = Object.assign;
$(o0, {
  memory: { array: a0 },
});
$(o1, {
  memory: { array: a1 },
});
$(o2, {
  memory: { array: a2 },
});
$(o3, {
  slots: {
    0: o4, 1: o6, 2: o8, 3: o10,
  },
});
$(o4, {
  structure: s0,
  memory: { array: a3 },
  slots: {
    0: o5,
  },
});
$(o5, {
  structure: s10,
});
$(o6, {
  structure: s9,
  memory: { array: a3 },
  slots: {
    0: o7,
  },
});
$(o7, {
  structure: s11,
  memory: { array: a4 },
  const: true,
});
$(o8, {
  structure: s9,
  memory: { array: a3 },
  slots: {
    0: o9,
  },
});
$(o9, {
  structure: s11,
  memory: { array: a5 },
  const: true,
});
$(o10, {
  structure: s9,
  memory: { array: a3 },
  slots: {
    0: o11,
  },
});
$(o11, {
  structure: s11,
  memory: { array: a6 },
  const: true,
});
$(o12, {
  slots: {
    0: o13,
  },
});
$(o13, {
  structure: s12,
  memory: { array: a3 },
  slots: {
    0: o4, 1: o6, 2: o8, 3: o10,
  },
});
$(o14, {
  slots: {
    0: o15,
  },
});
$(o15, {
  structure: s6,
  memory: { array: a3 },
  slots: {
    0: o16,
  },
});
$(o16, {
  structure: s1,
  memory: { array: a7 },
  const: true,
});
$(o17, {
  slots: {
    0: o18,
  },
});
$(o18, {
  structure: s14,
  memory: { array: a3 },
  slots: {
    0: o15,
  },
});
$(o19, {
  slots: {
    0: o20,
  },
});
$(o20, {
  structure: s6,
  memory: { array: a3 },
  slots: {
    0: o21,
  },
});
$(o21, {
  structure: s1,
  memory: { array: a8 },
  const: true,
});
$(o22, {
  slots: {
    0: o23,
  },
});
$(o23, {
  structure: s16,
  memory: { array: a3 },
  slots: {
    0: o20,
  },
});
$(o24, {
  slots: {
    0: o25, 1: o27, 2: o29, 3: o31, 4: o33, 5: o34, 6: o35,
  },
});
$(o25, {
  structure: s3,
  memory: { array: a9 },
  handle: 66651,
  slots: {
    0: o26,
  },
});
$(o26, {
  structure: s2,
  memory: { array: a10 },
});
$(o27, {
  structure: s5,
  memory: { array: a11 },
  handle: 66664,
  slots: {
    0: o28,
  },
});
$(o28, {
  structure: s4,
  memory: { array: a12 },
});
$(o29, {
  structure: s6,
  memory: { array: a3 },
  slots: {
    0: o30,
  },
});
$(o30, {
  structure: s1,
  memory: { array: a13 },
  const: true,
});
$(o31, {
  structure: s8,
  memory: { array: a14 },
  handle: 66677,
  slots: {
    0: o32,
  },
});
$(o32, {
  structure: s7,
  memory: { array: a15 },
});
$(o33, {
  structure: s13,
  memory: { array: a3 },
  slots: {
    0: o13,
  },
});
$(o34, {
  structure: s15,
  memory: { array: a3 },
  slots: {
    0: o18,
  },
});
$(o35, {
  structure: s17,
  memory: { array: a3 },
  slots: {
    0: o23,
  },
});
$(o36, {
  slots: {
    0: o37, 1: o38,
  },
});
$(o37, {
  structure: s23,
  memory: { array: a16 },
  const: true,
});
$(o38, {
  structure: s23,
  memory: { array: a17 },
  const: true,
});
$(o39, {
  memory: { array: a18 },
  handle: 106038,
  slots: {
    0: o40,
  },
});
$(o40, {
  structure: s21,
  memory: { array: a18, offset: 0, length: 16 },
  slots: {
    0: o41,
  },
});
$(o41, {
  structure: s20,
  memory: { array: a3 },
});
$(o42, {
  slots: {
    0: o43, 1: o45, 2: o47,
  },
});
$(o43, {
  structure: s0,
  memory: { array: a3 },
  slots: {
    0: o44,
  },
});
$(o44, {
  structure: s19,
});
$(o45, {
  structure: s0,
  memory: { array: a3 },
  slots: {
    0: o46,
  },
});
$(o46, {
  structure: s24,
});
$(o47, {
  structure: s6,
  memory: { array: a3 },
  slots: {
    0: o48,
  },
});
$(o48, {
  structure: s1,
  memory: { array: a19 },
  const: true,
});
$(o49, {
  memory: { array: a20 },
  handle: 106038,
  slots: {
    0: o50,
  },
});
$(o50, {
  structure: s25,
  memory: { array: a21 },
  handle: 106038,
  slots: {
    0: o40,
  },
});
$(o51, {
  memory: { array: a22 },
  handle: 106038,
  slots: {
    0: o52,
  },
});
$(o52, {
  structure: s27,
  memory: { array: a18, offset: 0, length: 16 },
  slots: {
    0: o41,
  },
});
$(o53, {
  slots: {
    0: o54, 1: o55, 2: o56,
  },
});
$(o54, {
  structure: s0,
  memory: { array: a3 },
  slots: {
    0: o44,
  },
});
$(o55, {
  structure: s0,
  memory: { array: a3 },
  slots: {
    0: o46,
  },
});
$(o56, {
  structure: s6,
  memory: { array: a3 },
  slots: {
    0: o57,
  },
});
$(o57, {
  structure: s1,
  memory: { array: a23 },
  const: true,
});
$(o58, {
  memory: { array: a24 },
  handle: 106038,
  slots: {
    0: o59,
  },
});
$(o59, {
  structure: s28,
  memory: { array: a25 },
  handle: 106038,
  slots: {
    0: o52,
  },
});
$(o60, {
  memory: { array: a26 },
});
$(o61, {
  slots: {
    0: o62,
  },
});
$(o62, {
  structure: s31,
  memory: { array: a27 },
  const: true,
});
$(o63, {
  memory: { array: a3 },
  handle: 133126,
});
$(o64, {
  memory: { array: a3 },
  handle: 133139,
});
$(o65, {
  memory: { array: a3 },
  handle: 142483,
});
$(o66, {
  memory: { array: a3 },
  handle: 142496,
});
$(o67, {
  memory: { array: a3 },
  handle: 142522,
});
$(o68, {
  slots: {
    0: o69, 1: o70, 2: o71, 3: o72, 4: o73, 5: o74, 6: o75,
  },
});
$(o69, {
  structure: s50,
  memory: { array: a3 },
  handle: 142470,
});
$(o70, {
  structure: s51,
  memory: { array: a28 },
  const: true,
});
$(o71, {
  structure: s51,
  memory: { array: a29 },
  const: true,
});
$(o72, {
  structure: s51,
  memory: { array: a30 },
  const: true,
});
$(o73, {
  structure: s51,
  memory: { array: a31 },
  const: true,
});
$(o74, {
  structure: s51,
  memory: { array: a32 },
  const: true,
});
$(o75, {
  structure: s51,
  memory: { array: a33 },
  const: true,
});
$(o76, {
  memory: { array: a3 },
  handle: 142509,
});
$(o77, {
  slots: {
    0: o78, 1: o79, 2: o80, 3: o81, 4: o82, 5: o83,
  },
});
$(o78, {
  structure: s44,
  memory: { array: a3 },
  handle: 142285,
});
$(o79, {
  structure: s47,
  memory: { array: a3 },
  handle: 142354,
});
$(o80, {
  structure: s53,
  memory: { array: a3 },
  handle: 142418,
});
$(o81, {
  structure: s54,
  memory: { array: a34 },
  const: true,
});
$(o82, {
  structure: s54,
  memory: { array: a35 },
  const: true,
});
$(o83, {
  structure: s54,
  memory: { array: a36 },
  const: true,
});
$(o84, {
  memory: { array: a3 },
  handle: 135195,
});
$(o85, {
  memory: { array: a3 },
  handle: 137405,
});
$(o86, {
  memory: { array: a3 },
  handle: 137418,
});
$(o87, {
  memory: { array: a3 },
  handle: 137431,
});
$(o88, {
  memory: { array: a3 },
  handle: 137444,
});
$(o89, {
  slots: {
    0: o90, 1: o91, 2: o92, 3: o93, 4: o94, 5: o95, 6: o96, 7: o97, 8: o98, 9: o99,
    10: o100, 11: o101, 12: o102, 13: o103, 14: o104, 15: o105,
  },
});
$(o90, {
  structure: s40,
  memory: { array: a3 },
  handle: 131609,
});
$(o91, {
  structure: s42,
  memory: { array: a3 },
  handle: 131653,
});
$(o92, {
  structure: s56,
  memory: { array: a3 },
  handle: 131717,
});
$(o93, {
  structure: s58,
  memory: { array: a3 },
  handle: 131797,
});
$(o94, {
  structure: s60,
  memory: { array: a3 },
  handle: 131861,
});
$(o95, {
  structure: s60,
  memory: { array: a3 },
  handle: 131874,
});
$(o96, {
  structure: s62,
  memory: { array: a3 },
  handle: 131929,
});
$(o97, {
  structure: s62,
  memory: { array: a3 },
  handle: 131942,
});
$(o98, {
  structure: s64,
  memory: { array: a3 },
  handle: 131998,
});
$(o99, {
  structure: s65,
  memory: { array: a37 },
  const: true,
});
$(o100, {
  structure: s65,
  memory: { array: a38 },
  const: true,
});
$(o101, {
  structure: s65,
  memory: { array: a39 },
  const: true,
});
$(o102, {
  structure: s65,
  memory: { array: a40 },
  const: true,
});
$(o103, {
  structure: s65,
  memory: { array: a41 },
  const: true,
});
$(o104, {
  structure: s65,
  memory: { array: a42 },
  const: true,
});
$(o105, {
  structure: s65,
  memory: { array: a43 },
  const: true,
});
$(o106, {
  memory: { array: a3 },
  handle: 130054,
});
$(o107, {
  memory: { array: a3 },
  handle: 131558,
});
$(o108, {
  memory: { array: a3 },
  handle: 111242,
});
$(o109, {
  memory: { array: a3 },
  handle: 113934,
});
$(o110, {
  memory: { array: a3 },
  handle: 114724,
});
$(o111, {
  memory: { array: a3 },
  handle: 116228,
});
$(o112, {
  memory: { array: a3 },
  handle: 116241,
});
$(o113, {
  memory: { array: a3 },
  handle: 117745,
});
$(o114, {
  memory: { array: a44 },
  handle: 106038,
  slots: {
    0: o115, 1: o117, 2: o119, 3: o121,
  },
});
$(o115, {
  structure: s68,
  memory: { array: a18, offset: 0, length: 8 },
  slots: {
    0: o116,
  },
});
$(o116, {
  structure: s67,
  memory: { array: a3 },
});
$(o117, {
  structure: s72,
  memory: { array: a18, offset: 8, length: 8 },
  slots: {
    0: o118,
  },
});
$(o118, {
  structure: s71,
  memory: { array: a3 },
});
$(o119, {
  structure: s75,
  memory: { array: a18, offset: 16, length: 8 },
  slots: {
    0: o120,
  },
});
$(o120, {
  structure: s74,
  memory: { array: a3 },
});
$(o121, {
  structure: s79,
  memory: { array: a18, offset: 24, length: 8 },
  slots: {
    0: o122,
  },
});
$(o122, {
  structure: s78,
  memory: { array: a3 },
});
$(o123, {
  slots: {
    0: o124,
  },
});
$(o124, {
  structure: s82,
  memory: { array: a45 },
  const: true,
});
$(o125, {
  memory: { array: a3 },
  handle: 117758,
});
$(o126, {
  memory: { array: a3 },
  handle: 117758,
});
$(o127, {
  memory: { array: a3 },
  handle: 117771,
});
$(o128, {
  memory: { array: a3 },
  handle: 117771,
});
$(o129, {
  memory: { array: a3 },
  handle: 117784,
});
$(o130, {
  memory: { array: a3 },
  handle: 117784,
});
$(o131, {
  memory: { array: a3 },
  handle: 117797,
});
$(o132, {
  memory: { array: a3 },
  handle: 117797,
});
$(o133, {
  memory: { array: a46 },
  handle: 105643,
  slots: {
    0: o134, 1: o135,
  },
});
$(o134, {
  structure: s34,
  memory: { array: a46, offset: 0, length: 8 },
});
$(o135, {
  structure: s81,
  memory: { array: a46, offset: 8, length: 8 },
});
$(o136, {
  slots: {
    0: o137, 1: o139, 2: o141, 3: o143, 4: o144, 5: o145, 6: o146, 7: o147, 8: o148, 9: o149,
  },
});
$(o137, {
  structure: s0,
  memory: { array: a3 },
  slots: {
    0: o138,
  },
});
$(o138, {
  structure: s82,
});
$(o139, {
  structure: s0,
  memory: { array: a3 },
  slots: {
    0: o140,
  },
});
$(o140, {
  structure: s83,
});
$(o141, {
  structure: s0,
  memory: { array: a3 },
  slots: {
    0: o142,
  },
});
$(o142, {
  structure: s80,
});
$(o143, {
  structure: s71,
  memory: { array: a3 },
  handle: 99655,
});
$(o144, {
  structure: s74,
  memory: { array: a3 },
  handle: 100114,
});
$(o145, {
  structure: s78,
  memory: { array: a3 },
  handle: 100566,
});
$(o146, {
  structure: s86,
  memory: { array: a3 },
  handle: 101663,
});
$(o147, {
  structure: s89,
  memory: { array: a3 },
  handle: 102912,
});
$(o148, {
  structure: s92,
  memory: { array: a3 },
  handle: 104157,
});
$(o149, {
  structure: s95,
  memory: { array: a3 },
  handle: 105252,
});
$(o150, {
  memory: { array: a3 },
  handle: 78447,
});
$(o151, {
  slots: {
    0: o152, 1: o153, 2: o154, 3: o155, 4: o156, 5: o157, 6: o158, 7: o159, 8: o160, 9: o161,
    10: o162, 11: o163, 12: o164, 13: o165, 14: o166, 15: o167, 16: o168, 17: o169, 18: o170, 19: o171,
    20: o172, 21: o173, 22: o174, 23: o175, 24: o176, 25: o177, 26: o178, 27: o179, 28: o180, 29: o181,
    30: o182,
  },
});
$(o152, {
  structure: s99,
  memory: { array: a47 },
  const: true,
});
$(o153, {
  structure: s99,
  memory: { array: a48 },
  const: true,
});
$(o154, {
  structure: s99,
  memory: { array: a49 },
  const: true,
});
$(o155, {
  structure: s99,
  memory: { array: a50 },
  const: true,
});
$(o156, {
  structure: s99,
  memory: { array: a51 },
  const: true,
});
$(o157, {
  structure: s99,
  memory: { array: a52 },
  const: true,
});
$(o158, {
  structure: s99,
  memory: { array: a53 },
  const: true,
});
$(o159, {
  structure: s99,
  memory: { array: a54 },
  const: true,
});
$(o160, {
  structure: s99,
  memory: { array: a55 },
  const: true,
});
$(o161, {
  structure: s99,
  memory: { array: a56 },
  const: true,
});
$(o162, {
  structure: s99,
  memory: { array: a57 },
  const: true,
});
$(o163, {
  structure: s99,
  memory: { array: a58 },
  const: true,
});
$(o164, {
  structure: s99,
  memory: { array: a59 },
  const: true,
});
$(o165, {
  structure: s99,
  memory: { array: a60 },
  const: true,
});
$(o166, {
  structure: s99,
  memory: { array: a61 },
  const: true,
});
$(o167, {
  structure: s99,
  memory: { array: a62 },
  const: true,
});
$(o168, {
  structure: s99,
  memory: { array: a63 },
  const: true,
});
$(o169, {
  structure: s99,
  memory: { array: a64 },
  const: true,
});
$(o170, {
  structure: s99,
  memory: { array: a65 },
  const: true,
});
$(o171, {
  structure: s99,
  memory: { array: a66 },
  const: true,
});
$(o172, {
  structure: s99,
  memory: { array: a67 },
  const: true,
});
$(o173, {
  structure: s99,
  memory: { array: a68 },
  const: true,
});
$(o174, {
  structure: s99,
  memory: { array: a69 },
  const: true,
});
$(o175, {
  structure: s99,
  memory: { array: a70 },
  const: true,
});
$(o176, {
  structure: s99,
  memory: { array: a71 },
  const: true,
});
$(o177, {
  structure: s99,
  memory: { array: a72 },
  const: true,
});
$(o178, {
  structure: s99,
  memory: { array: a73 },
  const: true,
});
$(o179, {
  structure: s99,
  memory: { array: a74 },
  const: true,
});
$(o180, {
  structure: s99,
  memory: { array: a75 },
  const: true,
});
$(o181, {
  structure: s99,
  memory: { array: a76 },
  const: true,
});
$(o182, {
  structure: s99,
  memory: { array: a77 },
  const: true,
});
$(o183, {
  memory: { array: a3 },
  handle: 78460,
});
$(o184, {
  memory: { array: a3 },
  handle: 127020,
});
$(o185, {
  memory: { array: a3 },
  handle: 128524,
});
$(o186, {
  memory: { array: a78 },
  handle: 105643,
  slots: {
    0: o187, 1: o188,
  },
});
$(o187, {
  structure: s103,
  memory: { array: a46, offset: 0, length: 8 },
  slots: {
    0: o134,
  },
});
$(o188, {
  structure: s106,
  memory: { array: a46, offset: 8, length: 8 },
  slots: {
    0: o189,
  },
});
$(o189, {
  structure: s105,
  memory: { array: a3 },
});
$(o190, {
  memory: { array: a3 },
  handle: 78821,
});
$(o191, {
  slots: {
    0: o192, 1: o193,
  },
});
$(o192, {
  structure: s110,
  memory: { array: a79 },
  const: true,
});
$(o193, {
  structure: s110,
  memory: { array: a80 },
  const: true,
});
$(o194, {
  slots: {
    0: o195,
  },
});
$(o195, {
  structure: s112,
  memory: { array: a81 },
  const: true,
});
$(o196, {
  memory: { array: a3 },
  handle: 128537,
});
$(o197, {
  memory: { array: a3 },
  handle: 130041,
});
$(o198, {
  memory: { array: a82 },
  handle: 105643,
  slots: {
    0: o187, 1: o199,
  },
});
$(o199, {
  structure: s116,
  memory: { array: a46, offset: 8, length: 8 },
  slots: {
    0: o200,
  },
});
$(o200, {
  structure: s115,
  memory: { array: a3 },
});
$(o201, {
  memory: { array: a83 },
  handle: 106025,
  slots: {
    0: o202,
  },
});
$(o202, {
  structure: s119,
  memory: { array: a84 },
  handle: 106025,
});
$(o203, {
  memory: { array: a3 },
  handle: 78834,
});
$(o204, {
  slots: {
    0: o205, 1: o207, 2: o209, 3: o211, 4: o213, 9: o214, 10: o215, 11: o216,
  },
});
$(o205, {
  structure: s0,
  memory: { array: a3 },
  slots: {
    0: o206,
  },
});
$(o206, {
  structure: s18,
});
$(o207, {
  structure: s0,
  memory: { array: a3 },
  slots: {
    0: o208,
  },
});
$(o208, {
  structure: s26,
});
$(o209, {
  structure: s0,
  memory: { array: a3 },
  slots: {
    0: o210,
  },
});
$(o210, {
  structure: s29,
});
$(o211, {
  structure: s0,
  memory: { array: a3 },
  slots: {
    0: o212,
  },
});
$(o212, {
  structure: s30,
});
$(o213, {
  structure: s98,
  memory: { array: a3 },
  handle: 64785,
});
$(o214, {
  structure: s102,
  memory: { array: a3 },
  handle: 64827,
});
$(o215, {
  structure: s109,
  memory: { array: a3 },
  handle: 64871,
});
$(o216, {
  structure: s122,
  memory: { array: a3 },
  handle: 64997,
});

// fill in structure properties
$(s0, {
  ...s,
  flags: 9,
  signature: 0x406b8a99e2cc9d59n,
  name: "type",
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 6,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        slot: 0,
        structure: s0,
      },
    ],
  },
});
$(s1, {
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
        structure: s1,
      },
    ],
  },
});
$(s2, {
  ...s,
  type: 1,
  flags: 240,
  signature: 0x6d0df926eed44617n,
  name: "[3]u8",
  length: 3,
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
      {
        ...m,
        type: 3,
        flags: 33,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: s1,
      },
    ],
    template: o0
  },
});
$(s3, {
  ...s,
  type: 8,
  flags: 204,
  signature: 0x9e594923df8578c6n,
  name: "*const [3]u8",
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
        structure: s2,
      },
    ],
  },
});
$(s4, {
  ...s,
  type: 1,
  flags: 240,
  signature: 0x8529e76c65ef0020n,
  name: "[13]u8",
  length: 13,
  byteSize: 14,
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
      {
        ...m,
        type: 3,
        flags: 33,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: s1,
      },
    ],
    template: o1
  },
});
$(s5, {
  ...s,
  type: 8,
  flags: 204,
  signature: 0x8efd97692f62ebd3n,
  name: "*const [13]u8",
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
        structure: s4,
      },
    ],
  },
});
$(s6, {
  ...s,
  flags: 9,
  signature: 0x7db343cac9f4fa83n,
  name: "comptime",
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        slot: 0,
        structure: s6,
      },
    ],
  },
});
$(s7, {
  ...s,
  type: 1,
  flags: 240,
  signature: 0x8d62bac20b49ae2bn,
  name: "[23]u8",
  length: 23,
  byteSize: 24,
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
      {
        ...m,
        type: 3,
        flags: 33,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: s1,
      },
    ],
    template: o2
  },
});
$(s8, {
  ...s,
  type: 8,
  flags: 204,
  signature: 0xc3220978c5104787n,
  name: "*const [23]u8",
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
  flags: 9,
  signature: 0x30a39b42da92ab1bn,
  name: "comptime",
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        slot: 0,
        structure: s9,
      },
    ],
  },
});
$(s10, {
  ...s,
  flags: 1,
  signature: 0x61e77abe97c52d51n,
  name: "f32",
  byteSize: 4,
  align: 4,
  instance: {
    members: [
      {
        ...m,
        type: 4,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: s10,
      },
    ],
  },
});
$(s11, {
  ...s,
  flags: 1,
  signature: 0xf1e897a7e0984b71n,
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
        structure: s11,
      },
    ],
  },
});
$(s12, {
  ...s,
  type: 2,
  flags: 4104,
  signature: 0x239ab4f327f6ac1bn,
  name: "S0",
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 0,
        name: "type",
        structure: s0,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 1,
        name: "minValue",
        structure: s9,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 2,
        name: "maxValue",
        structure: s9,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 3,
        name: "defaultValue",
        structure: s9,
      },
    ],
    template: o3
  },
});
$(s13, {
  ...s,
  type: 2,
  flags: 4106,
  signature: 0x239ab4f327f6ac1bn,
  name: "S1",
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 0,
        name: "intensity",
        structure: s12,
      },
    ],
    template: o12
  },
});
$(s14, {
  ...s,
  type: 2,
  flags: 4104,
  signature: 0x239ab4f327f6ac1bn,
  name: "S2",
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 0,
        name: "channels",
        structure: s6,
      },
    ],
    template: o14
  },
});
$(s15, {
  ...s,
  type: 2,
  flags: 4106,
  signature: 0x239ab4f327f6ac1bn,
  name: "S3",
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 0,
        name: "src",
        structure: s14,
      },
    ],
    template: o17
  },
});
$(s16, {
  ...s,
  type: 2,
  flags: 4104,
  signature: 0x239ab4f327f6ac1bn,
  name: "S4",
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 0,
        name: "channels",
        structure: s6,
      },
    ],
    template: o19
  },
});
$(s17, {
  ...s,
  type: 2,
  flags: 4106,
  signature: 0x239ab4f327f6ac1bn,
  name: "S5",
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 0,
        name: "dst",
        structure: s16,
      },
    ],
    template: o22
  },
});
$(s18, {
  ...s,
  type: 2,
  flags: 4096,
  signature: 0x239ab4f327f6ac1bn,
  name: "kernel",
  align: 1,
  static: {
    members: [
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 0,
        name: "namespace",
        structure: s3,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 1,
        name: "vendor",
        structure: s5,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 2,
        name: "version",
        structure: s6,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 3,
        name: "description",
        structure: s8,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 4,
        name: "parameters",
        structure: s13,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 5,
        name: "inputImages",
        structure: s15,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 6,
        name: "outputImages",
        structure: s17,
      },
    ],
    template: o24
  },
});
$(s19, {
  ...s,
  type: 10,
  flags: 16,
  signature: 0x4a655686401d154en,
  name: "@Vector(4, u8)",
  length: 4,
  byteSize: 4,
  align: 4,
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
});
$(s20, {
  ...s,
  type: 9,
  flags: 202,
  signature: 0x465ecc8b06dbf648n,
  name: "[_]@Vector(4, u8)",
  byteSize: 4,
  align: 4,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 32,
        byteSize: 4,
        structure: s19,
      },
    ],
  },
});
$(s21, {
  ...s,
  type: 8,
  flags: 188,
  signature: 0x2c3ab052067a6f4en,
  name: "[]const @Vector(4, u8)",
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
        structure: s20,
      },
    ],
  },
});
$(s22, {
  ...s,
  flags: 1,
  signature: 0x68598db431a811a3n,
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
        structure: s22,
      },
    ],
  },
});
$(s23, {
  ...s,
  type: 6,
  flags: 1,
  signature: 0xe1b1d2cee1fb73cen,
  name: "ColorSpace",
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 1,
        bitOffset: 0,
        byteSize: 1,
        structure: s23,
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
        name: "srgb",
        structure: s23,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 1,
        name: "display-p3",
        structure: s23,
      },
    ],
    template: o36
  },
});
$(s24, {
  ...s,
  type: 10,
  flags: 16,
  signature: 0x54c1b3c549d13acan,
  name: "@Vector(4, f32)",
  length: 4,
  byteSize: 16,
  align: 16,
  instance: {
    members: [
      {
        ...m,
        type: 4,
        bitSize: 32,
        byteSize: 4,
        structure: s10,
      },
    ],
  },
});
$(s25, {
  ...s,
  type: 2,
  flags: 14,
  signature: 0xe553791214dc2f6bn,
  name: "S6",
  byteSize: 32,
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
        name: "data",
        structure: s21,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 32,
        bitOffset: 128,
        byteSize: 4,
        slot: 1,
        name: "width",
        structure: s22,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 32,
        bitOffset: 160,
        byteSize: 4,
        slot: 2,
        name: "height",
        structure: s22,
      },
      {
        ...m,
        type: 3,
        bitSize: 1,
        bitOffset: 192,
        byteSize: 1,
        slot: 3,
        name: "colorSpace",
        structure: s23,
      },
    ],
    template: o39
  },
  static: {
    members: [
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 0,
        name: "Pixel",
        structure: s0,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 1,
        name: "FPixel",
        structure: s0,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 2,
        name: "channels",
        structure: s6,
      },
    ],
    template: o42
  },
});
$(s26, {
  ...s,
  type: 2,
  flags: 4110,
  signature: 0x7031f65c3c5d4f77n,
  name: "S7",
  byteSize: 32,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 256,
        bitOffset: 0,
        byteSize: 32,
        slot: 0,
        name: "src",
        structure: s25,
      },
    ],
    template: o49
  },
});
$(s27, {
  ...s,
  type: 8,
  flags: 60,
  signature: 0x73c45a8d050bb472n,
  name: "[]@Vector(4, u8)",
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
        structure: s20,
      },
    ],
  },
});
$(s28, {
  ...s,
  type: 2,
  flags: 14,
  signature: 0x8be4e7cd4e9dae1bn,
  name: "S8",
  byteSize: 32,
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
        name: "data",
        structure: s27,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 32,
        bitOffset: 128,
        byteSize: 4,
        slot: 1,
        name: "width",
        structure: s22,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 32,
        bitOffset: 160,
        byteSize: 4,
        slot: 2,
        name: "height",
        structure: s22,
      },
      {
        ...m,
        type: 3,
        bitSize: 1,
        bitOffset: 192,
        byteSize: 1,
        slot: 3,
        name: "colorSpace",
        structure: s23,
      },
    ],
    template: o51
  },
  static: {
    members: [
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 0,
        name: "Pixel",
        structure: s0,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 1,
        name: "FPixel",
        structure: s0,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 2,
        name: "channels",
        structure: s6,
      },
    ],
    template: o53
  },
});
$(s29, {
  ...s,
  type: 2,
  flags: 4110,
  signature: 0xb09f4d4f6f129d44n,
  name: "S9",
  byteSize: 32,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 256,
        bitOffset: 0,
        byteSize: 32,
        slot: 0,
        name: "dst",
        structure: s28,
      },
    ],
    template: o58
  },
});
$(s30, {
  ...s,
  type: 2,
  flags: 4096,
  signature: 0x8b859b03f42bd192n,
  name: "S10",
  byteSize: 4,
  align: 4,
  instance: {
    members: [
      {
        ...m,
        type: 4,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        slot: 0,
        name: "intensity",
        structure: s10,
      },
    ],
    template: o60
  },
});
$(s31, {
  ...s,
  type: 5,
  flags: 1,
  signature: 0x25c89e63075b428an,
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
        structure: s31,
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
        structure: s31,
      },
    ],
    template: o61
  },
});
$(s32, {
  ...s,
  type: 4,
  flags: 15,
  signature: 0x197cec53847b7ab3n,
  name: "ES0!S9",
  byteSize: 40,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 256,
        bitOffset: 0,
        byteSize: 32,
        slot: 0,
        structure: s29,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitSize: 16,
        bitOffset: 256,
        byteSize: 2,
        structure: s31,
      },
    ],
  },
});
$(s33, {
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
        structure: s1,
      },
    ],
  },
});
$(s34, {
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
        structure: s33,
      },
    ],
  },
});
$(s35, {
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
        structure: s1,
      },
    ],
  },
});
$(s36, {
  ...s,
  type: 8,
  flags: 44,
  signature: 0xdc4e40b42e2be1a4n,
  name: "[*]u8",
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
        structure: s35,
      },
    ],
  },
});
$(s37, {
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
        structure: s37,
      },
    ],
  },
});
$(s38, {
  ...s,
  type: 7,
  flags: 15,
  signature: 0x46d9c68a3fe0a71cn,
  name: "?[*]u8",
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
        structure: s36,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: s37,
      },
    ],
  },
});
$(s39, {
  ...s,
  type: 12,
  signature: 0xde13efb989eab233n,
  name: "Arg(fn (Alignment) usize)",
  length: 1,
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        name: "retval",
        structure: s37,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 6,
        bitOffset: 64,
        byteSize: 1,
        slot: 1,
        name: "0",
        structure: s65,
      },
    ],
  },
});
$(s40, {
  ...s,
  type: 14,
  signature: 0x511f3836ff34e93an,
  name: "fn (Alignment) usize",
  length: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 128,
        byteSize: 16,
        structure: s39,
      },
    ],
    template: o63
  },
});
$(s41, {
  ...s,
  type: 12,
  signature: 0x3d33381cd47940b4n,
  name: "Arg(fn (usize) Alignment)",
  length: 1,
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 6,
        bitOffset: 64,
        byteSize: 1,
        slot: 0,
        name: "retval",
        structure: s65,
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
        structure: s37,
      },
    ],
  },
});
$(s42, {
  ...s,
  type: 14,
  signature: 0x950458df9df4743bn,
  name: "fn (usize) Alignment",
  length: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 128,
        byteSize: 16,
        structure: s41,
      },
    ],
    template: o64
  },
});
$(s43, {
  ...s,
  type: 12,
  signature: 0xa358945228ebaff3n,
  name: "Arg(fn (Order) Order)",
  length: 1,
  byteSize: 2,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 2,
        bitOffset: 0,
        byteSize: 1,
        slot: 0,
        name: "retval",
        structure: s54,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 2,
        bitOffset: 8,
        byteSize: 1,
        slot: 1,
        name: "0",
        structure: s54,
      },
    ],
  },
});
$(s44, {
  ...s,
  type: 14,
  signature: 0x09217ef45d6a5583n,
  name: "fn (Order) Order",
  length: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 16,
        byteSize: 2,
        structure: s43,
      },
    ],
    template: o65
  },
});
$(s45, {
  ...s,
  type: 7,
  flags: 17,
  signature: 0x45d6d2728e09761bn,
  name: "?Order",
  byteSize: 2,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 2,
        bitOffset: 0,
        byteSize: 1,
        slot: 0,
        structure: s54,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitSize: 8,
        bitOffset: 8,
        byteSize: 1,
        structure: s1,
      },
    ],
  },
});
$(s46, {
  ...s,
  type: 12,
  flags: 10,
  signature: 0x818dc2d151e5b733n,
  name: "Arg(fn (Order) ?Order)",
  length: 1,
  byteSize: 3,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        slot: 0,
        name: "retval",
        structure: s45,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 2,
        bitOffset: 16,
        byteSize: 1,
        slot: 1,
        name: "0",
        structure: s54,
      },
    ],
  },
});
$(s47, {
  ...s,
  type: 14,
  signature: 0x54ab34151663d188n,
  name: "fn (Order) ?Order",
  length: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 24,
        byteSize: 3,
        structure: s46,
      },
    ],
    template: o66
  },
});
$(s48, {
  ...s,
  flags: 1,
  signature: 0x6eddab4b13ff06c5n,
  name: "bool",
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 1,
        bitSize: 1,
        bitOffset: 0,
        byteSize: 1,
        structure: s48,
      },
    ],
  },
});
$(s49, {
  ...s,
  type: 12,
  signature: 0xb4bc84552cdf048fn,
  name: "Arg(fn (CompareOperator) CompareOperator)",
  length: 1,
  byteSize: 2,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 3,
        bitOffset: 0,
        byteSize: 1,
        slot: 0,
        name: "retval",
        structure: s51,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 3,
        bitOffset: 8,
        byteSize: 1,
        slot: 1,
        name: "0",
        structure: s51,
      },
    ],
  },
});
$(s50, {
  ...s,
  type: 14,
  signature: 0x7614c9fef669bdabn,
  name: "fn (CompareOperator) CompareOperator",
  length: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 16,
        byteSize: 2,
        structure: s49,
      },
    ],
    template: o67
  },
});
$(s51, {
  ...s,
  type: 6,
  flags: 1,
  signature: 0x89697612f8e25e90n,
  name: "CompareOperator",
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 3,
        bitOffset: 0,
        byteSize: 1,
        structure: s51,
      },
    ],
  },
  static: {
    members: [
      {
        ...m,
        type: 5,
        flags: 18,
        slot: 0,
        name: "reverse",
        structure: s50,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 1,
        name: "lt",
        structure: s51,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 2,
        name: "lte",
        structure: s51,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 3,
        name: "eq",
        structure: s51,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 4,
        name: "gte",
        structure: s51,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 5,
        name: "gt",
        structure: s51,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 6,
        name: "neq",
        structure: s51,
      },
    ],
    template: o68
  },
});
$(s52, {
  ...s,
  type: 12,
  signature: 0xacf11acba856b940n,
  name: "Arg(fn (Order, CompareOperator) bool)",
  length: 2,
  byteSize: 3,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 1,
        flags: 1,
        bitSize: 1,
        bitOffset: 0,
        byteSize: 1,
        slot: 0,
        name: "retval",
        structure: s48,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 2,
        bitOffset: 8,
        byteSize: 1,
        slot: 1,
        name: "0",
        structure: s54,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 3,
        bitOffset: 16,
        byteSize: 1,
        slot: 2,
        name: "1",
        structure: s51,
      },
    ],
  },
});
$(s53, {
  ...s,
  type: 14,
  signature: 0xf27159573848fb68n,
  name: "fn (Order, CompareOperator) bool",
  length: 2,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 24,
        byteSize: 3,
        structure: s52,
      },
    ],
    template: o76
  },
});
$(s54, {
  ...s,
  type: 6,
  flags: 1,
  signature: 0x1aec8487f6280122n,
  name: "Order",
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 2,
        bitOffset: 0,
        byteSize: 1,
        structure: s54,
      },
    ],
  },
  static: {
    members: [
      {
        ...m,
        type: 5,
        flags: 18,
        slot: 0,
        name: "invert",
        structure: s44,
      },
      {
        ...m,
        type: 5,
        flags: 18,
        slot: 1,
        name: "differ",
        structure: s47,
      },
      {
        ...m,
        type: 5,
        flags: 18,
        slot: 2,
        name: "compare",
        structure: s53,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 3,
        name: "gt",
        structure: s54,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 4,
        name: "lt",
        structure: s54,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 5,
        name: "eq",
        structure: s54,
      },
    ],
    template: o77
  },
});
$(s55, {
  ...s,
  type: 12,
  signature: 0xf2ead49fdfa38e2bn,
  name: "Arg(fn (Alignment, Alignment) Order)",
  length: 2,
  byteSize: 3,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 2,
        bitOffset: 0,
        byteSize: 1,
        slot: 0,
        name: "retval",
        structure: s54,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 6,
        bitOffset: 8,
        byteSize: 1,
        slot: 1,
        name: "0",
        structure: s65,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 6,
        bitOffset: 16,
        byteSize: 1,
        slot: 2,
        name: "1",
        structure: s65,
      },
    ],
  },
});
$(s56, {
  ...s,
  type: 14,
  signature: 0xf13cee4b7fda58c4n,
  name: "fn (Alignment, Alignment) Order",
  length: 2,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 24,
        byteSize: 3,
        structure: s55,
      },
    ],
    template: o84
  },
});
$(s57, {
  ...s,
  type: 12,
  signature: 0x05739b3b38be1fe7n,
  name: "Arg(fn (Alignment, CompareOperator, Alignment) bool)",
  length: 3,
  byteSize: 4,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 1,
        flags: 1,
        bitSize: 1,
        bitOffset: 0,
        byteSize: 1,
        slot: 0,
        name: "retval",
        structure: s48,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 6,
        bitOffset: 8,
        byteSize: 1,
        slot: 1,
        name: "0",
        structure: s65,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 3,
        bitOffset: 16,
        byteSize: 1,
        slot: 2,
        name: "1",
        structure: s51,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 6,
        bitOffset: 24,
        byteSize: 1,
        slot: 3,
        name: "2",
        structure: s65,
      },
    ],
  },
});
$(s58, {
  ...s,
  type: 14,
  signature: 0x5fb140f1464d545dn,
  name: "fn (Alignment, CompareOperator, Alignment) bool",
  length: 3,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 32,
        byteSize: 4,
        structure: s57,
      },
    ],
    template: o85
  },
});
$(s59, {
  ...s,
  type: 12,
  signature: 0x19f9b9e423c9240bn,
  name: "Arg(fn (Alignment, Alignment) Alignment)",
  length: 2,
  byteSize: 3,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 6,
        bitOffset: 0,
        byteSize: 1,
        slot: 0,
        name: "retval",
        structure: s65,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 6,
        bitOffset: 8,
        byteSize: 1,
        slot: 1,
        name: "0",
        structure: s65,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 6,
        bitOffset: 16,
        byteSize: 1,
        slot: 2,
        name: "1",
        structure: s65,
      },
    ],
  },
});
$(s60, {
  ...s,
  type: 14,
  signature: 0x502383542de53673n,
  name: "fn (Alignment, Alignment) Alignment",
  length: 2,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 24,
        byteSize: 3,
        structure: s59,
      },
    ],
    template: o86
  },
});
$(s61, {
  ...s,
  type: 12,
  signature: 0x84835b8f7162244fn,
  name: "Arg(fn (Alignment, usize) usize)",
  length: 2,
  byteSize: 24,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        name: "retval",
        structure: s37,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 6,
        bitOffset: 128,
        byteSize: 1,
        slot: 1,
        name: "0",
        structure: s65,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 64,
        bitOffset: 64,
        byteSize: 8,
        slot: 2,
        name: "1",
        structure: s37,
      },
    ],
  },
});
$(s62, {
  ...s,
  type: 14,
  signature: 0xf22d521b6289ec09n,
  name: "fn (Alignment, usize) usize",
  length: 2,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 192,
        byteSize: 24,
        structure: s61,
      },
    ],
    template: o87
  },
});
$(s63, {
  ...s,
  type: 12,
  signature: 0x053c5d5cf40c778fn,
  name: "Arg(fn (Alignment, usize) bool)",
  length: 2,
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 1,
        flags: 1,
        bitSize: 1,
        bitOffset: 64,
        byteSize: 1,
        slot: 0,
        name: "retval",
        structure: s48,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 6,
        bitOffset: 72,
        byteSize: 1,
        slot: 1,
        name: "0",
        structure: s65,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 2,
        name: "1",
        structure: s37,
      },
    ],
  },
});
$(s64, {
  ...s,
  type: 14,
  signature: 0xc152dfb87eadb0b4n,
  name: "fn (Alignment, usize) bool",
  length: 2,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 128,
        byteSize: 16,
        structure: s63,
      },
    ],
    template: o88
  },
});
$(s65, {
  ...s,
  type: 6,
  flags: 17,
  signature: 0x585b7f21a11e5af0n,
  name: "Alignment",
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 6,
        bitOffset: 0,
        byteSize: 1,
        structure: s65,
      },
    ],
  },
  static: {
    members: [
      {
        ...m,
        type: 5,
        flags: 18,
        slot: 0,
        name: "toByteUnits",
        structure: s40,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 1,
        name: "fromByteUnits",
        structure: s42,
      },
      {
        ...m,
        type: 5,
        flags: 18,
        slot: 2,
        name: "order",
        structure: s56,
      },
      {
        ...m,
        type: 5,
        flags: 18,
        slot: 3,
        name: "compare",
        structure: s58,
      },
      {
        ...m,
        type: 5,
        flags: 18,
        slot: 4,
        name: "max",
        structure: s60,
      },
      {
        ...m,
        type: 5,
        flags: 18,
        slot: 5,
        name: "min",
        structure: s60,
      },
      {
        ...m,
        type: 5,
        flags: 18,
        slot: 6,
        name: "forward",
        structure: s62,
      },
      {
        ...m,
        type: 5,
        flags: 18,
        slot: 7,
        name: "backward",
        structure: s62,
      },
      {
        ...m,
        type: 5,
        flags: 18,
        slot: 8,
        name: "check",
        structure: s64,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 9,
        name: "1",
        structure: s65,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 10,
        name: "2",
        structure: s65,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 11,
        name: "4",
        structure: s65,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 12,
        name: "8",
        structure: s65,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 13,
        name: "16",
        structure: s65,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 14,
        name: "32",
        structure: s65,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 15,
        name: "64",
        structure: s65,
      },
    ],
    template: o89
  },
});
$(s66, {
  ...s,
  type: 12,
  flags: 14,
  signature: 0xe9635dad30c6baf7n,
  name: "Arg(fn (*opaque, usize, Alignment, usize) ?[*]u8)",
  length: 4,
  byteSize: 40,
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
        name: "retval",
        structure: s38,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 64,
        bitOffset: 64,
        byteSize: 8,
        slot: 1,
        name: "0",
        structure: s34,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 64,
        bitOffset: 128,
        byteSize: 8,
        slot: 2,
        name: "1",
        structure: s37,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 6,
        bitOffset: 256,
        byteSize: 1,
        slot: 3,
        name: "2",
        structure: s65,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 64,
        bitOffset: 192,
        byteSize: 8,
        slot: 4,
        name: "3",
        structure: s37,
      },
    ],
  },
});
$(s67, {
  ...s,
  type: 14,
  signature: 0xbed86186ab27c14cn,
  name: "fn (*opaque, usize, Alignment, usize) ?[*]u8",
  length: 4,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 320,
        byteSize: 40,
        structure: s66,
      },
    ],
    template: o106
  },
  static: {
    members: [],
    template: o107
  },
});
$(s68, {
  ...s,
  type: 8,
  flags: 204,
  signature: 0x4e622a40d4cd5ff1n,
  name: "*const fn (*opaque, usize, Alignment, usize) ?[*]u8",
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
        structure: s67,
      },
    ],
  },
});
$(s69, {
  ...s,
  type: 8,
  flags: 60,
  signature: 0x559135659a0a19ean,
  name: "[]u8",
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
        structure: s35,
      },
    ],
  },
});
$(s70, {
  ...s,
  type: 12,
  flags: 14,
  signature: 0xcdf6dc4e0de8422cn,
  name: "Arg(fn (*opaque, []u8, Alignment, usize, usize) bool)",
  length: 5,
  byteSize: 48,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 1,
        flags: 1,
        bitSize: 1,
        bitOffset: 320,
        byteSize: 1,
        slot: 0,
        name: "retval",
        structure: s48,
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
        structure: s34,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 128,
        bitOffset: 64,
        byteSize: 16,
        slot: 2,
        name: "1",
        structure: s69,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 6,
        bitOffset: 328,
        byteSize: 1,
        slot: 3,
        name: "2",
        structure: s65,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 64,
        bitOffset: 192,
        byteSize: 8,
        slot: 4,
        name: "3",
        structure: s37,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 64,
        bitOffset: 256,
        byteSize: 8,
        slot: 5,
        name: "4",
        structure: s37,
      },
    ],
  },
});
$(s71, {
  ...s,
  type: 14,
  signature: 0xb1911d4efbc4e934n,
  name: "fn (*opaque, []u8, Alignment, usize, usize) bool",
  length: 5,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 384,
        byteSize: 48,
        structure: s70,
      },
    ],
    template: o108
  },
  static: {
    members: [],
    template: o109
  },
});
$(s72, {
  ...s,
  type: 8,
  flags: 204,
  signature: 0x493ea89f26eed44an,
  name: "*const fn (*opaque, []u8, Alignment, usize, usize) bool",
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
        structure: s71,
      },
    ],
  },
});
$(s73, {
  ...s,
  type: 12,
  flags: 14,
  signature: 0x9205d7e9600828c7n,
  name: "Arg(fn (*opaque, []u8, Alignment, usize, usize) ?[*]u8)",
  length: 5,
  byteSize: 56,
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
        name: "retval",
        structure: s38,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 64,
        bitOffset: 64,
        byteSize: 8,
        slot: 1,
        name: "0",
        structure: s34,
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
        structure: s69,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 6,
        bitOffset: 384,
        byteSize: 1,
        slot: 3,
        name: "2",
        structure: s65,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 64,
        bitOffset: 256,
        byteSize: 8,
        slot: 4,
        name: "3",
        structure: s37,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 64,
        bitOffset: 320,
        byteSize: 8,
        slot: 5,
        name: "4",
        structure: s37,
      },
    ],
  },
});
$(s74, {
  ...s,
  type: 14,
  signature: 0xa62dc1e1ab682848n,
  name: "fn (*opaque, []u8, Alignment, usize, usize) ?[*]u8",
  length: 5,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 448,
        byteSize: 56,
        structure: s73,
      },
    ],
    template: o110
  },
  static: {
    members: [],
    template: o111
  },
});
$(s75, {
  ...s,
  type: 8,
  flags: 204,
  signature: 0x77acf15c3d1d71d3n,
  name: "*const fn (*opaque, []u8, Alignment, usize, usize) ?[*]u8",
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
        structure: s74,
      },
    ],
  },
});
$(s76, {
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
        structure: s76,
      },
    ],
  },
});
$(s77, {
  ...s,
  type: 12,
  flags: 14,
  signature: 0x904e42ce696930c2n,
  name: "Arg(fn (*opaque, []u8, Alignment, usize) void)",
  length: 4,
  byteSize: 40,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        flags: 1,
        bitSize: 0,
        bitOffset: 256,
        byteSize: 0,
        slot: 0,
        name: "retval",
        structure: s76,
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
        structure: s34,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 128,
        bitOffset: 64,
        byteSize: 16,
        slot: 2,
        name: "1",
        structure: s69,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 6,
        bitOffset: 256,
        byteSize: 1,
        slot: 3,
        name: "2",
        structure: s65,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 64,
        bitOffset: 192,
        byteSize: 8,
        slot: 4,
        name: "3",
        structure: s37,
      },
    ],
  },
});
$(s78, {
  ...s,
  type: 14,
  signature: 0x6d484295c0c3632en,
  name: "fn (*opaque, []u8, Alignment, usize) void",
  length: 4,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 320,
        byteSize: 40,
        structure: s77,
      },
    ],
    template: o112
  },
  static: {
    members: [],
    template: o113
  },
});
$(s79, {
  ...s,
  type: 8,
  flags: 204,
  signature: 0xa160bce25686afaen,
  name: "*const fn (*opaque, []u8, Alignment, usize) void",
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
        structure: s78,
      },
    ],
  },
});
$(s80, {
  ...s,
  type: 2,
  flags: 14,
  signature: 0x82fdd6a3c2718ac5n,
  name: "VTable",
  byteSize: 32,
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
        name: "alloc",
        structure: s68,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 64,
        bitOffset: 64,
        byteSize: 8,
        slot: 1,
        name: "resize",
        structure: s72,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 64,
        bitOffset: 128,
        byteSize: 8,
        slot: 2,
        name: "remap",
        structure: s75,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 64,
        bitOffset: 192,
        byteSize: 8,
        slot: 3,
        name: "free",
        structure: s79,
      },
    ],
    template: o114
  },
});
$(s81, {
  ...s,
  type: 8,
  flags: 204,
  signature: 0x032c51cdc1d57444n,
  name: "*const VTable",
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
        structure: s80,
      },
    ],
  },
});
$(s82, {
  ...s,
  type: 5,
  flags: 1,
  signature: 0x25c89e63075b428an,
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
        structure: s82,
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
        structure: s82,
      },
    ],
    template: o123
  },
});
$(s83, {
  ...s,
  flags: 1,
  signature: 0xb89afc1d323aa0a6n,
  name: "u6",
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 6,
        bitOffset: 0,
        byteSize: 1,
        structure: s83,
      },
    ],
  },
});
$(s84, {
  ...s,
  type: 12,
  flags: 30,
  signature: 0xfbc5dcd792c9aee9n,
  name: "Arg(fn (Allocator, usize, Alignment, usize) ?[*]u8)",
  length: 3,
  byteSize: 48,
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
        name: "retval",
        structure: s38,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 128,
        bitOffset: 64,
        byteSize: 16,
        slot: 1,
        name: "0",
        structure: s96,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 64,
        bitOffset: 192,
        byteSize: 8,
        slot: 2,
        name: "1",
        structure: s37,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 6,
        bitOffset: 320,
        byteSize: 1,
        slot: 3,
        name: "2",
        structure: s65,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 64,
        bitOffset: 256,
        byteSize: 8,
        slot: 4,
        name: "3",
        structure: s37,
      },
    ],
  },
});
$(s85, {
  ...s,
  type: 14,
  signature: 0xa1c6c8ddb44e8aa1n,
  name: "fn (Allocator, usize, Alignment, usize) ?[*]u8",
  length: 3,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 384,
        byteSize: 48,
        structure: s84,
      },
    ],
    template: o125
  },
});
$(s86, {
  ...s,
  type: 14,
  signature: 0x3150e96a1cf4fb3en,
  name: "fn (Allocator, usize, Alignment, usize) ?[*]u8",
  length: 3,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 384,
        byteSize: 48,
        structure: s84,
      },
    ],
    template: o126
  },
});
$(s87, {
  ...s,
  type: 12,
  flags: 30,
  signature: 0x844b7d91572e5617n,
  name: "Arg(fn (Allocator, []u8, Alignment, usize, usize) bool)",
  length: 4,
  byteSize: 56,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 1,
        flags: 1,
        bitSize: 1,
        bitOffset: 384,
        byteSize: 1,
        slot: 0,
        name: "retval",
        structure: s48,
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
        structure: s96,
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
        structure: s69,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 6,
        bitOffset: 392,
        byteSize: 1,
        slot: 3,
        name: "2",
        structure: s65,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 64,
        bitOffset: 256,
        byteSize: 8,
        slot: 4,
        name: "3",
        structure: s37,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 64,
        bitOffset: 320,
        byteSize: 8,
        slot: 5,
        name: "4",
        structure: s37,
      },
    ],
  },
});
$(s88, {
  ...s,
  type: 14,
  signature: 0xde63f52f14d5bc74n,
  name: "fn (Allocator, []u8, Alignment, usize, usize) bool",
  length: 4,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 448,
        byteSize: 56,
        structure: s87,
      },
    ],
    template: o127
  },
});
$(s89, {
  ...s,
  type: 14,
  signature: 0xbacda0ec6bc94329n,
  name: "fn (Allocator, []u8, Alignment, usize, usize) bool",
  length: 4,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 448,
        byteSize: 56,
        structure: s87,
      },
    ],
    template: o128
  },
});
$(s90, {
  ...s,
  type: 12,
  flags: 30,
  signature: 0xca4d0a4d3768c190n,
  name: "Arg(fn (Allocator, []u8, Alignment, usize, usize) ?[*]u8)",
  length: 4,
  byteSize: 64,
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
        name: "retval",
        structure: s38,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 128,
        bitOffset: 64,
        byteSize: 16,
        slot: 1,
        name: "0",
        structure: s96,
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
        structure: s69,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 6,
        bitOffset: 448,
        byteSize: 1,
        slot: 3,
        name: "2",
        structure: s65,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 64,
        bitOffset: 320,
        byteSize: 8,
        slot: 4,
        name: "3",
        structure: s37,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 64,
        bitOffset: 384,
        byteSize: 8,
        slot: 5,
        name: "4",
        structure: s37,
      },
    ],
  },
});
$(s91, {
  ...s,
  type: 14,
  signature: 0x5694954bb4defd4fn,
  name: "fn (Allocator, []u8, Alignment, usize, usize) ?[*]u8",
  length: 4,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 512,
        byteSize: 64,
        structure: s90,
      },
    ],
    template: o129
  },
});
$(s92, {
  ...s,
  type: 14,
  signature: 0xef3e466f3864f3f8n,
  name: "fn (Allocator, []u8, Alignment, usize, usize) ?[*]u8",
  length: 4,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 512,
        byteSize: 64,
        structure: s90,
      },
    ],
    template: o130
  },
});
$(s93, {
  ...s,
  type: 12,
  flags: 30,
  signature: 0x8cbf4dbbc76d157cn,
  name: "Arg(fn (Allocator, []u8, Alignment, usize) void)",
  length: 3,
  byteSize: 48,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        flags: 1,
        bitSize: 0,
        bitOffset: 320,
        byteSize: 0,
        slot: 0,
        name: "retval",
        structure: s76,
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
        structure: s96,
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
        structure: s69,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 6,
        bitOffset: 320,
        byteSize: 1,
        slot: 3,
        name: "2",
        structure: s65,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 64,
        bitOffset: 256,
        byteSize: 8,
        slot: 4,
        name: "3",
        structure: s37,
      },
    ],
  },
});
$(s94, {
  ...s,
  type: 14,
  signature: 0x0c1808e686843fafn,
  name: "fn (Allocator, []u8, Alignment, usize) void",
  length: 3,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 384,
        byteSize: 48,
        structure: s93,
      },
    ],
    template: o131
  },
});
$(s95, {
  ...s,
  type: 14,
  signature: 0x65e6caa57226340dn,
  name: "fn (Allocator, []u8, Alignment, usize) void",
  length: 3,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 384,
        byteSize: 48,
        structure: s93,
      },
    ],
    template: o132
  },
});
$(s96, {
  ...s,
  type: 2,
  flags: 270,
  signature: 0x792f7b78d636007fn,
  name: "Allocator",
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
        name: "ptr",
        structure: s34,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 64,
        bitOffset: 64,
        byteSize: 8,
        slot: 1,
        name: "vtable",
        structure: s81,
      },
    ],
    template: o133
  },
  static: {
    members: [
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 0,
        name: "Error",
        structure: s0,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 1,
        name: "Log2Align",
        structure: s0,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 2,
        name: "VTable",
        structure: s0,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 3,
        name: "noResize",
        structure: s71,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 4,
        name: "noRemap",
        structure: s74,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 5,
        name: "noFree",
        structure: s78,
      },
      {
        ...m,
        type: 5,
        flags: 18,
        slot: 6,
        name: "rawAlloc",
        structure: s85,
      },
      {
        ...m,
        type: 5,
        flags: 18,
        slot: 7,
        name: "rawResize",
        structure: s88,
      },
      {
        ...m,
        type: 5,
        flags: 18,
        slot: 8,
        name: "rawRemap",
        structure: s91,
      },
      {
        ...m,
        type: 5,
        flags: 18,
        slot: 9,
        name: "rawFree",
        structure: s94,
      },
    ],
    template: o136
  },
});
$(s97, {
  ...s,
  type: 12,
  flags: 62,
  signature: 0x84e3636fdfbdd69an,
  name: "Arg(fn (Allocator, u32, u32, S7, S10) ES0!S9)",
  length: 4,
  byteSize: 104,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 320,
        bitOffset: 0,
        byteSize: 40,
        slot: 0,
        name: "retval",
        structure: s32,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 128,
        bitOffset: 320,
        byteSize: 16,
        slot: 1,
        name: "0",
        structure: s96,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 32,
        bitOffset: 704,
        byteSize: 4,
        slot: 2,
        name: "1",
        structure: s22,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 32,
        bitOffset: 736,
        byteSize: 4,
        slot: 3,
        name: "2",
        structure: s22,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 256,
        bitOffset: 448,
        byteSize: 32,
        slot: 4,
        name: "3",
        structure: s26,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 32,
        bitOffset: 768,
        byteSize: 4,
        slot: 5,
        name: "4",
        structure: s30,
      },
    ],
  },
});
$(s98, {
  ...s,
  type: 14,
  signature: 0xdf25bb10d1b0231dn,
  name: "fn (Allocator, u32, u32, S7, S10) ES0!S9",
  length: 4,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 832,
        byteSize: 104,
        structure: s97,
      },
    ],
    template: o150
  },
});
$(s99, {
  ...s,
  type: 5,
  flags: 1,
  signature: 0x5062e16b4c329430n,
  name: "ES2",
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
        structure: s99,
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
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 1,
        name: "Unknown",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 2,
        name: "UnableToAllocateMemory",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 3,
        name: "UnableToFreeMemory",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 4,
        name: "UnableToRetrieveMemoryLocation",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 5,
        name: "UnableToCreateDataView",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 6,
        name: "UnableToCreateObject",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 7,
        name: "UnableToObtainSlot",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 8,
        name: "UnableToRetrieveObject",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 9,
        name: "UnableToInsertObject",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 10,
        name: "UnableToStartStructureDefinition",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 11,
        name: "UnableToAddStructureMember",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 12,
        name: "UnableToAddStaticMember",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 13,
        name: "UnableToAddMethod",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 14,
        name: "UnableToCreateStructureTemplate",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 15,
        name: "UnableToCreateString",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 16,
        name: "UnableToAddStructureTemplate",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 17,
        name: "UnableToDefineStructure",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 18,
        name: "UnableToWriteToConsole",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 19,
        name: "UnableToCreateFunction",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 20,
        name: "UnableToUseThread",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 21,
        name: "NotInMainThread",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 22,
        name: "MainThreadNotFound",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 23,
        name: "MultithreadingNotEnabled",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 24,
        name: "TooManyArguments",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 25,
        name: "SystemResources",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 26,
        name: "Unexpected",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 27,
        name: "AlreadyInitialized",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 28,
        name: "Deinitializing",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 29,
        name: "ThreadQuotaExceeded",
        structure: s99,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 30,
        name: "LockedMemoryLimitExceeded",
        structure: s99,
      },
    ],
    template: o151
  },
});
$(s100, {
  ...s,
  type: 4,
  flags: 1,
  signature: 0x486b0cb193cc99edn,
  name: "ES2!void",
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
        structure: s76,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: s99,
      },
    ],
  },
});
$(s101, {
  ...s,
  type: 12,
  flags: 42,
  signature: 0x1ec3c4a1615a09e4n,
  name: "Arg(fn (u32) ES2!void)",
  length: 1,
  byteSize: 8,
  align: 4,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        slot: 0,
        name: "retval",
        structure: s100,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        slot: 1,
        name: "0",
        structure: s22,
      },
    ],
  },
});
$(s102, {
  ...s,
  type: 14,
  signature: 0x2e933b5a0acc3c99n,
  name: "fn (u32) ES2!void",
  length: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 64,
        byteSize: 8,
        structure: s101,
      },
    ],
    template: o183
  },
});
$(s103, {
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
        structure: s34,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: s37,
      },
    ],
  },
});
$(s104, {
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
        structure: s76,
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
        structure: s103,
      },
      {
        ...m,
        flags: 1,
        bitSize: 0,
        bitOffset: 64,
        byteSize: 0,
        slot: 2,
        name: "1",
        structure: s76,
      },
    ],
  },
});
$(s105, {
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
        structure: s104,
      },
    ],
    template: o184
  },
  static: {
    members: [],
    template: o185
  },
});
$(s106, {
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
        structure: s105,
      },
    ],
  },
});
$(s107, {
  ...s,
  type: 2,
  flags: 526,
  signature: 0x0d15352f0eaaaee2n,
  name: "S11",
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
        structure: s103,
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
        structure: s106,
      },
    ],
    template: o186
  },
});
$(s108, {
  ...s,
  type: 12,
  flags: 94,
  signature: 0x4df95d08659081dcn,
  name: "Arg(fn (S11) void)",
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
        structure: s76,
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
        structure: s107,
      },
    ],
  },
});
$(s109, {
  ...s,
  type: 14,
  signature: 0xc449c79e7d730846n,
  name: "fn (S11) void",
  length: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 128,
        byteSize: 16,
        structure: s108,
      },
    ],
    template: o190
  },
});
$(s110, {
  ...s,
  type: 5,
  flags: 1,
  signature: 0x2adad32524badd97n,
  name: "ES3",
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
        structure: s110,
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
        structure: s110,
      },
      {
        ...m,
        type: 5,
        flags: 4,
        slot: 1,
        name: "Unexpected",
        structure: s110,
      },
    ],
    template: o191
  },
});
$(s111, {
  ...s,
  type: 4,
  flags: 1,
  signature: 0x6eca2207e5ac3565n,
  name: "ES3!void",
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
        structure: s76,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: s110,
      },
    ],
  },
});
$(s112, {
  ...s,
  type: 5,
  flags: 1,
  signature: 0xf6baaaf6f5cb446en,
  name: "ES4",
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
        structure: s112,
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
        name: "Aborted",
        structure: s112,
      },
    ],
    template: o194
  },
});
$(s113, {
  ...s,
  type: 4,
  flags: 15,
  signature: 0xe305adcbd10aa187n,
  name: "ES4!S9",
  byteSize: 40,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 256,
        bitOffset: 0,
        byteSize: 32,
        slot: 0,
        structure: s29,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitSize: 16,
        bitOffset: 256,
        byteSize: 2,
        structure: s112,
      },
    ],
  },
});
$(s114, {
  ...s,
  type: 12,
  flags: 14,
  signature: 0x7692d43fb11b4684n,
  name: "Arg(fn (?*opaque, ES4!S9) void)",
  length: 2,
  byteSize: 48,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        flags: 1,
        bitSize: 0,
        bitOffset: 384,
        byteSize: 0,
        slot: 0,
        name: "retval",
        structure: s76,
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
        structure: s103,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 320,
        bitOffset: 64,
        byteSize: 40,
        slot: 2,
        name: "1",
        structure: s113,
      },
    ],
  },
});
$(s115, {
  ...s,
  type: 14,
  signature: 0x1fe262a6498cfd30n,
  name: "fn (?*opaque, ES4!S9) void",
  length: 2,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 384,
        byteSize: 48,
        structure: s114,
      },
    ],
    template: o196
  },
  static: {
    members: [],
    template: o197
  },
});
$(s116, {
  ...s,
  type: 8,
  flags: 204,
  signature: 0x644592e2a71d7fc3n,
  name: "*const fn (?*opaque, ES4!S9) void",
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
        structure: s115,
      },
    ],
  },
});
$(s117, {
  ...s,
  type: 2,
  flags: 526,
  signature: 0x20d8796d53ed09e6n,
  name: "S12",
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
        structure: s103,
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
        structure: s116,
      },
    ],
    template: o198
  },
});
$(s118, {
  ...s,
  flags: 1,
  signature: 0xbdb875b052db9ef8n,
  name: "i32",
  byteSize: 4,
  align: 4,
  instance: {
    members: [
      {
        ...m,
        type: 2,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: s118,
      },
    ],
  },
});
$(s119, {
  ...s,
  type: 8,
  flags: 204,
  signature: 0x73bde77802a3eff9n,
  name: "*const i32",
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
        structure: s118,
      },
    ],
  },
});
$(s120, {
  ...s,
  type: 2,
  flags: 2062,
  signature: 0x6202dd78a023834bn,
  name: "AbortSignal",
  byteSize: 8,
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
        name: "ptr",
        structure: s119,
      },
    ],
    template: o201
  },
});
$(s121, {
  ...s,
  type: 12,
  flags: 126,
  signature: 0x782a15a36bcfb35bn,
  name: "Arg(fn (Allocator, S12, AbortSignal, u32, u32, S7, S10) ES3!void)",
  length: 4,
  byteSize: 88,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 16,
        bitOffset: 672,
        byteSize: 2,
        slot: 0,
        name: "retval",
        structure: s111,
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
        structure: s96,
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
        structure: s117,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 64,
        bitOffset: 256,
        byteSize: 8,
        slot: 3,
        name: "2",
        structure: s120,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 32,
        bitOffset: 576,
        byteSize: 4,
        slot: 4,
        name: "3",
        structure: s22,
      },
      {
        ...m,
        type: 3,
        flags: 1,
        bitSize: 32,
        bitOffset: 608,
        byteSize: 4,
        slot: 5,
        name: "4",
        structure: s22,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 256,
        bitOffset: 320,
        byteSize: 32,
        slot: 6,
        name: "5",
        structure: s26,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitSize: 32,
        bitOffset: 640,
        byteSize: 4,
        slot: 7,
        name: "6",
        structure: s30,
      },
    ],
  },
});
$(s122, {
  ...s,
  type: 14,
  signature: 0xb28f29e78f1d0387n,
  name: "fn (Allocator, S12, AbortSignal, u32, u32, S7, S10) ES3!void",
  length: 4,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 704,
        byteSize: 88,
        structure: s121,
      },
    ],
    template: o203
  },
});
$(s123, {
  ...s,
  type: 2,
  flags: 4096,
  signature: 0x239ab4f327f6ac1bn,
  name: "sepia",
  align: 1,
  static: {
    members: [
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 0,
        name: "kernel",
        structure: s0,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 1,
        name: "Input",
        structure: s0,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 2,
        name: "Output",
        structure: s0,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 3,
        name: "Parameters",
        structure: s0,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 4,
        name: "createOutput",
        structure: s98,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 9,
        name: "startThreadPool",
        structure: s102,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 10,
        name: "stopThreadPoolAsync",
        structure: s109,
      },
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 11,
        name: "createOutputAsync",
        structure: s122,
      },
    ],
    template: o204
  },
});
const structures = [
  s0, s1, s2, s3, s4, s5, s6, s7, s8, s9,
  s10, s11, s12, s13, s14, s15, s16, s17, s18, s19,
  s20, s21, s22, s23, s24, s25, s26, s27, s28, s29,
  s30, s31, s32, s33, s34, s35, s36, s37, s38, s39,
  s40, s41, s42, s43, s44, s45, s46, s47, s48, s49,
  s50, s51, s52, s53, s54, s55, s56, s57, s58, s59,
  s60, s61, s62, s63, s64, s65, s66, s67, s68, s69,
  s70, s71, s72, s73, s74, s75, s76, s77, s78, s79,
  s80, s81, s82, s83, s84, s85, s86, s87, s88, s89,
  s90, s91, s92, s93, s94, s95, s96, s97, s98, s99,
  s100, s101, s102, s103, s104, s105, s106, s107, s108, s109,
  s110, s111, s112, s113, s114, s115, s116, s117, s118, s119,
  s120, s121, s122, s123,
];
const root = s123;
const settings = {
  runtimeSafety: false,
  littleEndian: true,
  libc: true,
};

// create runtime environment
const env = createEnvironment();

// recreate structures
env.recreateStructures(structures, settings);
env.loadModule(resolve(__dirname, "../lib/sepia.zigar", moduleName));
env.linkVariables(false);

// export root namespace and its methods and constants
const { constructor: v0 } = root;
const v1 = env.getSpecialExports();
const {
  kernel: v2,
  Input: v3,
  Output: v4,
  Parameters: v5,
  createOutput: v6,
  startThreadPool: v7,
  stopThreadPoolAsync: v8,
  createOutputAsync: v9,
} = v0;
export {
  v0 as default,
  v1 as __zigar,
  v2 as kernel,
  v3 as Input,
  v4 as Output,
  v5 as Parameters,
  v6 as createOutput,
  v7 as startThreadPool,
  v8 as stopThreadPoolAsync,
  v9 as createOutputAsync,
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