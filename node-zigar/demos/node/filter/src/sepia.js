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
const s40 = {}, s41 = {}, s42 = {}, s43 = {}, s44 = {}, s45 = {}, s46 = {}, s47 = {}, s48 = {}, s49 = {};
const s50 = {}, s51 = {}, s52 = {}, s53 = {}, s54 = {}, s55 = {}, s56 = {}, s57 = {}, s58 = {}, s59 = {};
const s60 = {}, s61 = {}, s62 = {}, s63 = {}, s64 = {}, s65 = {}, s66 = {}, s67 = {}, s68 = {}, s69 = {};
const s70 = {}, s71 = {}, s72 = {}, s73 = {}, s74 = {}, s75 = {}, s76 = {}, s77 = {}, s78 = {}, s79 = {};
const s80 = {}, s81 = {}, s82 = {}, s83 = {}, s84 = {}, s85 = {}, s86 = {}, s87 = {}, s88 = {}, s89 = {};
const s90 = {}, s91 = {}, s92 = {}, s93 = {}, s94 = {}, s95 = {}, s96 = {}, s97 = {}, s98 = {}, s99 = {};
const s100 = {}, s101 = {}, s102 = {}, s103 = {}, s104 = {}, s105 = {}, s106 = {}, s107 = {}, s108 = {}, s109 = {};
const s110 = {}, s111 = {}, s112 = {}, s113 = {}, s114 = {}, s115 = {}, s116 = {}, s117 = {}, s118 = {}, s119 = {};
const s120 = {}, s121 = {}, s122 = {}, s123 = {}, s124 = {}, s125 = {}, s126 = {}, s127 = {};

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
const o210 = {}, o211 = {}, o212 = {}, o213 = {}, o214 = {}, o215 = {}, o216 = {}, o217 = {}, o218 = {}, o219 = {};
const o220 = {}, o221 = {}, o222 = {}, o223 = {}, o224 = {}, o225 = {}, o226 = {}, o227 = {}, o228 = {}, o229 = {};
const o230 = {}, o231 = {}, o232 = {}, o233 = {}, o234 = {}, o235 = {}, o236 = {}, o237 = {}, o238 = {}, o239 = {};
const o240 = {}, o241 = {}, o242 = {}, o243 = {}, o244 = {}, o245 = {}, o246 = {}, o247 = {}, o248 = {};

// define byte arrays
const U = i => new Uint8Array(i);
const a0 = U([ 0, 0, 0, 0, 1, 0, 0, 0 ]);
const a1 = U(0);
const a2 = U(12);
const a3 = U(1);
const a4 = U(1);
const a5 = U([ 1 ]);
const a6 = U(32);
const a7 = U([ 4 ]);
const a8 = U(32);
const a9 = U(32);
const a10 = U([ 27, 0 ]);
const a11 = U([ 0, 1 ]);
const a12 = U(3);
const a13 = U(a5);
const a14 = U(3);
const a15 = U(1);
const a16 = U(1);
const a17 = U(a5);
const a18 = U([ 2 ]);
const a19 = U([ 3 ]);
const a20 = U(a7);
const a21 = U([ 5 ]);
const a22 = U(1);
const a23 = U(a5);
const a24 = U(a18);
const a25 = U(1);
const a26 = U(a5);
const a27 = U(a18);
const a28 = U(a19);
const a29 = U(a7);
const a30 = U(a21);
const a31 = U([ 6 ]);
const a32 = U(32);
const a33 = U(a10);
const a34 = U(16);
const a35 = U(32);
const a36 = U(a7);
const a37 = U(32);
const a38 = U(32);
const a39 = U(4);
const a40 = U([ 7, 0 ]);
const a41 = U([ 20, 0 ]);
const a42 = U(a10);
const a43 = U([ 29, 0 ]);
const a44 = U([ 30, 0 ]);
const a45 = U([ 31, 0 ]);
const a46 = U([ 32, 0 ]);
const a47 = U(16);
const a48 = U(a41);
const a49 = U(a10);
const a50 = U([ 33, 0 ]);
const a51 = U(16);
const a52 = U(8);
const a53 = U(8);
const a54 = U(1);
const a55 = U(1);
const a56 = U(1);
const a57 = U(8);
const a58 = U([ 0, 0, 0, 0, 0, 0, 240, 63 ]);
const a59 = U(8);
const a60 = U(a7);
const a61 = U(a7);
const a62 = U([ 253, 22, 89, 116, 150, 127, 0, 0 ]);
const a63 = U([ 65, 73, 70, 0 ]);
const a64 = U([ 25, 17, 89, 116, 150, 127, 0, 0 ]);
const a65 = U([ 65, 100, 111, 98, 101, 32, 83, 121, 115, 116, 101, 109, 115, 0 ]);
const a66 = U(a18);
const a67 = U([ 1, 18, 89, 116, 150, 127, 0, 0 ]);
const a68 = U([ 97, 32, 118, 97, 114, 105, 97, 98, 108, 101, 32, 115, 101, 112, 105, 97, 32, 102, 105, 108, 116, 101, 114, 0 ]);

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
  structure: s0,
  memory: { array: a1 },
  slots: {
    0: o6,
  },
});
$(o6, {
  structure: s2,
});
$(o7, {
  structure: s5,
  memory: { array: a2 },
});
$(o8, {
  structure: s3,
  memory: { array: a3 },
});
$(o9, {});
$(o10, {
  slots: {
    0: o11, 1: o12,
  },
});
$(o11, {
  structure: s9,
  memory: { array: a4 },
});
$(o12, {
  structure: s9,
  memory: { array: a5 },
});
$(o13, {});
$(o14, {
  memory: { array: a6 },
  handle: 193442,
  slots: {
    0: o15,
  },
});
$(o15, {
  structure: s7,
  memory: { array: a6, offset: 0, length: 16 },
  slots: {
    0: o16,
  },
});
$(o16, {
  structure: s6,
  memory: { array: a1 },
});
$(o17, {
  slots: {
    0: o18, 1: o19, 2: o21,
  },
});
$(o18, {
  structure: s0,
  memory: { array: a1 },
  slots: {
    0: o6,
  },
});
$(o19, {
  structure: s0,
  memory: { array: a1 },
  slots: {
    0: o20,
  },
});
$(o20, {
  structure: s12,
});
$(o21, {
  structure: s10,
  memory: { array: a1 },
  slots: {
    0: o22,
  },
});
$(o22, {
  structure: s1,
  memory: { array: a7 },
});
$(o23, {
  memory: { array: a8 },
  handle: 193442,
  slots: {
    0: o24,
  },
});
$(o24, {
  structure: s13,
  memory: { array: a9 },
  handle: 193442,
  slots: {
    0: o15,
  },
});
$(o25, {
  slots: {
    0: o26,
  },
});
$(o26, {
  structure: s15,
  memory: { array: a10 },
});
$(o27, {});
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
  structure: s0,
  memory: { array: a1 },
  slots: {
    0: o32,
  },
});
$(o32, {
  structure: s1,
});
$(o33, {
  structure: s18,
  memory: { array: a12 },
});
$(o34, {
  structure: s3,
  memory: { array: a13 },
});
$(o35, {});
$(o36, {
  slots: {
    0: o37, 1: o38, 2: o39,
  },
});
$(o37, {
  structure: s0,
  memory: { array: a1 },
  slots: {
    0: o32,
  },
});
$(o38, {
  structure: s18,
  memory: { array: a14 },
});
$(o39, {
  structure: s3,
  memory: { array: a15 },
});
$(o40, {});
$(o41, {});
$(o42, {
  memory: { array: a1 },
  handle: 303518,
});
$(o43, {
  memory: { array: a1 },
  handle: 303531,
});
$(o44, {
  memory: { array: a1 },
  handle: 323873,
});
$(o45, {});
$(o46, {
  memory: { array: a1 },
  handle: 323886,
});
$(o47, {
  memory: { array: a1 },
  handle: 323912,
});
$(o48, {
  slots: {
    0: o49, 1: o50, 2: o51, 3: o52, 4: o53, 5: o54, 6: o55,
  },
});
$(o49, {
  structure: s35,
  memory: { array: a1 },
  handle: 323860,
});
$(o50, {
  structure: s36,
  memory: { array: a16 },
});
$(o51, {
  structure: s36,
  memory: { array: a17 },
});
$(o52, {
  structure: s36,
  memory: { array: a18 },
});
$(o53, {
  structure: s36,
  memory: { array: a19 },
});
$(o54, {
  structure: s36,
  memory: { array: a20 },
});
$(o55, {
  structure: s36,
  memory: { array: a21 },
});
$(o56, {
  memory: { array: a1 },
  handle: 323899,
});
$(o57, {
  slots: {
    0: o58, 1: o59, 2: o60, 3: o61, 4: o62, 5: o63,
  },
});
$(o58, {
  structure: s30,
  memory: { array: a1 },
  handle: 323782,
});
$(o59, {
  structure: s33,
  memory: { array: a1 },
  handle: 323795,
});
$(o60, {
  structure: s38,
  memory: { array: a1 },
  handle: 323808,
});
$(o61, {
  structure: s39,
  memory: { array: a22 },
});
$(o62, {
  structure: s39,
  memory: { array: a23 },
});
$(o63, {
  structure: s39,
  memory: { array: a24 },
});
$(o64, {
  memory: { array: a1 },
  handle: 309882,
});
$(o65, {
  memory: { array: a1 },
  handle: 315041,
});
$(o66, {
  memory: { array: a1 },
  handle: 315054,
});
$(o67, {
  memory: { array: a1 },
  handle: 315067,
});
$(o68, {
  memory: { array: a1 },
  handle: 315080,
});
$(o69, {
  slots: {
    0: o70, 1: o71, 3: o72, 4: o73, 5: o74, 6: o75, 7: o76, 8: o77, 9: o78, 10: o79,
    11: o80, 12: o81, 13: o82, 14: o83, 15: o84, 16: o85,
  },
});
$(o70, {
  structure: s26,
  memory: { array: a1 },
  handle: 299896,
});
$(o71, {
  structure: s28,
  memory: { array: a1 },
  handle: 299909,
});
$(o72, {
  structure: s41,
  memory: { array: a1 },
  handle: 299922,
});
$(o73, {
  structure: s43,
  memory: { array: a1 },
  handle: 299935,
});
$(o74, {
  structure: s45,
  memory: { array: a1 },
  handle: 299948,
});
$(o75, {
  structure: s45,
  memory: { array: a1 },
  handle: 299961,
});
$(o76, {
  structure: s47,
  memory: { array: a1 },
  handle: 299974,
});
$(o77, {
  structure: s47,
  memory: { array: a1 },
  handle: 299987,
});
$(o78, {
  structure: s49,
  memory: { array: a1 },
  handle: 300000,
});
$(o79, {
  structure: s50,
  memory: { array: a25 },
});
$(o80, {
  structure: s50,
  memory: { array: a26 },
});
$(o81, {
  structure: s50,
  memory: { array: a27 },
});
$(o82, {
  structure: s50,
  memory: { array: a28 },
});
$(o83, {
  structure: s50,
  memory: { array: a29 },
});
$(o84, {
  structure: s50,
  memory: { array: a30 },
});
$(o85, {
  structure: s50,
  memory: { array: a31 },
});
$(o86, {});
$(o87, {
  memory: { array: a1 },
  handle: 300366,
});
$(o88, {
  memory: { array: a1 },
  handle: 301879,
});
$(o89, {});
$(o90, {});
$(o91, {});
$(o92, {
  memory: { array: a1 },
  handle: 265313,
});
$(o93, {
  memory: { array: a1 },
  handle: 268179,
});
$(o94, {});
$(o95, {});
$(o96, {
  memory: { array: a1 },
  handle: 272200,
});
$(o97, {
  memory: { array: a1 },
  handle: 273713,
});
$(o98, {});
$(o99, {});
$(o100, {
  memory: { array: a1 },
  handle: 273726,
});
$(o101, {
  memory: { array: a1 },
  handle: 275239,
});
$(o102, {});
$(o103, {
  memory: { array: a32 },
  handle: 193442,
  slots: {
    0: o104, 1: o106, 2: o108, 3: o110,
  },
});
$(o104, {
  structure: s53,
  memory: { array: a6, offset: 0, length: 8 },
  slots: {
    0: o105,
  },
});
$(o105, {
  structure: s52,
  memory: { array: a1 },
});
$(o106, {
  structure: s57,
  memory: { array: a6, offset: 8, length: 8 },
  slots: {
    0: o107,
  },
});
$(o107, {
  structure: s56,
  memory: { array: a1 },
});
$(o108, {
  structure: s60,
  memory: { array: a6, offset: 16, length: 8 },
  slots: {
    0: o109,
  },
});
$(o109, {
  structure: s59,
  memory: { array: a1 },
});
$(o110, {
  structure: s64,
  memory: { array: a6, offset: 24, length: 8 },
  slots: {
    0: o111,
  },
});
$(o111, {
  structure: s63,
  memory: { array: a1 },
});
$(o112, {});
$(o113, {});
$(o114, {
  memory: { array: a1 },
  handle: 276934,
});
$(o115, {});
$(o116, {
  memory: { array: a1 },
  handle: 277787,
});
$(o117, {});
$(o118, {
  memory: { array: a1 },
  handle: 277800,
});
$(o119, {});
$(o120, {
  memory: { array: a1 },
  handle: 277813,
});
$(o121, {
  slots: {
    0: o122,
  },
});
$(o122, {
  structure: s75,
  memory: { array: a33 },
});
$(o123, {
  memory: { array: a1 },
  handle: 276934,
});
$(o124, {
  memory: { array: a1 },
  handle: 277787,
});
$(o125, {
  memory: { array: a1 },
  handle: 277800,
});
$(o126, {
  memory: { array: a1 },
  handle: 277813,
});
$(o127, {
  memory: { array: a34 },
  handle: 246775,
  slots: {
    0: o128, 1: o129,
  },
});
$(o128, {
  structure: s20,
  memory: { array: a34, offset: 0, length: 8 },
});
$(o129, {
  structure: s66,
  memory: { array: a34, offset: 8, length: 8 },
});
$(o130, {
  slots: {
    0: o131, 1: o133, 2: o135, 3: o137, 4: o138, 5: o139, 6: o140, 7: o141, 8: o142, 9: o143,
  },
});
$(o131, {
  structure: s0,
  memory: { array: a1 },
  slots: {
    0: o132,
  },
});
$(o132, {
  structure: s75,
});
$(o133, {
  structure: s0,
  memory: { array: a1 },
  slots: {
    0: o134,
  },
});
$(o134, {
  structure: s76,
});
$(o135, {
  structure: s0,
  memory: { array: a1 },
  slots: {
    0: o136,
  },
});
$(o136, {
  structure: s65,
});
$(o137, {
  structure: s56,
  memory: { array: a1 },
  handle: 245211,
});
$(o138, {
  structure: s59,
  memory: { array: a1 },
  handle: 245224,
});
$(o139, {
  structure: s63,
  memory: { array: a1 },
  handle: 245237,
});
$(o140, {
  structure: s77,
  memory: { array: a1 },
  handle: 245250,
});
$(o141, {
  structure: s78,
  memory: { array: a1 },
  handle: 245263,
});
$(o142, {
  structure: s79,
  memory: { array: a1 },
  handle: 245276,
});
$(o143, {
  structure: s80,
  memory: { array: a1 },
  handle: 245289,
});
$(o144, {});
$(o145, {
  memory: { array: a35 },
  handle: 193442,
  slots: {
    0: o146,
  },
});
$(o146, {
  structure: s82,
  memory: { array: a6, offset: 0, length: 16 },
  slots: {
    0: o16,
  },
});
$(o147, {
  slots: {
    0: o148, 1: o149, 2: o150,
  },
});
$(o148, {
  structure: s0,
  memory: { array: a1 },
  slots: {
    0: o6,
  },
});
$(o149, {
  structure: s0,
  memory: { array: a1 },
  slots: {
    0: o20,
  },
});
$(o150, {
  structure: s10,
  memory: { array: a1 },
  slots: {
    0: o151,
  },
});
$(o151, {
  structure: s1,
  memory: { array: a36 },
});
$(o152, {
  memory: { array: a37 },
  handle: 193442,
  slots: {
    0: o153,
  },
});
$(o153, {
  structure: s83,
  memory: { array: a38 },
  handle: 193442,
  slots: {
    0: o146,
  },
});
$(o154, {
  memory: { array: a39 },
});
$(o155, {});
$(o156, {
  memory: { array: a1 },
  handle: 175576,
});
$(o157, {
  slots: {
    0: o158, 1: o159, 2: o160, 3: o161, 4: o162, 5: o163, 6: o164,
  },
});
$(o158, {
  structure: s88,
  memory: { array: a40 },
});
$(o159, {
  structure: s88,
  memory: { array: a41 },
});
$(o160, {
  structure: s88,
  memory: { array: a42 },
});
$(o161, {
  structure: s88,
  memory: { array: a43 },
});
$(o162, {
  structure: s88,
  memory: { array: a44 },
});
$(o163, {
  structure: s88,
  memory: { array: a45 },
});
$(o164, {
  structure: s88,
  memory: { array: a46 },
});
$(o165, {});
$(o166, {
  memory: { array: a1 },
  handle: 176492,
});
$(o167, {});
$(o168, {});
$(o169, {
  memory: { array: a1 },
  handle: 295619,
});
$(o170, {
  memory: { array: a1 },
  handle: 297132,
});
$(o171, {});
$(o172, {
  memory: { array: a47 },
  handle: 246775,
  slots: {
    0: o173, 1: o174,
  },
});
$(o173, {
  structure: s92,
  memory: { array: a34, offset: 0, length: 8 },
  slots: {
    0: o128,
  },
});
$(o174, {
  structure: s95,
  memory: { array: a34, offset: 8, length: 8 },
  slots: {
    0: o175,
  },
});
$(o175, {
  structure: s94,
  memory: { array: a1 },
});
$(o176, {});
$(o177, {
  memory: { array: a1 },
  handle: 177186,
});
$(o178, {
  slots: {
    0: o179, 1: o180,
  },
});
$(o179, {
  structure: s99,
  memory: { array: a48 },
});
$(o180, {
  structure: s99,
  memory: { array: a49 },
});
$(o181, {
  slots: {
    0: o182,
  },
});
$(o182, {
  structure: s101,
  memory: { array: a50 },
});
$(o183, {});
$(o184, {});
$(o185, {
  memory: { array: a1 },
  handle: 297145,
});
$(o186, {
  memory: { array: a1 },
  handle: 298658,
});
$(o187, {});
$(o188, {
  memory: { array: a51 },
  handle: 246775,
  slots: {
    0: o173, 1: o189,
  },
});
$(o189, {
  structure: s105,
  memory: { array: a34, offset: 8, length: 8 },
  slots: {
    0: o190,
  },
});
$(o190, {
  structure: s104,
  memory: { array: a1 },
});
$(o191, {});
$(o192, {
  memory: { array: a52 },
  handle: 247419,
  slots: {
    0: o193,
  },
});
$(o193, {
  structure: s108,
  memory: { array: a53 },
  handle: 247419,
});
$(o194, {});
$(o195, {
  memory: { array: a1 },
  handle: 178945,
});
$(o196, {
  memory: { array: a54 },
});
$(o197, {});
$(o198, {
  memory: { array: a55 },
});
$(o199, {});
$(o200, {
  memory: { array: a56 },
});
$(o201, {});
$(o202, {});
$(o203, {
  slots: {
    0: o204, 1: o206, 2: o208, 3: o210,
  },
});
$(o204, {
  structure: s0,
  memory: { array: a1 },
  slots: {
    0: o205,
  },
});
$(o205, {
  structure: s11,
});
$(o206, {
  structure: s118,
  memory: { array: a1 },
  slots: {
    0: o207,
  },
});
$(o207, {
  structure: s119,
  memory: { array: a57 },
});
$(o208, {
  structure: s118,
  memory: { array: a1 },
  slots: {
    0: o209,
  },
});
$(o209, {
  structure: s119,
  memory: { array: a58 },
});
$(o210, {
  structure: s118,
  memory: { array: a1 },
  slots: {
    0: o211,
  },
});
$(o211, {
  structure: s119,
  memory: { array: a59 },
});
$(o212, {
  slots: {
    0: o213,
  },
});
$(o213, {
  structure: s120,
  memory: { array: a1 },
  slots: {
    0: o204, 1: o206, 2: o208, 3: o210,
  },
});
$(o214, {
  slots: {
    0: o215,
  },
});
$(o215, {
  structure: s10,
  memory: { array: a1 },
  slots: {
    0: o216,
  },
});
$(o216, {
  structure: s1,
  memory: { array: a60 },
});
$(o217, {
  slots: {
    0: o218,
  },
});
$(o218, {
  structure: s122,
  memory: { array: a1 },
  slots: {
    0: o215,
  },
});
$(o219, {
  slots: {
    0: o220,
  },
});
$(o220, {
  structure: s10,
  memory: { array: a1 },
  slots: {
    0: o221,
  },
});
$(o221, {
  structure: s1,
  memory: { array: a61 },
});
$(o222, {
  slots: {
    0: o223,
  },
});
$(o223, {
  structure: s124,
  memory: { array: a1 },
  slots: {
    0: o220,
  },
});
$(o224, {
  slots: {
    0: o225, 1: o227, 2: o229, 3: o231, 4: o233, 5: o234, 6: o235,
  },
});
$(o225, {
  structure: s113,
  memory: { array: a62 },
  handle: 184671,
  slots: {
    0: o226,
  },
});
$(o226, {
  structure: s112,
  memory: { array: a63 },
});
$(o227, {
  structure: s115,
  memory: { array: a64 },
  handle: 184684,
  slots: {
    0: o228,
  },
});
$(o228, {
  structure: s114,
  memory: { array: a65 },
});
$(o229, {
  structure: s10,
  memory: { array: a1 },
  slots: {
    0: o230,
  },
});
$(o230, {
  structure: s1,
  memory: { array: a66 },
});
$(o231, {
  structure: s117,
  memory: { array: a67 },
  handle: 184697,
  slots: {
    0: o232,
  },
});
$(o232, {
  structure: s116,
  memory: { array: a68 },
});
$(o233, {
  structure: s121,
  memory: { array: a1 },
  slots: {
    0: o213,
  },
});
$(o234, {
  structure: s123,
  memory: { array: a1 },
  slots: {
    0: o218,
  },
});
$(o235, {
  structure: s125,
  memory: { array: a1 },
  slots: {
    0: o223,
  },
});
$(o236, {
  slots: {
    0: o237, 1: o239, 2: o241, 3: o243, 4: o245, 10: o246, 11: o247, 12: o248,
  },
});
$(o237, {
  structure: s0,
  memory: { array: a1 },
  slots: {
    0: o238,
  },
});
$(o238, {
  structure: s126,
});
$(o239, {
  structure: s0,
  memory: { array: a1 },
  slots: {
    0: o240,
  },
});
$(o240, {
  structure: s84,
});
$(o241, {
  structure: s0,
  memory: { array: a1 },
  slots: {
    0: o242,
  },
});
$(o242, {
  structure: s14,
});
$(o243, {
  structure: s0,
  memory: { array: a1 },
  slots: {
    0: o244,
  },
});
$(o244, {
  structure: s85,
});
$(o245, {
  structure: s87,
  memory: { array: a1 },
  handle: 159615,
});
$(o246, {
  structure: s91,
  memory: { array: a1 },
  handle: 159628,
});
$(o247, {
  structure: s98,
  memory: { array: a1 },
  handle: 159641,
});
$(o248, {
  structure: s111,
  memory: { array: a1 },
  handle: 159654,
});

// fill in structure properties
$(s0, {
  ...s,
  flags: 9,
  signature: 0x7fd3df143c9cd14an,
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
        structure: s0,
      },
    ],
    template: o0
  },
  static: {
    members: [],
  },
  name: "type",
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
  type: 10,
  flags: 32,
  signature: 0x2b2cf86f480e5680n,
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
  static: {
    members: [],
  },
  name: "@Vector(4, u8)",
});
$(s3, {
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
        structure: s3,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "bool",
});
$(s4, {
  ...s,
  type: 2,
  flags: 10,
  signature: 0x960781b441c39140n,
  byteSize: 8,
  align: 4,
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
        structure: s3,
      },
    ],
    template: o1
  },
  static: {
    members: [],
  },
  name: "S0",
});
$(s5, {
  ...s,
  type: 7,
  flags: 43,
  signature: 0x01a37275ac243c7an,
  byteSize: 12,
  align: 4,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 64,
        byteSize: 8,
        bitOffset: 0,
        slot: 0,
        structure: s4,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitOffset: 64,
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
$(s6, {
  ...s,
  type: 9,
  flags: 410,
  signature: 0x94852809f0e2c350n,
  byteSize: 4,
  align: 4,
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
  name: "[_]@Vector(4, u8)",
});
$(s7, {
  ...s,
  type: 8,
  flags: 124,
  signature: 0x7303fed28cd8baa0n,
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
        structure: s6,
      },
    ],
    template: o9
  },
  static: {
    members: [],
  },
  name: "[]@Vector(4, u8)",
});
$(s8, {
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
        structure: s8,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "u32",
});
$(s9, {
  ...s,
  name: "ColorSpace",
  type: 6,
  flags: 1,
  signature: 0x1a2a0afa69e514fcn,
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
        structure: s9,
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
        structure: s9,
      },
      {
        ...m,
        name: "display-p3",
        type: 5,
        flags: 4,
        slot: 1,
        structure: s9,
      },
    ],
    template: o10
  },
});
$(s10, {
  ...s,
  flags: 9,
  signature: 0x9eeca1f200027e77n,
  byteSize: 0,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 0,
        byteSize: 0,
        bitOffset: 0,
        slot: 0,
        structure: s10,
      },
    ],
    template: o13
  },
  static: {
    members: [],
  },
  name: "comptime",
});
$(s11, {
  ...s,
  flags: 1,
  signature: 0xb964b9ada17bde2cn,
  byteSize: 4,
  align: 4,
  instance: {
    members: [
      {
        ...m,
        type: 4,
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
  name: "f32",
});
$(s12, {
  ...s,
  type: 10,
  flags: 32,
  signature: 0xaa00e4946712b185n,
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
        structure: s11,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "@Vector(4, f32)",
});
$(s13, {
  ...s,
  type: 2,
  flags: 14,
  signature: 0xe564db1de526e4bdn,
  byteSize: 32,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "data",
        type: 5,
        flags: 2049,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
        slot: 0,
        structure: s7,
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
        structure: s8,
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
        structure: s8,
      },
      {
        ...m,
        name: "colorSpace",
        type: 3,
        bitOffset: 192,
        bitSize: 1,
        byteSize: 1,
        slot: 3,
        structure: s9,
      },
    ],
    template: o14
  },
  static: {
    members: [
      {
        ...m,
        name: "Pixel",
        type: 5,
        flags: 2,
        slot: 0,
        structure: s0,
      },
      {
        ...m,
        name: "FPixel",
        type: 5,
        flags: 2,
        slot: 1,
        structure: s0,
      },
      {
        ...m,
        name: "channels",
        type: 5,
        flags: 2,
        slot: 2,
        structure: s10,
      },
    ],
    template: o17
  },
  name: "S1",
});
$(s14, {
  ...s,
  type: 2,
  flags: 270,
  signature: 0x42d7742699675128n,
  byteSize: 32,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "dst",
        type: 5,
        bitOffset: 0,
        bitSize: 256,
        byteSize: 32,
        slot: 0,
        structure: s13,
      },
    ],
    template: o23
  },
  static: {
    members: [],
  },
  name: "S2",
});
$(s15, {
  ...s,
  type: 5,
  flags: 1,
  signature: 0x003bc02d80e29180n,
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
        structure: s15,
      },
    ],
  },
  static: {
    members: [
      {
        ...m,
        name: "OutOfMemory",
        type: 5,
        flags: 4,
        slot: 0,
        structure: s15,
      },
    ],
    template: o25
  },
  name: "ES0",
});
$(s16, {
  ...s,
  type: 4,
  flags: 15,
  signature: 0x577c8f2024cc62b0n,
  byteSize: 40,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitOffset: 0,
        bitSize: 256,
        byteSize: 32,
        slot: 0,
        structure: s14,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitOffset: 256,
        bitSize: 16,
        byteSize: 2,
        structure: s15,
      },
    ],
    template: o27
  },
  static: {
    members: [],
  },
  name: "ES0!S2",
});
$(s17, {
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
        structure: s3,
      },
    ],
    template: o28
  },
  static: {
    members: [],
  },
  name: "S3",
});
$(s18, {
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
        structure: s17,
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
  name: "?S3",
});
$(s19, {
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
$(s20, {
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
        structure: s19,
      },
    ],
    template: o35
  },
  static: {
    members: [],
  },
  name: "*opaque",
});
$(s21, {
  ...s,
  type: 9,
  flags: 464,
  signature: 0x3ee4c60c00bcc22cn,
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
  static: {
    members: [],
    template: o36
  },
  name: "[_]u8",
});
$(s22, {
  ...s,
  type: 8,
  flags: 92,
  signature: 0x6b4922acc2aa1729n,
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
        structure: s21,
      },
    ],
    template: o40
  },
  static: {
    members: [],
  },
  name: "[*]u8",
});
$(s23, {
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
        structure: s23,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "usize",
});
$(s24, {
  ...s,
  type: 7,
  flags: 15,
  signature: 0x7b48561de1668547n,
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
        structure: s22,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: s23,
      },
    ],
    template: o41
  },
  static: {
    members: [],
  },
  name: "?[*]u8",
});
$(s25, {
  ...s,
  type: 12,
  signature: 0x2a8e057d3fac55c3n,
  length: 1,
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 3,
        flags: 1,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: s23,
      },
      {
        ...m,
        name: "0",
        type: 3,
        flags: 1,
        bitOffset: 64,
        bitSize: 6,
        byteSize: 1,
        slot: 1,
        structure: s50,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "Arg(fn (Alignment) usize)",
});
$(s26, {
  ...s,
  type: 14,
  signature: 0xcada47f9c16c3a87n,
  length: 1,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 128,
        byteSize: 16,
        structure: s25,
      },
    ],
    template: o42
  },
  static: {
    members: [],
  },
  name: "fn (Alignment) usize",
});
$(s27, {
  ...s,
  type: 12,
  signature: 0x8e1a4c456f3a4bf3n,
  length: 1,
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 3,
        flags: 1,
        bitOffset: 64,
        bitSize: 6,
        byteSize: 1,
        slot: 0,
        structure: s50,
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
        structure: s23,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "Arg(fn (usize) Alignment)",
});
$(s28, {
  ...s,
  type: 14,
  signature: 0x0353c8d18f3b5451n,
  length: 1,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 128,
        byteSize: 16,
        structure: s27,
      },
    ],
    template: o43
  },
  static: {
    members: [],
  },
  name: "fn (usize) Alignment",
});
$(s29, {
  ...s,
  type: 12,
  signature: 0xdd2c6cd0895aaaafn,
  length: 1,
  byteSize: 2,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 3,
        flags: 1,
        bitOffset: 0,
        bitSize: 2,
        byteSize: 1,
        slot: 0,
        structure: s39,
      },
      {
        ...m,
        name: "0",
        type: 3,
        flags: 1,
        bitOffset: 8,
        bitSize: 2,
        byteSize: 1,
        slot: 1,
        structure: s39,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "Arg(fn (Order) Order)",
});
$(s30, {
  ...s,
  type: 14,
  signature: 0x4556ad567359c057n,
  length: 1,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 16,
        byteSize: 2,
        structure: s29,
      },
    ],
    template: o44
  },
  static: {
    members: [],
  },
  name: "fn (Order) Order",
});
$(s31, {
  ...s,
  type: 7,
  flags: 33,
  signature: 0x3dd59d2a12841050n,
  byteSize: 2,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 2,
        byteSize: 1,
        bitOffset: 0,
        slot: 0,
        structure: s39,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitOffset: 8,
        bitSize: 8,
        byteSize: 1,
        structure: s1,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "?Order",
});
$(s32, {
  ...s,
  type: 12,
  flags: 10,
  signature: 0x6b752ee8e13b7ecfn,
  length: 1,
  byteSize: 3,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 16,
        byteSize: 2,
        slot: 0,
        structure: s31,
      },
      {
        ...m,
        name: "0",
        type: 3,
        flags: 1,
        bitOffset: 16,
        bitSize: 2,
        byteSize: 1,
        slot: 1,
        structure: s39,
      },
    ],
    template: o45
  },
  static: {
    members: [],
  },
  name: "Arg(fn (Order) ?Order)",
});
$(s33, {
  ...s,
  type: 14,
  signature: 0x23895f9be71924f6n,
  length: 1,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 24,
        byteSize: 3,
        structure: s32,
      },
    ],
    template: o46
  },
  static: {
    members: [],
  },
  name: "fn (Order) ?Order",
});
$(s34, {
  ...s,
  type: 12,
  signature: 0x1112ed04d9135c68n,
  length: 1,
  byteSize: 2,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 3,
        flags: 1,
        bitOffset: 0,
        bitSize: 3,
        byteSize: 1,
        slot: 0,
        structure: s36,
      },
      {
        ...m,
        name: "0",
        type: 3,
        flags: 1,
        bitOffset: 8,
        bitSize: 3,
        byteSize: 1,
        slot: 1,
        structure: s36,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "Arg(fn (CompareOperator) CompareOperator)",
});
$(s35, {
  ...s,
  type: 14,
  signature: 0x04d406b3f95be9adn,
  length: 1,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 16,
        byteSize: 2,
        structure: s34,
      },
    ],
    template: o47
  },
  static: {
    members: [],
  },
  name: "fn (CompareOperator) CompareOperator",
});
$(s36, {
  ...s,
  name: "CompareOperator",
  type: 6,
  flags: 1,
  signature: 0x10893b0878b048a0n,
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 3,
        byteSize: 1,
        bitOffset: 0,
        structure: s36,
      },
    ],
  },
  static: {
    members: [
      {
        ...m,
        name: "reverse",
        type: 5,
        flags: 562,
        slot: 0,
        structure: s35,
      },
      {
        ...m,
        name: "lt",
        type: 5,
        flags: 4,
        slot: 1,
        structure: s36,
      },
      {
        ...m,
        name: "lte",
        type: 5,
        flags: 4,
        slot: 2,
        structure: s36,
      },
      {
        ...m,
        name: "eq",
        type: 5,
        flags: 4,
        slot: 3,
        structure: s36,
      },
      {
        ...m,
        name: "gte",
        type: 5,
        flags: 4,
        slot: 4,
        structure: s36,
      },
      {
        ...m,
        name: "gt",
        type: 5,
        flags: 4,
        slot: 5,
        structure: s36,
      },
      {
        ...m,
        name: "neq",
        type: 5,
        flags: 4,
        slot: 6,
        structure: s36,
      },
    ],
    template: o48
  },
});
$(s37, {
  ...s,
  type: 12,
  signature: 0x3a73a3888170629an,
  length: 2,
  byteSize: 3,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 1,
        flags: 1,
        bitOffset: 0,
        bitSize: 1,
        byteSize: 1,
        slot: 0,
        structure: s3,
      },
      {
        ...m,
        name: "0",
        type: 3,
        flags: 1,
        bitOffset: 8,
        bitSize: 2,
        byteSize: 1,
        slot: 1,
        structure: s39,
      },
      {
        ...m,
        name: "1",
        type: 3,
        flags: 1,
        bitOffset: 16,
        bitSize: 3,
        byteSize: 1,
        slot: 2,
        structure: s36,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "Arg(fn (Order, CompareOperator) bool)",
});
$(s38, {
  ...s,
  type: 14,
  signature: 0x67c715f953df34abn,
  length: 2,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 24,
        byteSize: 3,
        structure: s37,
      },
    ],
    template: o56
  },
  static: {
    members: [],
  },
  name: "fn (Order, CompareOperator) bool",
});
$(s39, {
  ...s,
  name: "Order",
  type: 6,
  flags: 1,
  signature: 0x4f420ca6108bec6fn,
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
        structure: s39,
      },
    ],
  },
  static: {
    members: [
      {
        ...m,
        name: "invert",
        type: 5,
        flags: 562,
        slot: 0,
        structure: s30,
      },
      {
        ...m,
        name: "differ",
        type: 5,
        flags: 562,
        slot: 1,
        structure: s33,
      },
      {
        ...m,
        name: "compare",
        type: 5,
        flags: 50,
        slot: 2,
        structure: s38,
      },
      {
        ...m,
        name: "gt",
        type: 5,
        flags: 4,
        slot: 3,
        structure: s39,
      },
      {
        ...m,
        name: "lt",
        type: 5,
        flags: 4,
        slot: 4,
        structure: s39,
      },
      {
        ...m,
        name: "eq",
        type: 5,
        flags: 4,
        slot: 5,
        structure: s39,
      },
    ],
    template: o57
  },
});
$(s40, {
  ...s,
  type: 12,
  signature: 0x555ad0f759586049n,
  length: 2,
  byteSize: 3,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 3,
        flags: 1,
        bitOffset: 0,
        bitSize: 2,
        byteSize: 1,
        slot: 0,
        structure: s39,
      },
      {
        ...m,
        name: "0",
        type: 3,
        flags: 1,
        bitOffset: 8,
        bitSize: 6,
        byteSize: 1,
        slot: 1,
        structure: s50,
      },
      {
        ...m,
        name: "1",
        type: 3,
        flags: 1,
        bitOffset: 16,
        bitSize: 6,
        byteSize: 1,
        slot: 2,
        structure: s50,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "Arg(fn (Alignment, Alignment) Order)",
});
$(s41, {
  ...s,
  type: 14,
  signature: 0x987630ac1b70cdf7n,
  length: 2,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 24,
        byteSize: 3,
        structure: s40,
      },
    ],
    template: o64
  },
  static: {
    members: [],
  },
  name: "fn (Alignment, Alignment) Order",
});
$(s42, {
  ...s,
  type: 12,
  signature: 0xa45a5b343ff9e13dn,
  length: 3,
  byteSize: 4,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 1,
        flags: 1,
        bitOffset: 0,
        bitSize: 1,
        byteSize: 1,
        slot: 0,
        structure: s3,
      },
      {
        ...m,
        name: "0",
        type: 3,
        flags: 1,
        bitOffset: 8,
        bitSize: 6,
        byteSize: 1,
        slot: 1,
        structure: s50,
      },
      {
        ...m,
        name: "1",
        type: 3,
        flags: 1,
        bitOffset: 16,
        bitSize: 3,
        byteSize: 1,
        slot: 2,
        structure: s36,
      },
      {
        ...m,
        name: "2",
        type: 3,
        flags: 1,
        bitOffset: 24,
        bitSize: 6,
        byteSize: 1,
        slot: 3,
        structure: s50,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "Arg(fn (Alignment, CompareOperator, Alignment) bool)",
});
$(s43, {
  ...s,
  type: 14,
  signature: 0x206335b70673a104n,
  length: 3,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 32,
        byteSize: 4,
        structure: s42,
      },
    ],
    template: o65
  },
  static: {
    members: [],
  },
  name: "fn (Alignment, CompareOperator, Alignment) bool",
});
$(s44, {
  ...s,
  type: 12,
  signature: 0xe56c033a4acfb6f2n,
  length: 2,
  byteSize: 3,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 3,
        flags: 1,
        bitOffset: 0,
        bitSize: 6,
        byteSize: 1,
        slot: 0,
        structure: s50,
      },
      {
        ...m,
        name: "0",
        type: 3,
        flags: 1,
        bitOffset: 8,
        bitSize: 6,
        byteSize: 1,
        slot: 1,
        structure: s50,
      },
      {
        ...m,
        name: "1",
        type: 3,
        flags: 1,
        bitOffset: 16,
        bitSize: 6,
        byteSize: 1,
        slot: 2,
        structure: s50,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "Arg(fn (Alignment, Alignment) Alignment)",
});
$(s45, {
  ...s,
  type: 14,
  signature: 0xf1298fc476137d0bn,
  length: 2,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 24,
        byteSize: 3,
        structure: s44,
      },
    ],
    template: o66
  },
  static: {
    members: [],
  },
  name: "fn (Alignment, Alignment) Alignment",
});
$(s46, {
  ...s,
  type: 12,
  signature: 0x6d1e9a0f800746ddn,
  length: 2,
  byteSize: 24,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 3,
        flags: 1,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: s23,
      },
      {
        ...m,
        name: "0",
        type: 3,
        flags: 1,
        bitOffset: 128,
        bitSize: 6,
        byteSize: 1,
        slot: 1,
        structure: s50,
      },
      {
        ...m,
        name: "1",
        type: 3,
        flags: 1,
        bitOffset: 64,
        bitSize: 64,
        byteSize: 8,
        slot: 2,
        structure: s23,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "Arg(fn (Alignment, usize) usize)",
});
$(s47, {
  ...s,
  type: 14,
  signature: 0xdb7960d77aa44c71n,
  length: 2,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 192,
        byteSize: 24,
        structure: s46,
      },
    ],
    template: o67
  },
  static: {
    members: [],
  },
  name: "fn (Alignment, usize) usize",
});
$(s48, {
  ...s,
  type: 12,
  signature: 0x2ec6e84ed8be9922n,
  length: 2,
  byteSize: 16,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 1,
        flags: 1,
        bitOffset: 64,
        bitSize: 1,
        byteSize: 1,
        slot: 0,
        structure: s3,
      },
      {
        ...m,
        name: "0",
        type: 3,
        flags: 1,
        bitOffset: 72,
        bitSize: 6,
        byteSize: 1,
        slot: 1,
        structure: s50,
      },
      {
        ...m,
        name: "1",
        type: 3,
        flags: 1,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 2,
        structure: s23,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "Arg(fn (Alignment, usize) bool)",
});
$(s49, {
  ...s,
  type: 14,
  signature: 0x4f9531acbd69c56bn,
  length: 2,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 128,
        byteSize: 16,
        structure: s48,
      },
    ],
    template: o68
  },
  static: {
    members: [],
  },
  name: "fn (Alignment, usize) bool",
});
$(s50, {
  ...s,
  name: "Alignment",
  type: 6,
  flags: 33,
  signature: 0x10c2b479f949ea69n,
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 6,
        byteSize: 1,
        bitOffset: 0,
        structure: s50,
      },
    ],
  },
  static: {
    members: [
      {
        ...m,
        name: "toByteUnits",
        type: 5,
        flags: 50,
        slot: 0,
        structure: s26,
      },
      {
        ...m,
        name: "fromByteUnits",
        type: 5,
        flags: 514,
        slot: 1,
        structure: s28,
      },
      {
        ...m,
        name: "order",
        type: 5,
        flags: 562,
        slot: 3,
        structure: s41,
      },
      {
        ...m,
        name: "compare",
        type: 5,
        flags: 50,
        slot: 4,
        structure: s43,
      },
      {
        ...m,
        name: "max",
        type: 5,
        flags: 562,
        slot: 5,
        structure: s45,
      },
      {
        ...m,
        name: "min",
        type: 5,
        flags: 562,
        slot: 6,
        structure: s45,
      },
      {
        ...m,
        name: "forward",
        type: 5,
        flags: 50,
        slot: 7,
        structure: s47,
      },
      {
        ...m,
        name: "backward",
        type: 5,
        flags: 50,
        slot: 8,
        structure: s47,
      },
      {
        ...m,
        name: "check",
        type: 5,
        flags: 50,
        slot: 9,
        structure: s49,
      },
      {
        ...m,
        name: "1",
        type: 5,
        flags: 4,
        slot: 10,
        structure: s50,
      },
      {
        ...m,
        name: "2",
        type: 5,
        flags: 4,
        slot: 11,
        structure: s50,
      },
      {
        ...m,
        name: "4",
        type: 5,
        flags: 4,
        slot: 12,
        structure: s50,
      },
      {
        ...m,
        name: "8",
        type: 5,
        flags: 4,
        slot: 13,
        structure: s50,
      },
      {
        ...m,
        name: "16",
        type: 5,
        flags: 4,
        slot: 14,
        structure: s50,
      },
      {
        ...m,
        name: "32",
        type: 5,
        flags: 4,
        slot: 15,
        structure: s50,
      },
      {
        ...m,
        name: "64",
        type: 5,
        flags: 4,
        slot: 16,
        structure: s50,
      },
    ],
    template: o69
  },
});
$(s51, {
  ...s,
  type: 12,
  flags: 14,
  signature: 0x6a48ad5485a09d1bn,
  length: 4,
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
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: s24,
      },
      {
        ...m,
        name: "0",
        type: 5,
        flags: 1,
        bitOffset: 64,
        bitSize: 64,
        byteSize: 8,
        slot: 1,
        structure: s20,
      },
      {
        ...m,
        name: "1",
        type: 3,
        flags: 1,
        bitOffset: 128,
        bitSize: 64,
        byteSize: 8,
        slot: 2,
        structure: s23,
      },
      {
        ...m,
        name: "2",
        type: 3,
        flags: 1,
        bitOffset: 256,
        bitSize: 6,
        byteSize: 1,
        slot: 3,
        structure: s50,
      },
      {
        ...m,
        name: "3",
        type: 3,
        flags: 1,
        bitOffset: 192,
        bitSize: 64,
        byteSize: 8,
        slot: 4,
        structure: s23,
      },
    ],
    template: o86
  },
  static: {
    members: [],
  },
  name: "Arg(fn (*opaque, usize, Alignment, usize) ?[*]u8)",
});
$(s52, {
  ...s,
  type: 14,
  signature: 0x24f0769ea612b5d9n,
  length: 4,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 320,
        byteSize: 40,
        structure: s51,
      },
    ],
    template: o87
  },
  static: {
    members: [],
    template: o88
  },
  name: "fn (*opaque, usize, Alignment, usize) ?[*]u8",
});
$(s53, {
  ...s,
  type: 8,
  flags: 396,
  signature: 0x48b13a411d319211n,
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
        structure: s52,
      },
    ],
    template: o89
  },
  static: {
    members: [],
  },
  name: "*const fn (*opaque, usize, Alignment, usize) ?[*]u8",
});
$(s54, {
  ...s,
  type: 8,
  flags: 124,
  signature: 0x94f49c493a527b38n,
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
    template: o90
  },
  static: {
    members: [],
  },
  name: "[]u8",
});
$(s55, {
  ...s,
  type: 12,
  flags: 14,
  signature: 0x8223575b7c62e19dn,
  length: 5,
  byteSize: 48,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 1,
        flags: 1,
        bitOffset: 320,
        bitSize: 1,
        byteSize: 1,
        slot: 0,
        structure: s3,
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
        structure: s20,
      },
      {
        ...m,
        name: "1",
        type: 5,
        flags: 1,
        bitOffset: 64,
        bitSize: 128,
        byteSize: 16,
        slot: 2,
        structure: s54,
      },
      {
        ...m,
        name: "2",
        type: 3,
        flags: 1,
        bitOffset: 328,
        bitSize: 6,
        byteSize: 1,
        slot: 3,
        structure: s50,
      },
      {
        ...m,
        name: "3",
        type: 3,
        flags: 1,
        bitOffset: 192,
        bitSize: 64,
        byteSize: 8,
        slot: 4,
        structure: s23,
      },
      {
        ...m,
        name: "4",
        type: 3,
        flags: 1,
        bitOffset: 256,
        bitSize: 64,
        byteSize: 8,
        slot: 5,
        structure: s23,
      },
    ],
    template: o91
  },
  static: {
    members: [],
  },
  name: "Arg(fn (*opaque, []u8, Alignment, usize, usize) bool)",
});
$(s56, {
  ...s,
  type: 14,
  signature: 0xae5e7bd9b87f8520n,
  length: 5,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 384,
        byteSize: 48,
        structure: s55,
      },
    ],
    template: o92
  },
  static: {
    members: [],
    template: o93
  },
  name: "fn (*opaque, []u8, Alignment, usize, usize) bool",
});
$(s57, {
  ...s,
  type: 8,
  flags: 396,
  signature: 0xa13115bf6eac0a84n,
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
        structure: s56,
      },
    ],
    template: o94
  },
  static: {
    members: [],
  },
  name: "*const fn (*opaque, []u8, Alignment, usize, usize) bool",
});
$(s58, {
  ...s,
  type: 12,
  flags: 14,
  signature: 0xbadd5ef506c6c75bn,
  length: 5,
  byteSize: 56,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: s24,
      },
      {
        ...m,
        name: "0",
        type: 5,
        flags: 1,
        bitOffset: 64,
        bitSize: 64,
        byteSize: 8,
        slot: 1,
        structure: s20,
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
        structure: s54,
      },
      {
        ...m,
        name: "2",
        type: 3,
        flags: 1,
        bitOffset: 384,
        bitSize: 6,
        byteSize: 1,
        slot: 3,
        structure: s50,
      },
      {
        ...m,
        name: "3",
        type: 3,
        flags: 1,
        bitOffset: 256,
        bitSize: 64,
        byteSize: 8,
        slot: 4,
        structure: s23,
      },
      {
        ...m,
        name: "4",
        type: 3,
        flags: 1,
        bitOffset: 320,
        bitSize: 64,
        byteSize: 8,
        slot: 5,
        structure: s23,
      },
    ],
    template: o95
  },
  static: {
    members: [],
  },
  name: "Arg(fn (*opaque, []u8, Alignment, usize, usize) ?[*]u8)",
});
$(s59, {
  ...s,
  type: 14,
  signature: 0x2a476dc4282d3651n,
  length: 5,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 448,
        byteSize: 56,
        structure: s58,
      },
    ],
    template: o96
  },
  static: {
    members: [],
    template: o97
  },
  name: "fn (*opaque, []u8, Alignment, usize, usize) ?[*]u8",
});
$(s60, {
  ...s,
  type: 8,
  flags: 396,
  signature: 0x7c1fbfc252342195n,
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
        structure: s59,
      },
    ],
    template: o98
  },
  static: {
    members: [],
  },
  name: "*const fn (*opaque, []u8, Alignment, usize, usize) ?[*]u8",
});
$(s61, {
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
        structure: s61,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "void",
});
$(s62, {
  ...s,
  type: 12,
  flags: 14,
  signature: 0x92bae266d964e602n,
  length: 4,
  byteSize: 40,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        flags: 1,
        bitOffset: 256,
        bitSize: 0,
        byteSize: 0,
        slot: 0,
        structure: s61,
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
        structure: s20,
      },
      {
        ...m,
        name: "1",
        type: 5,
        flags: 1,
        bitOffset: 64,
        bitSize: 128,
        byteSize: 16,
        slot: 2,
        structure: s54,
      },
      {
        ...m,
        name: "2",
        type: 3,
        flags: 1,
        bitOffset: 256,
        bitSize: 6,
        byteSize: 1,
        slot: 3,
        structure: s50,
      },
      {
        ...m,
        name: "3",
        type: 3,
        flags: 1,
        bitOffset: 192,
        bitSize: 64,
        byteSize: 8,
        slot: 4,
        structure: s23,
      },
    ],
    template: o99
  },
  static: {
    members: [],
  },
  name: "Arg(fn (*opaque, []u8, Alignment, usize) void)",
});
$(s63, {
  ...s,
  type: 14,
  signature: 0x192e0fddf4e3cee0n,
  length: 4,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 320,
        byteSize: 40,
        structure: s62,
      },
    ],
    template: o100
  },
  static: {
    members: [],
    template: o101
  },
  name: "fn (*opaque, []u8, Alignment, usize) void",
});
$(s64, {
  ...s,
  type: 8,
  flags: 396,
  signature: 0xe1a99eb544aca4e8n,
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
        structure: s63,
      },
    ],
    template: o102
  },
  static: {
    members: [],
  },
  name: "*const fn (*opaque, []u8, Alignment, usize) void",
});
$(s65, {
  ...s,
  name: "VTable",
  type: 2,
  flags: 14,
  signature: 0xe70cc1cba84ca0d1n,
  byteSize: 32,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "alloc",
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: s53,
      },
      {
        ...m,
        name: "resize",
        type: 5,
        flags: 1,
        bitOffset: 64,
        bitSize: 64,
        byteSize: 8,
        slot: 1,
        structure: s57,
      },
      {
        ...m,
        name: "remap",
        type: 5,
        flags: 1,
        bitOffset: 128,
        bitSize: 64,
        byteSize: 8,
        slot: 2,
        structure: s60,
      },
      {
        ...m,
        name: "free",
        type: 5,
        flags: 1,
        bitOffset: 192,
        bitSize: 64,
        byteSize: 8,
        slot: 3,
        structure: s64,
      },
    ],
    template: o103
  },
  static: {
    members: [],
  },
});
$(s66, {
  ...s,
  type: 8,
  flags: 412,
  signature: 0xbc33da823ad41b4dn,
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
        structure: s65,
      },
    ],
    template: o112
  },
  static: {
    members: [],
  },
  name: "*const VTable",
});
$(s67, {
  ...s,
  type: 12,
  flags: 46,
  signature: 0xb7feaa1a6739f86an,
  length: 3,
  byteSize: 48,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: s24,
      },
      {
        ...m,
        name: "0",
        type: 5,
        flags: 1,
        bitOffset: 64,
        bitSize: 128,
        byteSize: 16,
        slot: 1,
        structure: s81,
      },
      {
        ...m,
        name: "1",
        type: 3,
        flags: 1,
        bitOffset: 192,
        bitSize: 64,
        byteSize: 8,
        slot: 2,
        structure: s23,
      },
      {
        ...m,
        name: "2",
        type: 3,
        flags: 1,
        bitOffset: 320,
        bitSize: 6,
        byteSize: 1,
        slot: 3,
        structure: s50,
      },
      {
        ...m,
        name: "3",
        type: 3,
        flags: 1,
        bitOffset: 256,
        bitSize: 64,
        byteSize: 8,
        slot: 4,
        structure: s23,
      },
    ],
    template: o113
  },
  static: {
    members: [],
  },
  name: "Arg(fn (Allocator, usize, Alignment, usize) ?[*]u8)",
});
$(s68, {
  ...s,
  type: 14,
  signature: 0x55db8c5210778576n,
  length: 3,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 384,
        byteSize: 48,
        structure: s67,
      },
    ],
    template: o114
  },
  static: {
    members: [],
  },
  name: "fn (Allocator, usize, Alignment, usize) ?[*]u8",
});
$(s69, {
  ...s,
  type: 12,
  flags: 46,
  signature: 0xf5d17633582b848fn,
  length: 4,
  byteSize: 56,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 1,
        flags: 1,
        bitOffset: 384,
        bitSize: 1,
        byteSize: 1,
        slot: 0,
        structure: s3,
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
        structure: s81,
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
        structure: s54,
      },
      {
        ...m,
        name: "2",
        type: 3,
        flags: 1,
        bitOffset: 392,
        bitSize: 6,
        byteSize: 1,
        slot: 3,
        structure: s50,
      },
      {
        ...m,
        name: "3",
        type: 3,
        flags: 1,
        bitOffset: 256,
        bitSize: 64,
        byteSize: 8,
        slot: 4,
        structure: s23,
      },
      {
        ...m,
        name: "4",
        type: 3,
        flags: 1,
        bitOffset: 320,
        bitSize: 64,
        byteSize: 8,
        slot: 5,
        structure: s23,
      },
    ],
    template: o115
  },
  static: {
    members: [],
  },
  name: "Arg(fn (Allocator, []u8, Alignment, usize, usize) bool)",
});
$(s70, {
  ...s,
  type: 14,
  signature: 0xc0ffc101f028b746n,
  length: 4,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 448,
        byteSize: 56,
        structure: s69,
      },
    ],
    template: o116
  },
  static: {
    members: [],
  },
  name: "fn (Allocator, []u8, Alignment, usize, usize) bool",
});
$(s71, {
  ...s,
  type: 12,
  flags: 46,
  signature: 0xa946f778929e845dn,
  length: 4,
  byteSize: 64,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: s24,
      },
      {
        ...m,
        name: "0",
        type: 5,
        flags: 1,
        bitOffset: 64,
        bitSize: 128,
        byteSize: 16,
        slot: 1,
        structure: s81,
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
        structure: s54,
      },
      {
        ...m,
        name: "2",
        type: 3,
        flags: 1,
        bitOffset: 448,
        bitSize: 6,
        byteSize: 1,
        slot: 3,
        structure: s50,
      },
      {
        ...m,
        name: "3",
        type: 3,
        flags: 1,
        bitOffset: 320,
        bitSize: 64,
        byteSize: 8,
        slot: 4,
        structure: s23,
      },
      {
        ...m,
        name: "4",
        type: 3,
        flags: 1,
        bitOffset: 384,
        bitSize: 64,
        byteSize: 8,
        slot: 5,
        structure: s23,
      },
    ],
    template: o117
  },
  static: {
    members: [],
  },
  name: "Arg(fn (Allocator, []u8, Alignment, usize, usize) ?[*]u8)",
});
$(s72, {
  ...s,
  type: 14,
  signature: 0x8647ac3670571555n,
  length: 4,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 512,
        byteSize: 64,
        structure: s71,
      },
    ],
    template: o118
  },
  static: {
    members: [],
  },
  name: "fn (Allocator, []u8, Alignment, usize, usize) ?[*]u8",
});
$(s73, {
  ...s,
  type: 12,
  flags: 46,
  signature: 0xea9da4bc18f2c7d4n,
  length: 3,
  byteSize: 48,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        flags: 1,
        bitOffset: 320,
        bitSize: 0,
        byteSize: 0,
        slot: 0,
        structure: s61,
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
        structure: s81,
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
        structure: s54,
      },
      {
        ...m,
        name: "2",
        type: 3,
        flags: 1,
        bitOffset: 320,
        bitSize: 6,
        byteSize: 1,
        slot: 3,
        structure: s50,
      },
      {
        ...m,
        name: "3",
        type: 3,
        flags: 1,
        bitOffset: 256,
        bitSize: 64,
        byteSize: 8,
        slot: 4,
        structure: s23,
      },
    ],
    template: o119
  },
  static: {
    members: [],
  },
  name: "Arg(fn (Allocator, []u8, Alignment, usize) void)",
});
$(s74, {
  ...s,
  type: 14,
  signature: 0x757e5d0a3dc0d873n,
  length: 3,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 384,
        byteSize: 48,
        structure: s73,
      },
    ],
    template: o120
  },
  static: {
    members: [],
  },
  name: "fn (Allocator, []u8, Alignment, usize) void",
});
$(s75, {
  ...s,
  type: 5,
  flags: 1,
  signature: 0x003bc02d80e29180n,
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
        structure: s75,
      },
    ],
  },
  static: {
    members: [
      {
        ...m,
        name: "OutOfMemory",
        type: 5,
        flags: 4,
        slot: 0,
        structure: s75,
      },
    ],
    template: o121
  },
  name: "ES1",
});
$(s76, {
  ...s,
  flags: 1,
  signature: 0x2bfab51f66275485n,
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 6,
        byteSize: 1,
        bitOffset: 0,
        structure: s76,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "u6",
});
$(s77, {
  ...s,
  type: 14,
  signature: 0xd88587ab15ee8e5bn,
  length: 3,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 384,
        byteSize: 48,
        structure: s67,
      },
    ],
    template: o123
  },
  static: {
    members: [],
  },
  name: "fn (Allocator, usize, Alignment, usize) ?[*]u8",
});
$(s78, {
  ...s,
  type: 14,
  signature: 0x921cdda51398f30bn,
  length: 4,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 448,
        byteSize: 56,
        structure: s69,
      },
    ],
    template: o124
  },
  static: {
    members: [],
  },
  name: "fn (Allocator, []u8, Alignment, usize, usize) bool",
});
$(s79, {
  ...s,
  type: 14,
  signature: 0x49b76f5e6266ed88n,
  length: 4,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 512,
        byteSize: 64,
        structure: s71,
      },
    ],
    template: o125
  },
  static: {
    members: [],
  },
  name: "fn (Allocator, []u8, Alignment, usize, usize) ?[*]u8",
});
$(s80, {
  ...s,
  type: 14,
  signature: 0x62750b768d774a07n,
  length: 3,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 384,
        byteSize: 48,
        structure: s73,
      },
    ],
    template: o126
  },
  static: {
    members: [],
  },
  name: "fn (Allocator, []u8, Alignment, usize) void",
});
$(s81, {
  ...s,
  name: "Allocator",
  type: 2,
  purpose: 4,
  flags: 14,
  signature: 0x623a493140e67edan,
  byteSize: 16,
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
        structure: s20,
      },
      {
        ...m,
        name: "vtable",
        type: 5,
        flags: 1,
        bitOffset: 64,
        bitSize: 64,
        byteSize: 8,
        slot: 1,
        structure: s66,
      },
    ],
    template: o127
  },
  static: {
    members: [
      {
        ...m,
        name: "Error",
        type: 5,
        flags: 2,
        slot: 0,
        structure: s0,
      },
      {
        ...m,
        name: "Log2Align",
        type: 5,
        flags: 2,
        slot: 1,
        structure: s0,
      },
      {
        ...m,
        name: "VTable",
        type: 5,
        flags: 2,
        slot: 2,
        structure: s0,
      },
      {
        ...m,
        name: "noResize",
        type: 5,
        flags: 2,
        slot: 3,
        structure: s56,
      },
      {
        ...m,
        name: "noRemap",
        type: 5,
        flags: 2,
        slot: 4,
        structure: s59,
      },
      {
        ...m,
        name: "noFree",
        type: 5,
        flags: 2,
        slot: 5,
        structure: s63,
      },
      {
        ...m,
        name: "rawAlloc",
        type: 5,
        flags: 50,
        slot: 6,
        structure: s68,
      },
      {
        ...m,
        name: "rawResize",
        type: 5,
        flags: 50,
        slot: 7,
        structure: s70,
      },
      {
        ...m,
        name: "rawRemap",
        type: 5,
        flags: 50,
        slot: 8,
        structure: s72,
      },
      {
        ...m,
        name: "rawFree",
        type: 5,
        flags: 50,
        slot: 9,
        structure: s74,
      },
    ],
    template: o130
  },
});
$(s82, {
  ...s,
  type: 8,
  flags: 380,
  signature: 0x69f8381f03cb6a99n,
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
        structure: s6,
      },
    ],
    template: o144
  },
  static: {
    members: [],
  },
  name: "[]const @Vector(4, u8)",
});
$(s83, {
  ...s,
  type: 2,
  flags: 14,
  signature: 0x337c00bed4ef2e2an,
  byteSize: 32,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "data",
        type: 5,
        flags: 2049,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
        slot: 0,
        structure: s82,
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
        structure: s8,
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
        structure: s8,
      },
      {
        ...m,
        name: "colorSpace",
        type: 3,
        bitOffset: 192,
        bitSize: 1,
        byteSize: 1,
        slot: 3,
        structure: s9,
      },
    ],
    template: o145
  },
  static: {
    members: [
      {
        ...m,
        name: "Pixel",
        type: 5,
        flags: 2,
        slot: 0,
        structure: s0,
      },
      {
        ...m,
        name: "FPixel",
        type: 5,
        flags: 2,
        slot: 1,
        structure: s0,
      },
      {
        ...m,
        name: "channels",
        type: 5,
        flags: 2,
        slot: 2,
        structure: s10,
      },
    ],
    template: o147
  },
  name: "S4",
});
$(s84, {
  ...s,
  type: 2,
  flags: 270,
  signature: 0x9454cb4954675b2bn,
  byteSize: 32,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "src",
        type: 5,
        bitOffset: 0,
        bitSize: 256,
        byteSize: 32,
        slot: 0,
        structure: s83,
      },
    ],
    template: o152
  },
  static: {
    members: [],
  },
  name: "S5",
});
$(s85, {
  ...s,
  type: 2,
  flags: 256,
  signature: 0xa3907fe5a3f21709n,
  byteSize: 4,
  align: 4,
  instance: {
    members: [
      {
        ...m,
        name: "intensity",
        type: 4,
        bitOffset: 0,
        bitSize: 32,
        byteSize: 4,
        slot: 0,
        structure: s11,
      },
    ],
    template: o154
  },
  static: {
    members: [],
  },
  name: "S6",
});
$(s86, {
  ...s,
  type: 12,
  flags: 110,
  signature: 0x44e023d3f1d82656n,
  length: 4,
  byteSize: 104,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 320,
        byteSize: 40,
        slot: 0,
        structure: s16,
      },
      {
        ...m,
        name: "0",
        type: 5,
        flags: 1,
        bitOffset: 320,
        bitSize: 128,
        byteSize: 16,
        slot: 1,
        structure: s81,
      },
      {
        ...m,
        name: "1",
        type: 3,
        flags: 1,
        bitOffset: 704,
        bitSize: 32,
        byteSize: 4,
        slot: 2,
        structure: s8,
      },
      {
        ...m,
        name: "2",
        type: 3,
        flags: 1,
        bitOffset: 736,
        bitSize: 32,
        byteSize: 4,
        slot: 3,
        structure: s8,
      },
      {
        ...m,
        name: "3",
        type: 5,
        flags: 1,
        bitOffset: 448,
        bitSize: 256,
        byteSize: 32,
        slot: 4,
        structure: s84,
      },
      {
        ...m,
        name: "4",
        type: 5,
        flags: 1,
        bitOffset: 768,
        bitSize: 32,
        byteSize: 4,
        slot: 5,
        structure: s85,
      },
    ],
    template: o155
  },
  static: {
    members: [],
  },
  name: "Arg(fn (Allocator, u32, u32, S5, S6) ES0!S2)",
});
$(s87, {
  ...s,
  type: 14,
  signature: 0x434e1838bc130504n,
  length: 4,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 832,
        byteSize: 104,
        structure: s86,
      },
    ],
    template: o156
  },
  static: {
    members: [],
  },
  name: "fn (Allocator, u32, u32, S5, S6) ES0!S2",
});
$(s88, {
  ...s,
  type: 5,
  flags: 1,
  signature: 0xb0e609169e48d0d0n,
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
        structure: s88,
      },
    ],
  },
  static: {
    members: [
      {
        ...m,
        name: "SystemResources",
        type: 5,
        flags: 4,
        slot: 0,
        structure: s88,
      },
      {
        ...m,
        name: "Unexpected",
        type: 5,
        flags: 4,
        slot: 1,
        structure: s88,
      },
      {
        ...m,
        name: "OutOfMemory",
        type: 5,
        flags: 4,
        slot: 2,
        structure: s88,
      },
      {
        ...m,
        name: "Deinitializing",
        type: 5,
        flags: 4,
        slot: 3,
        structure: s88,
      },
      {
        ...m,
        name: "UnableToUseThread",
        type: 5,
        flags: 4,
        slot: 4,
        structure: s88,
      },
      {
        ...m,
        name: "ThreadQuotaExceeded",
        type: 5,
        flags: 4,
        slot: 5,
        structure: s88,
      },
      {
        ...m,
        name: "LockedMemoryLimitExceeded",
        type: 5,
        flags: 4,
        slot: 6,
        structure: s88,
      },
    ],
    template: o157
  },
  name: "ES2",
});
$(s89, {
  ...s,
  type: 4,
  flags: 1,
  signature: 0x59f8821423ada5efn,
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
        structure: s61,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitOffset: 0,
        bitSize: 16,
        byteSize: 2,
        structure: s88,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "ES2!void",
});
$(s90, {
  ...s,
  type: 12,
  flags: 74,
  signature: 0xfcdd0ef91c54177fn,
  length: 1,
  byteSize: 8,
  align: 4,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 5,
        flags: 1,
        bitOffset: 32,
        bitSize: 16,
        byteSize: 2,
        slot: 0,
        structure: s89,
      },
      {
        ...m,
        name: "0",
        type: 3,
        flags: 1,
        bitOffset: 0,
        bitSize: 32,
        byteSize: 4,
        slot: 1,
        structure: s8,
      },
    ],
    template: o165
  },
  static: {
    members: [],
  },
  name: "Arg(fn (u32) ES2!void)",
});
$(s91, {
  ...s,
  type: 14,
  signature: 0xe5d8b4bb861c1e8an,
  length: 1,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 64,
        byteSize: 8,
        structure: s90,
      },
    ],
    template: o166
  },
  static: {
    members: [],
  },
  name: "fn (u32) ES2!void",
});
$(s92, {
  ...s,
  type: 7,
  flags: 15,
  signature: 0xc483f40888e1ec6an,
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
        structure: s20,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: s23,
      },
    ],
    template: o167
  },
  static: {
    members: [],
  },
  name: "?*opaque",
});
$(s93, {
  ...s,
  type: 12,
  flags: 14,
  signature: 0x219d9248a4265ce9n,
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
        structure: s61,
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
        structure: s92,
      },
      {
        ...m,
        name: "1",
        flags: 1,
        bitOffset: 64,
        bitSize: 0,
        byteSize: 0,
        slot: 2,
        structure: s61,
      },
    ],
    template: o168
  },
  static: {
    members: [],
  },
  name: "Arg(fn (?*opaque, void) void)",
});
$(s94, {
  ...s,
  type: 14,
  signature: 0xc8327291b80e2195n,
  length: 2,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 64,
        byteSize: 8,
        structure: s93,
      },
    ],
    template: o169
  },
  static: {
    members: [],
    template: o170
  },
  name: "fn (?*opaque, void) void",
});
$(s95, {
  ...s,
  type: 8,
  flags: 396,
  signature: 0x90af5e5877878ecen,
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
        structure: s94,
      },
    ],
    template: o171
  },
  static: {
    members: [],
  },
  name: "*const fn (?*opaque, void) void",
});
$(s96, {
  ...s,
  type: 2,
  purpose: 1,
  flags: 14,
  signature: 0x47ea380ec4c708c4n,
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
        structure: s92,
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
        structure: s95,
      },
    ],
    template: o172
  },
  static: {
    members: [],
  },
  name: "S7",
});
$(s97, {
  ...s,
  type: 12,
  flags: 174,
  signature: 0x55f2ac4baaa9bc07n,
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
        structure: s61,
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
        structure: s96,
      },
    ],
    template: o176
  },
  static: {
    members: [],
  },
  name: "Arg(fn (S7) void)",
});
$(s98, {
  ...s,
  type: 14,
  signature: 0xd2abee79f7b9a378n,
  length: 0,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 128,
        byteSize: 16,
        structure: s97,
      },
    ],
    template: o177
  },
  static: {
    members: [],
  },
  name: "fn (S7) void",
});
$(s99, {
  ...s,
  type: 5,
  flags: 1,
  signature: 0x7974fd22cdd85648n,
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
        structure: s99,
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
        structure: s99,
      },
      {
        ...m,
        name: "OutOfMemory",
        type: 5,
        flags: 4,
        slot: 1,
        structure: s99,
      },
    ],
    template: o178
  },
  name: "ES3",
});
$(s100, {
  ...s,
  type: 4,
  flags: 1,
  signature: 0x99eb7dc26c76225bn,
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
        structure: s61,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitOffset: 0,
        bitSize: 16,
        byteSize: 2,
        structure: s99,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "ES3!void",
});
$(s101, {
  ...s,
  type: 5,
  flags: 1,
  signature: 0xabc85773291e1411n,
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
        structure: s101,
      },
    ],
  },
  static: {
    members: [
      {
        ...m,
        name: "Aborted",
        type: 5,
        flags: 4,
        slot: 0,
        structure: s101,
      },
    ],
    template: o181
  },
  name: "ES4",
});
$(s102, {
  ...s,
  type: 4,
  flags: 15,
  signature: 0x83ce7fc9db9c2e21n,
  byteSize: 40,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitOffset: 0,
        bitSize: 256,
        byteSize: 32,
        slot: 0,
        structure: s14,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitOffset: 256,
        bitSize: 16,
        byteSize: 2,
        structure: s101,
      },
    ],
    template: o183
  },
  static: {
    members: [],
  },
  name: "ES4!S2",
});
$(s103, {
  ...s,
  type: 12,
  flags: 14,
  signature: 0xb3313df90a674431n,
  length: 2,
  byteSize: 48,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        flags: 1,
        bitOffset: 384,
        bitSize: 0,
        byteSize: 0,
        slot: 0,
        structure: s61,
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
        structure: s92,
      },
      {
        ...m,
        name: "1",
        type: 5,
        flags: 1,
        bitOffset: 64,
        bitSize: 320,
        byteSize: 40,
        slot: 2,
        structure: s102,
      },
    ],
    template: o184
  },
  static: {
    members: [],
  },
  name: "Arg(fn (?*opaque, ES4!S2) void)",
});
$(s104, {
  ...s,
  type: 14,
  signature: 0xc73ea89a078e339dn,
  length: 2,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 384,
        byteSize: 48,
        structure: s103,
      },
    ],
    template: o185
  },
  static: {
    members: [],
    template: o186
  },
  name: "fn (?*opaque, ES4!S2) void",
});
$(s105, {
  ...s,
  type: 8,
  flags: 396,
  signature: 0x6cff4a586a3350een,
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
        structure: s104,
      },
    ],
    template: o187
  },
  static: {
    members: [],
  },
  name: "*const fn (?*opaque, ES4!S2) void",
});
$(s106, {
  ...s,
  type: 2,
  purpose: 1,
  flags: 14,
  signature: 0x3265da45286ca913n,
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
        structure: s92,
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
        structure: s105,
      },
    ],
    template: o188
  },
  static: {
    members: [],
  },
  name: "S8",
});
$(s107, {
  ...s,
  flags: 1,
  signature: 0xb31f6af1d3bc75b0n,
  byteSize: 4,
  align: 4,
  instance: {
    members: [
      {
        ...m,
        type: 2,
        bitSize: 32,
        byteSize: 4,
        bitOffset: 0,
        structure: s107,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "i32",
});
$(s108, {
  ...s,
  type: 8,
  flags: 412,
  signature: 0x030f360bbeff01f2n,
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
        structure: s107,
      },
    ],
    template: o191
  },
  static: {
    members: [],
  },
  name: "*const i32",
});
$(s109, {
  ...s,
  name: "AbortSignal",
  type: 2,
  purpose: 3,
  flags: 14,
  signature: 0xf5a2a1af2c82de4dn,
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
        structure: s108,
      },
    ],
    template: o192
  },
  static: {
    members: [],
  },
});
$(s110, {
  ...s,
  type: 12,
  flags: 238,
  signature: 0x439ad6eb848bf105n,
  length: 4,
  byteSize: 88,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 5,
        flags: 1,
        bitOffset: 672,
        bitSize: 16,
        byteSize: 2,
        slot: 0,
        structure: s100,
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
        structure: s81,
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
        structure: s106,
      },
      {
        ...m,
        name: "2",
        type: 5,
        flags: 1,
        bitOffset: 256,
        bitSize: 64,
        byteSize: 8,
        slot: 3,
        structure: s109,
      },
      {
        ...m,
        name: "3",
        type: 3,
        flags: 1,
        bitOffset: 576,
        bitSize: 32,
        byteSize: 4,
        slot: 4,
        structure: s8,
      },
      {
        ...m,
        name: "4",
        type: 3,
        flags: 1,
        bitOffset: 608,
        bitSize: 32,
        byteSize: 4,
        slot: 5,
        structure: s8,
      },
      {
        ...m,
        name: "5",
        type: 5,
        flags: 1,
        bitOffset: 320,
        bitSize: 256,
        byteSize: 32,
        slot: 6,
        structure: s84,
      },
      {
        ...m,
        name: "6",
        type: 5,
        flags: 1,
        bitOffset: 640,
        bitSize: 32,
        byteSize: 4,
        slot: 7,
        structure: s85,
      },
    ],
    template: o194
  },
  static: {
    members: [],
  },
  name: "Arg(fn (Allocator, S8, AbortSignal, u32, u32, S5, S6) ES3!void)",
});
$(s111, {
  ...s,
  type: 14,
  signature: 0xd2c9e0b64ce55175n,
  length: 4,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 704,
        byteSize: 88,
        structure: s110,
      },
    ],
    template: o195
  },
  static: {
    members: [],
  },
  name: "fn (Allocator, S8, AbortSignal, u32, u32, S5, S6) ES3!void",
});
$(s112, {
  ...s,
  type: 1,
  flags: 496,
  signature: 0x7a90d8480d524432n,
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
        flags: 65,
        bitSize: 8,
        byteSize: 1,
        structure: s1,
      },
    ],
    template: o196
  },
  static: {
    members: [],
  },
  name: "[3]u8",
});
$(s113, {
  ...s,
  type: 8,
  flags: 412,
  signature: 0x445085a3f3b11320n,
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
        structure: s112,
      },
    ],
    template: o197
  },
  static: {
    members: [],
  },
  name: "*const [3]u8",
});
$(s114, {
  ...s,
  type: 1,
  flags: 496,
  signature: 0xc94b1a912bfbb75en,
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
        flags: 65,
        bitSize: 8,
        byteSize: 1,
        structure: s1,
      },
    ],
    template: o198
  },
  static: {
    members: [],
  },
  name: "[13]u8",
});
$(s115, {
  ...s,
  type: 8,
  flags: 412,
  signature: 0x673cfb800fe3f7e6n,
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
        structure: s114,
      },
    ],
    template: o199
  },
  static: {
    members: [],
  },
  name: "*const [13]u8",
});
$(s116, {
  ...s,
  type: 1,
  flags: 496,
  signature: 0xe1ee1f66f2cb71cdn,
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
        flags: 65,
        bitSize: 8,
        byteSize: 1,
        structure: s1,
      },
    ],
    template: o200
  },
  static: {
    members: [],
  },
  name: "[23]u8",
});
$(s117, {
  ...s,
  type: 8,
  flags: 412,
  signature: 0x0110559b96335704n,
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
        structure: s116,
      },
    ],
    template: o201
  },
  static: {
    members: [],
  },
  name: "*const [23]u8",
});
$(s118, {
  ...s,
  flags: 9,
  signature: 0xdd41f64139c09b1bn,
  byteSize: 0,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 0,
        byteSize: 0,
        bitOffset: 0,
        slot: 0,
        structure: s118,
      },
    ],
    template: o202
  },
  static: {
    members: [],
  },
  name: "comptime",
});
$(s119, {
  ...s,
  flags: 1,
  signature: 0xb8ac896a18a90007n,
  byteSize: 8,
  align: 8,
  instance: {
    members: [
      {
        ...m,
        type: 4,
        bitSize: 64,
        byteSize: 8,
        bitOffset: 0,
        structure: s119,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "f64",
});
$(s120, {
  ...s,
  type: 2,
  flags: 264,
  signature: 0xa8a31dac43a38551n,
  byteSize: 0,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        name: "type",
        type: 5,
        flags: 2,
        slot: 0,
        structure: s0,
      },
      {
        ...m,
        name: "minValue",
        type: 5,
        flags: 2,
        slot: 1,
        structure: s118,
      },
      {
        ...m,
        name: "maxValue",
        type: 5,
        flags: 2,
        slot: 2,
        structure: s118,
      },
      {
        ...m,
        name: "defaultValue",
        type: 5,
        flags: 2,
        slot: 3,
        structure: s118,
      },
    ],
    template: o203
  },
  static: {
    members: [],
  },
  name: "S9",
});
$(s121, {
  ...s,
  type: 2,
  flags: 266,
  signature: 0xa8a31dac43a38551n,
  byteSize: 0,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        name: "intensity",
        type: 5,
        flags: 2,
        slot: 0,
        structure: s120,
      },
    ],
    template: o212
  },
  static: {
    members: [],
  },
  name: "S10",
});
$(s122, {
  ...s,
  type: 2,
  flags: 264,
  signature: 0xa8a31dac43a38551n,
  byteSize: 0,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        name: "channels",
        type: 5,
        flags: 2,
        slot: 0,
        structure: s10,
      },
    ],
    template: o214
  },
  static: {
    members: [],
  },
  name: "S11",
});
$(s123, {
  ...s,
  type: 2,
  flags: 266,
  signature: 0xa8a31dac43a38551n,
  byteSize: 0,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        name: "src",
        type: 5,
        flags: 2,
        slot: 0,
        structure: s122,
      },
    ],
    template: o217
  },
  static: {
    members: [],
  },
  name: "S12",
});
$(s124, {
  ...s,
  type: 2,
  flags: 264,
  signature: 0xa8a31dac43a38551n,
  byteSize: 0,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        name: "channels",
        type: 5,
        flags: 2,
        slot: 0,
        structure: s10,
      },
    ],
    template: o219
  },
  static: {
    members: [],
  },
  name: "S13",
});
$(s125, {
  ...s,
  type: 2,
  flags: 266,
  signature: 0xa8a31dac43a38551n,
  byteSize: 0,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        name: "dst",
        type: 5,
        flags: 2,
        slot: 0,
        structure: s124,
      },
    ],
    template: o222
  },
  static: {
    members: [],
  },
  name: "S14",
});
$(s126, {
  ...s,
  name: "kernel",
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
        name: "namespace",
        type: 5,
        flags: 2,
        slot: 0,
        structure: s113,
      },
      {
        ...m,
        name: "vendor",
        type: 5,
        flags: 2,
        slot: 1,
        structure: s115,
      },
      {
        ...m,
        name: "version",
        type: 5,
        flags: 2,
        slot: 2,
        structure: s10,
      },
      {
        ...m,
        name: "description",
        type: 5,
        flags: 2,
        slot: 3,
        structure: s117,
      },
      {
        ...m,
        name: "parameters",
        type: 5,
        flags: 2,
        slot: 4,
        structure: s121,
      },
      {
        ...m,
        name: "inputImages",
        type: 5,
        flags: 2,
        slot: 5,
        structure: s123,
      },
      {
        ...m,
        name: "outputImages",
        type: 5,
        flags: 2,
        slot: 6,
        structure: s125,
      },
    ],
    template: o224
  },
});
$(s127, {
  ...s,
  name: "sepia",
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
        name: "kernel",
        type: 5,
        flags: 2,
        slot: 0,
        structure: s0,
      },
      {
        ...m,
        name: "Input",
        type: 5,
        flags: 2,
        slot: 1,
        structure: s0,
      },
      {
        ...m,
        name: "Output",
        type: 5,
        flags: 2,
        slot: 2,
        structure: s0,
      },
      {
        ...m,
        name: "Parameters",
        type: 5,
        flags: 2,
        slot: 3,
        structure: s0,
      },
      {
        ...m,
        name: "createOutput",
        type: 5,
        flags: 514,
        slot: 4,
        structure: s87,
      },
      {
        ...m,
        name: "startThreadPool",
        type: 5,
        flags: 2,
        slot: 10,
        structure: s91,
      },
      {
        ...m,
        name: "stopThreadPoolAsync",
        type: 5,
        flags: 2,
        slot: 11,
        structure: s98,
      },
      {
        ...m,
        name: "createOutputAsync",
        type: 5,
        flags: 514,
        slot: 12,
        structure: s111,
      },
    ],
    template: o236
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
  s120, s121, s122, s123, s124, s125, s126, s127,
];
const root = s127;
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
          const { closeSync, openSync, readSync } = require$1('fs');
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