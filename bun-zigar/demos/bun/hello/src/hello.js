import { createRequire } from 'module';
import os from 'os';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

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
const s0 = {}, s1 = {}, s2 = {}, s3 = {};

// declare objects
const o0 = {}, o1 = {}, o2 = {};

// define byte arrays
const U = i => new Uint8Array(i);
const a0 = U(0);

// fill in object properties
const $ = Object.assign;
$(o0, {
  memory: { array: a0 },
  handle: 18831,
});
$(o1, {
  slots: {
    0: o2,
  },
});
$(o2, {
  structure: s2,
  memory: { array: a0 },
  handle: 16829,
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
  type: 12,
  signature: 0xfa22378c989ae19dn,
  name: "Arg(fn () void)",
  length: 0,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        flags: 1,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        slot: 0,
        name: "retval",
        structure: s0,
      },
    ],
  },
});
$(s2, {
  ...s,
  type: 14,
  signature: 0xe3c3b022a28cd076n,
  name: "fn () void",
  length: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 0,
        byteSize: 0,
        structure: s1,
      },
    ],
    template: o0
  },
});
$(s3, {
  ...s,
  type: 2,
  flags: 4096,
  signature: 0x239ab4f327f6ac1bn,
  name: "hello",
  align: 1,
  static: {
    members: [
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 0,
        name: "hello",
        structure: s2,
      },
    ],
    template: o1
  },
});
const structures = [
  s0, s1, s2, s3,
];
const root = s3;
const settings = {
  runtimeSafety: false,
  littleEndian: true,
  libc: true,
};

// create runtime environment
const env = createEnvironment();

// recreate structures
env.recreateStructures(structures, settings);
env.loadModule(resolve(__dirname, "../lib/hello.zigar", moduleName));
env.linkVariables(false);

// export root namespace and its methods and constants
const { constructor: v0 } = root;
const v1 = env.getSpecialExports();
const {
  hello: v2,
} = v0;
export {
  v0 as default,
  v1 as __zigar,
  v2 as hello,
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
          const { closeSync, openSync, readSync } = require("fs"), fd = openSync(process.argv[0], "r"), sig = new Uint8Array(8);
          readSync(fd, sig);
          for (const [index, value] of ["\x7F", "E", "L", "F"].entries())
            if (sig[index] !== value.charCodeAt(0))
              throw new Error("Incorrect magic number");
          const bits = sig[4] * 32, le = sig[5] === 1, Ehdr = bits === 64 ? { size: 64, e_shoff: 40, e_shnum: 60 } : { size: 52, e_shoff: 32, e_shnum: 48 }, Shdr = bits === 64 ? { size: 64, sh_type: 4, sh_offset: 24, sh_size: 32, sh_link: 40 } : { size: 40, sh_type: 4, sh_offset: 16, sh_size: 20, sh_link: 24 }, Dyn = bits === 64 ? { size: 16, d_tag: 0, d_val: 8 } : { size: 8, d_tag: 0, d_val: 4 }, Usize = bits === 64 ? BigInt : Number, read = (position, size) => {
            const buf = new DataView(new ArrayBuffer(Number(size)));
            readSync(fd, buf, { position });
            buf.getUsize = bits === 64 ? buf.getBigUint64 : buf.getUint32;
            return buf;
          }, SHT_DYNAMIC = 6, DT_NEEDED = 1, ehdr = read(0, Ehdr.size);
          let position = ehdr.getUsize(Ehdr.e_shoff, le);
          const sectionCount = ehdr.getUint16(Ehdr.e_shnum, le), shdrs = [];
          for (let i = 0;i < sectionCount; i++, position += Usize(Shdr.size))
            shdrs.push(read(position, Shdr.size));
          const decoder = new TextDecoder;
          for (const shdr of shdrs)
            if (shdr.getUint32(Shdr.sh_type, le) == SHT_DYNAMIC) {
              const link = shdr.getUint32(Shdr.sh_link, le), strTableOffset = shdrs[link].getUsize(Shdr.sh_offset, le), strTableSize = shdrs[link].getUsize(Shdr.sh_size, le), strTable = read(strTableOffset, strTableSize), dynamicOffset = shdr.getUsize(Shdr.sh_offset, le), dynamicSize = shdr.getUsize(Shdr.sh_size, le), entryCount = Number(dynamicSize / Usize(Shdr.size));
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
        } catch (err) {
        }
        process.__gnu = list.indexOf("libc.so.6") != -1;
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