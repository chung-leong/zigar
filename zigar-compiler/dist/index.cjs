'use strict';

var node_child_process = require('node:child_process');
var node_crypto = require('node:crypto');
var fs = require('node:fs/promises');
var node_module = require('node:module');
var os = require('node:os');
var node_path = require('node:path');
var node_url = require('node:url');
var node_util = require('node:util');
var node_fs = require('node:fs');
var child_process = require('child_process');
var fs$1 = require('fs');
var os$1 = require('os');
var tty = require('tty');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
const StructureType = {
  Primitive: 0};
const StructurePurpose = {
  Unknown: 0};
const MemberType = {
  Void: 0};
const MemberFlag = {
  IsReadOnly: 1 << 1};

const zigGobals = globalThis[Symbol.for('ZIGAR')] ??= {};

function __symbol(name) {
  return zigGobals[name] ??= Symbol(name);
}

function symbol(name) {
  return /*@__PURE__*/ __symbol(name);
}

const MEMORY = symbol('memory');
const SLOTS = symbol('slots');

(process.env.BITS == 64) ? 0n : 0;
(process.env.BITS == 64) ? 0xFFFF_FFFF_FFFF_FFFFn : 0xFFFF_FFFF;
(process.env.BITS == 64) ? -1n : -1;
(process.env.BITS == 64) ? 8 : 4;

BigInt(Number.MAX_SAFE_INTEGER);
BigInt(Number.MIN_SAFE_INTEGER);

function findObjects(structures, SLOTS) {
  const list = [];
  const found = new Map();
  const find = (object) => {
    if (!object || found.get(object)) {
      return;
    }
    found.set(object, true);
    list.push(object);
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
  return list;
}

const require$1 = node_module.createRequire((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('index.cjs', document.baseURI).href)));
const execFileAsync$1 = node_util.promisify(node_child_process.execFile);

async function acquireLock(pidPath, wait = true, staleTime = 60000 * 5) {
  while (true)   {
    try {
      await createDirectory(node_path.dirname(pidPath));
      const handle = await fs.open(pidPath, 'wx');
      handle.write(`${process.pid}`);
      handle.close();
      break;
    } catch (err) {
      if (err.code === 'EEXIST') {
        if (await checkPidFile(pidPath, staleTime)) {
          if (!wait) {
            throw err;
          }
          await delay(250);
          continue;
        }
        /* c8 ignore next 3 */
      } else {
        throw err;
      }
    }
  }
}

async function releaseLock(pidPath) {
  await deleteFile(pidPath);
}

async function checkPidFile(pidPath, staleTime) {
  let stale = false;
  try {
    const pid = await loadFile(pidPath);
    if (pid) {
      /* c8 ignore start */
      const win32 = os.platform() === 'win32';
      const program = (win32) ? 'tasklist' : 'ps';
      const args = (win32) ? [ '/nh', '/fi', `pid eq ${pid}` ] : [ '-p', pid ];
      const { stdout } = await execFileAsync$1(program, args, { windowsHide: true });
      if (win32 && !stdout.includes(pid)) {
        throw new Error('Process not found');
      }
      /* c8 ignore end */
    }
    const stats = await fs.stat(pidPath);
    const diff = new Date() - stats.mtime;
    if (diff > staleTime) {
      stale = true;
    }
  } catch (err) {
    stale = true;
  }
  if (stale) {
    await deleteFile(pidPath);
  }
  return !stale;
}

async function copyFile(dstPath, srcPath) {
  const info = await fs.stat(srcPath);
  const data = await fs.readFile(srcPath);
  await fs.writeFile(dstPath, data);
  await fs.chmod(dstPath, info.mode);
}

async function loadFile(path, def) {
  try {
    return await fs.readFile(path, 'utf8');
  } catch (err) {
    return def;
  }
}

async function deleteFile(path) {
  try {
    await fs.unlink(path);
  } catch (err) {
    if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') {
      throw err;
    }
  }
}

async function createDirectory(path) {
  try {
    await fs.stat(path);
  } catch (err) {
    const dir = node_path.dirname(path);
    await createDirectory(dir);
    try {
      await fs.mkdir(path);
      /* c8 ignore next 5 */
    } catch (err) {
      if (err.code != 'EEXIST') {
        throw err;
      }
    }
  }
}

async function deleteDirectory(dir) {
  try {
    const list = await fs.readdir(dir);
    for (const name of list) {
      const path = node_path.join(dir, name);
      const info = await fs.lstat(path);
      if (info.isDirectory()) {
        await deleteDirectory(path);
      } else if (info) {
        await deleteFile(path);
      }
    }
    await fs.rmdir(dir);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

async function delay(ms) {
  await new Promise(r => setTimeout(r, ms));
}

function sha1(text) {
  const hash = node_crypto.createHash('sha1');
  hash.update(text);
  return hash.digest('hex');
}

// this function (along with getArch() and getLibraryExt()) need to be self-contained 
// such that we'd have functional code if we use toString() on it; it can only depend
// on the variable 'os' being available
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

function normalizePath(url) {
  let archive;
  const parts = node_url.fileURLToPath(url).split(node_path.sep).map((part) => {
    if (part === 'app.asar') {
      archive = 'asar';
      return part + '.unpacked';
    }
    return part;
  });
  const path = parts.join(node_path.sep);
  return { path, archive }
}

async function getDirectoryStats(dirPath) {
  let size = 0, mtimeMs = 0;
  const names = await fs.readdir(dirPath);
  for (const name of names) {
    const path = node_path.join(dirPath, name);
    let info = await fs.stat(path);
    if(info.isDirectory()) {
      info = await getDirectoryStats(path);
    } else if (!info.isFile()) {
      continue;
    }
    size += info.size;
    if (mtimeMs < info.mtimeMs) {
      mtimeMs = info.mtimeMs;
    }
  }
  return { size, mtimeMs };
}

async function copyZonFile(srcPath, dstPath) {
  const srcDir = await fs.realpath(node_path.dirname(srcPath));
  const dstDir = await fs.realpath(node_path.dirname(dstPath));
  const srcCode = await fs.readFile(srcPath, 'utf-8');
  const dstCode = srcCode.replace(/(\.path\s+=\s+)"(.*?)"/g, (m0, pre, path) => {
    const srcModulePath = node_path.resolve(srcDir, path);
    const dstModulePath = node_path.relative(dstDir, srcModulePath);
    return pre + JSON.stringify(dstModulePath);
  });
  await fs.writeFile(dstPath, dstCode);
}

function generateCode(definition, params) {
  const { structures } = definition;
  const {
    runtimeURL,
    binarySource = null,
    topLevelAwait = true,
    omitExports = false,
    mixinPaths = [],
    moduleOptions,
    envVariables = {},
    standaloneLoader,
  } = params;
  const exports$1 = getExports(structures);
  const lines = [];
  const type = standaloneLoader?.type ?? 'esm';
  const add = manageIndentation(lines);
  if (standaloneLoader) {
    const { addonDir } = standaloneLoader;
    if (type === 'esm') {
      add(`import { createRequire } from 'node:module';`);
      add(`import os from 'node:os';`);
      add(`import { dirname, resolve } from 'node:path';`);
      add(`import { fileURLToPath } from 'node:url';`);
      add(``);
      add(`const require = createRequire(import.meta.url);`);
      add(`const __dirname = dirname(fileURLToPath(import.meta.url));`);
    } else {
      add(`const os = require('os');`);
      add(`const { resolve } = require('path');`);
      add(``);
    }
    add(`const platform = getPlatform();`);
    add(`const arch = getArch();`);
    add(`const ext = getLibraryExt(platform);`);
    add(`const moduleName = \`\${platform}.\${arch}.\${ext}\`;`);
    add(`const addonName = \`\${platform}.\${arch}.node\`;`);
    add(`const { createEnvironment } = require(resolve(__dirname, ${JSON.stringify(addonDir)}, addonName));`);
  } else {
    // loading through node-zigar/bun-zigar
    add(`import { createEnvironment } from ${JSON.stringify(runtimeURL)};`);
  }
  for (const mixinPath of mixinPaths) {
    add(`import '${runtimeURL}/${mixinPath}';`);
  }
  // write out the structures as object literals
  addStructureDefinitions(lines, definition);
  if (Object.keys(envVariables).length > 0) {
    add(`\n// set environment variables`);
    for (const [ name, value ] of Object.entries(envVariables)) {
      add(`process.env.${name} = ${JSON.stringify(value)};`);
    }
  }
  add(`\n// create runtime environment`);
  add(`const env = createEnvironment();`);
  add(`\n// recreate structures`);
  add(`env.recreateStructures(structures, settings);`);
  if (binarySource) {
    if (moduleOptions) {
      add(`\n// initiate loading and compilation of WASM bytecodes`);
    } else {
      add(`\n// load shared library`);
    }
    add(`const source = ${binarySource};`);
    const loadOptions = (moduleOptions) ? {
      delay: !topLevelAwait,
      ...moduleOptions,
    } : null;
    add(`env.loadModule(source, ${loadOptions ? JSON.stringify(loadOptions) : null});`);
    // if top level await is used, we don't need to write changes into Zig memory buffers
    add(`env.linkVariables(${!topLevelAwait});`);
  } else if (standaloneLoader?.moduleDir) {
    const { moduleDir } = standaloneLoader;
    add(`env.loadModule(resolve(__dirname, ${JSON.stringify(moduleDir)}, moduleName));`);
    // write-back is never necessary in Node/Bun/Deno since loadModule() is synchronous
    add(`env.linkVariables(false);`);
  }
  add(`\n// export root namespace and its methods and constants`);
  let specialVarName;
  if (!omitExports) {
    // the first two exports are default and __zigar
    add(`const { constructor: v0 } = root;`);
    add(`const v1 = env.getSpecialExports();`);
    specialVarName = 'v1';
    if (exports$1.length > 2) {
      add(`const {`);
      for (const [ index, name ] of exports$1.entries()) {
        if (index >= 2) {
          add(`${name}: v${index},`);
        }
      }
      add(`} = v0;`);
    }
    if (type == 'esm') {
      add(`export {`);
      for (const [ index, name ] of exports$1.entries()) {
        add(`v${index} as ${name},`);
      }
      add(`};`);
    } else {
      add(`module.exports = {`);
      for (const [ index, name ] of exports$1.entries()) {
        add(`${name}: v${index},`);
      }
      add(`};`);
    }
  } else {
    add(`const { constructor } = root;`);
    add(`const __zigar = env.getSpecialExports();`);
    specialVarName = '__zigar';
  }
  if (moduleOptions && topLevelAwait && binarySource) {
    add(`await ${specialVarName}.init();`);
  }
  if (standaloneLoader) {
    add(`\n${getPlatform}`);
    add(`\n${getArch}`);
    add(`\n${getLibraryExt}`);
  }
  const code = lines.join('\n');
  return { code, exports: exports$1, structures };
}

function addStructureDefinitions(lines, definition) {
  const { structures, settings } = definition;
  const add = manageIndentation(lines);
  const defaultStructure = {
    constructor: null,
    type: StructureType.Primitive,
    purpose: StructurePurpose.Unknown,
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
  add(`\n// structure defaults`);
  add(`const s = {`);
  for (const [ name, value ] of Object.entries(defaultStructure)) {
    switch (name) {
      case 'instance':
      case 'static':
        add(`${name}: {`);
        for (const [ name2, value2 ] of Object.entries(value)) {
          add(`${name2}: ${JSON.stringify(value2)},`);
        }
        add(`},`);
        break;
      default:
        add(`${name}: ${JSON.stringify(value)},`);
    }
  }
  add(`};`);
  const defaultMember = {
    type: MemberType.Void,
    flags: 0,
  };
  add(`\n// member defaults`);
  add(`const m = {`);
  for (const [ name, value ] of Object.entries(defaultMember)) {
    add(`${name}: ${JSON.stringify(value)},`);
  }
  add(`};`);
  // create empty objects first, to allow objects to reference each other
  const structureNames = new Map();
  const structureMap = new Map();
  for (const [ index, structure ] of structures.entries()) {
    const varname = `s${index}`;
    structureNames.set(structure, varname);
    structureMap.set(structure.constructor, structure);
  }
  if (structureNames.size > 0) {
    add('\n// declare structure objects');
    for (const slice of chunk(structureNames.values(), 10)) {
      add(`const ${slice.map(n => `${n} = {}`).join(', ')};`);
    }
  }
  const objects = findObjects(structures, SLOTS);
  const objectNames = new Map();
  const views = [];
  for (const [ index, object ] of objects.entries()) {
    const varname = `o${index}`;
    objectNames.set(object, varname);
    if (object[MEMORY]) {
      views.push(object[MEMORY]);
    }
  }
  if (objectNames.size > 0) {
    add('\n// declare objects');
    for (const slice of chunk(objectNames.values(), 10)) {
      add(`const ${slice.map(n => `${n} = {}`).join(', ')};`);
    }
  }
  // define buffers
  const arrayBufferNames = new Map();
  let hasU;
  const addU = () => {
    if (!hasU) {
      add('\n// define byte arrays');
      add(`const U = i => new Uint8Array(i);`);
      hasU = true;
    }
  };
  let arrayCount = 0;
  const emptyBuffer = new ArrayBuffer(0);
  const zeroInit = function(ta) {
    for (const byte of ta) {
      if (byte !== 0) {
        return;
      }
    }
    return `${ta.length}`;
  };
  const existingInit = function(ta) {
    for (const [ buffer, name ] of arrayBufferNames) {
      if (buffer.byteLength === ta.byteLength) {
        const existing = new Uint8Array(buffer);
        let different = false;
        for (let i = 0; i < ta.length; i++) {
          if (existing[i] !== ta[i]) {
            different = true;
            break;
          }
        }
        if (!different) {
          return name;
        }
      }
    }
  };
  const listInit = function(ta) {
    return `[ ${ta.join(', ')} ]`;
  };
  for (const dv of views) {
    addU();
    const buffer = (dv.buffer.byteLength > 0) ? dv.buffer : emptyBuffer;
    if (!arrayBufferNames.get(buffer)) {
      const varname = `a${arrayCount++}`;
      const a = new Uint8Array(dv.buffer);
      add(`const ${varname} = U(${zeroInit(a) ?? existingInit(a) ?? listInit(a)});`);
      arrayBufferNames.set(buffer, varname);
    }
  }
  // add properties to objects
  let has$ = false;
  const add$ = () => {
    if (!has$) {
      add('\n// fill in object properties');
      add(`const $ = Object.assign;`);
      has$ = true;
    }
  };
  if (objects.length > 0) {
    for (const object of objects) {
      const varname = objectNames.get(object);
      const structure = structureMap.get(object.constructor);
      const { [MEMORY]: dv, [SLOTS]: slots } = object;
      add$();
      add(`$(${varname}, {`);
      if (structure) {
        add(`structure: ${structureNames.get(structure)},`);
      }
      if (dv) {
        const buffer = (dv.buffer.byteLength > 0) ? dv.buffer : emptyBuffer;
        const pairs = [ `array: ${arrayBufferNames.get(buffer)}` ];
        if (dv.byteLength < buffer.byteLength) {
          pairs.push(`offset: ${dv.byteOffset}`);
          pairs.push(`length: ${dv.byteLength}`);
        }
        add(`memory: { ${pairs.join(', ')} },`);
        const { handle } = dv;
        if (handle !== undefined) {
          add(`handle: ${handle},`);
        }
      }
      if (slots) {
        const pairs = [];
        for (const [ slot, child ] of Object.entries(slots)) {
          const varname = objectNames.get(child);
          if (varname) {
            pairs.push(`${slot}: ${varname}`);
          }
        }
        if (pairs.length > 0) {
          add(`slots: {`);
          for (const slice of chunk(pairs, 10)) {
            add(slice.join(', ') + ',');
          }
          add(`},`);
        }
      }
      add(`});`);
    }
  }
  if (structures.length > 0) {
    add('\n// fill in structure properties');
    for (const structure of structures) {
      const varname = structureNames.get(structure);
      add$();
      add(`$(${varname}, {`);
      add(`...s,`);
      for (const [ name, value ] of Object.entries(structure)) {
        if (isDifferent(value, defaultStructure[name])) {
          switch (name) {
            case 'constructor':
            case 'typedArray':
            case 'sentinel':
              break;
            case 'signature':
              add(`${name}: 0x${value.toString(16).padStart(16, '0')}n,`);
              break;
            case 'instance':
            case 'static': {
              const { members, template } = value;
              add(`${name}: {`);
              add(`members: [`);
              if (members) {
                for (const member of members) {
                  add(`{`);
                  add(`...m,`);
                  for (const [ name, value ] of Object.entries(member)) {
                    if (isDifferent(value, defaultMember[name])) {
                      switch (name) {
                        case 'structure':
                          add(`${name}: ${structureNames.get(value)},`);
                          break;
                        default:
                          add(`${name}: ${JSON.stringify(value)},`);
                      }
                    }
                  }
                  add(`},`);
                }
              }
              add(`],`);
              if (template) {
                add(`template: ${objectNames.get(template)}`);
              }
              add(`},`);
            } break;
            default:
              add(`${name}: ${JSON.stringify(value)},`);
          }
        }
      }
      add(`});`);
    }
  }
  add(`const structures = [`);
  for (const slice of chunk([ ...structureNames.values() ], 10)) {
    add(slice.join(', ') + ',');
  }
  add(`];`);
  const root = structures[structures.length - 1];
  add(`const root = ${structureNames.get(root)};`);
  add(`const settings = {`);
  for (const [ name, value ] of Object.entries(settings)) {
    add(`${name}: ${value},`);
  }
  add(`};`);
  return lines;
}

function getExports(structures) {
  const root = structures[structures.length - 1];
  const { constructor } = root;
  const exportables = [];
  // export only members whose names are legal JS identifiers
  const legal = /^[$\w]+$/;
  for (const { name, flags } of root.static.members) {
    // only read-only properties are exportable
    if (flags & MemberFlag.IsReadOnly && legal.test(name)) {
      try {
        // make sure that getter wouldn't throw (possible with error union)
        constructor[name];
        exportables.push(name);
        /* c8 ignore next 2 */
      } catch (err) {
      }
    }
  }
  return [ 'default', '__zigar', ...exportables ];
}

function manageIndentation(lines) {
  let indent = 0;
  return (s) => {
    if (/^\s*[\]\}]/.test(s)) {
      indent--;
    }
    const lastLine = lines[lines.length - 1];
    if ((lastLine?.endsWith('[') && s.startsWith(']'))
     || (lastLine?.endsWith('{') && s.startsWith('}'))) {
      lines[lines.length - 1] += s;
    } else {
      lines.push(' '.repeat(indent * 2) + s);
    }
    if (/[\[\{]\s*$/.test(s)) {
      indent++;
    }
  };
}

function isDifferent(value, def) {
  if (value === def) {
    return false;
  }
  if (def == null) {
    return value != null;
  }
  if (typeof(def) === 'object' && typeof(value) === 'object') {
    const valueKeys = Object.keys(value);
    const defKeys = Object.keys(def);
    if (valueKeys.length !== defKeys.length) {
      return true;
    }
    for (const key of defKeys) {
      if (isDifferent(value[key], def[key])) {
        return true;
      }
    }
    return false;
  }
  return true;
}

function* chunk(arr, n) {
  if (!Array.isArray(arr)) {
    arr = [ ...arr ];
  }
  for (let i = 0; i < arr.length; i += n) {
    yield arr.slice(i, i + n);
  }
}

const execFileAsync = node_util.promisify(node_child_process.execFile);

async function test(srcPath, options) {
  const { silent = false, extraArgs = [] } = options;
  const config = await createConfig(srcPath, '', options);
  const { zigPath, zigArgs, moduleBuildDir } = config;
  // create config file
  await createProject(config, moduleBuildDir);
  const cwd = moduleBuildDir;
  const stdio = (silent) ? 'pipe' : 'inherit';
  const child = node_child_process.spawn(zigPath, [ ...zigArgs, 'test', ...extraArgs ], { cwd, stdio, windowsHide: true });
  const output = [];
  child.stderr?.on('data', chunk => output.push(chunk));
  const code = await new Promise(resolve => child.on('close', resolve));
  const blob = new Blob(output);
  return { code, stderr: await blob.text() };
}

async function compile(srcPath, modPath, options) {
  const srcInfo = (srcPath) ? await fs.stat(srcPath) : null;
  if (srcInfo?.isDirectory()) {
    srcPath = node_path.join(srcPath, '?');
  }
  const config = await createConfig(srcPath, modPath, options);
  const { outputPath } = config;
  let changed = false;
  let sourcePaths = [];
  if (srcPath) {
    const { zigPath, zigArgs, moduleBuildDir, pdbPath, optimize } = config;
    // only one process can compile a given file at a time
    const pidPath = `${moduleBuildDir}.pid`;
    await acquireLock(pidPath);
    const getOutputMTime = async () => {
      try {
        const stats = await fs.stat(outputPath);
        return stats.mtimeMs;
      } catch (err) {
      }
    };
    const outputMTimeBefore = await getOutputMTime();
    try {
      if (!outputMTimeBefore || options.recompile !== false) {
        const { onStart, onEnd } = options;
        // create config file
        await createProject(config, moduleBuildDir);
        // then run the compiler
        await runCompiler(zigPath, zigArgs, { cwd: moduleBuildDir, onStart, onEnd });
      }
    } catch(err) {
      if (err.code === 'ENOENT') {
        if (!outputMTimeBefore) {
          throw new MissingModule(outputPath);
        }
      } else {
        throw err;
      }
    } finally {
      // get list of files involved in build
      sourcePaths = await findSourcePaths(moduleBuildDir);
      if (config.clean) {
        await deleteDirectory(moduleBuildDir);
      }
      if (optimize != 'Debug' && pdbPath) {
        await deleteFile(pdbPath);
      }
      await releaseLock(pidPath);
      cleanBuildDirectory(config).catch(() => {});
    }
    const outputMTimeAfter = await getOutputMTime();
    changed = outputMTimeBefore !== outputMTimeAfter;  
    sourcePaths.push(config.buildFilePath);
    if (config.packageConfigPath) {
      sourcePaths.push(config.packageConfigPath);
    }
  }
  return { outputPath, changed, sourcePaths }
}

let lock = null;

async function getLock() {
  const previous = lock;  
  let unlock;
  lock = new Promise(resolve => unlock = resolve);
  await previous;
  return unlock;
}

async function runCompiler(path, args, options) {
  const {
    cwd,
    onStart,
    onEnd,
  } = options;
  const unlock = await getLock();
  try {
    onStart?.();
    return execFileAsync(path, args, { cwd, windowsHide: true });
  } catch (err) {
    throw new CompilationError(path, args, cwd, err);
    /* c8 ignore next */
  } finally {
    unlock();
    onEnd?.();
  }
}

class CompilationError extends Error {
  constructor(path, args, cwd, err) {
    super([ `Zig compilation failed`, err.stderr ].filter(s => !!s).join('\n\n'));
    this.path = path;
    this.args = args;
    this.errno = err.errno;
    this.code = err.code;
    if (err.stderr) {
      try {
        const logPath = node_path.join(cwd, 'log');
        node_fs.writeFileSync(logPath, err.stderr);
        this.log = logPath;
        /* c8 ignore next 2 */
      } catch (err) {
      }
    }
  }
}

class MissingModule extends Error {
  constructor(path) {
    super(`Module not found: ${path}`);
  }
}

function formatProjectConfig(config) {
  const lines = [];
  const fields = [
    'moduleName', 'modulePath', 'moduleDir', 'outputPath', 'pdbPath', 'zigarSrcPath', 'useLibc', 
    'useLLVM', 'usePthreadEmulation', 'useRedirection', 'isWASM', 'multithreaded', 'stackSize', 
    'maxMemory', 'evalBranchQuota', 'omitFunctions', 'omitVariables',
  ];
  for (const [ name, value ] of Object.entries(config)) {
    if (fields.includes(name)) {
      const snakeCase = name.replace(/[A-Z]+/g, m => '_' + m.toLowerCase());
      lines.push(`pub const ${snakeCase} = ${JSON.stringify(value ?? null)};`);
    }
  }
  return lines.join('\n') + '\n';
}

async function createProject(config, dir) {
  await createDirectory(dir);
  const content = formatProjectConfig(config);
  const cfgFilePath = node_path.join(dir, 'build.cfg.zig');
  await fs.writeFile(cfgFilePath, content);
  const buildFilePath = node_path.join(dir, 'build.zig');
  await copyFile(buildFilePath, config.buildFilePath);
  const extraFilePath = node_path.join(dir, 'build.extra.zig');
  if (config.extraFilePath) {
    await copyFile(extraFilePath, config.extraFilePath);
  } else {
    await fs.writeFile(extraFilePath, '');
  }
  if (config.packageConfigPath) {
    const packageConfigPath = node_path.join(dir, 'build.zig.zon');
    await copyZonFile(config.packageConfigPath, packageConfigPath);
  }
}

const cwd = process.cwd();

function getCachePath(options) {
  const {
    cacheDir = node_path.join(cwd, '.zigar-cache'),
  } = options;
  return cacheDir;
}

function getModuleCachePath(srcPath, options) {
  const {
    optimize,
  } = options;
  const src = node_path.parse(srcPath);
  const folder = node_path.basename(src.dir).slice(0, 16).trim() + '-' + sha1(src.dir).slice(0, 8);
  const cacheDir = getCachePath(options);
  return node_path.join(cacheDir, folder, optimize, `${src.name}.zigar`);
}

async function findModuleFile(moduleDir, fileName) {
  try {
    // add custom build file if one is found
    const path = moduleDir + fileName;
    await fs.stat(path);
    return path;
  } catch (err) {
  }
}

async function createConfig(srcPath, modPath, options = {}) {
  const {
    platform = getPlatform(),
    arch = getArch(),
    optimize = 'Debug',
    isWASM = false,
    useLibc = isWASM ? false : true,
    useLLVM = null,
    useRedirection = true,
    usePthreadEmulation = false,
    clean = false,
    buildDir = node_path.join(os.tmpdir(), 'zigar-build'),
    buildDirSize = 4294967296,
    zigPath = 'zig',
    zigArgs: zigArgsStr = '',
    multithreaded = (isWASM) ? false : true,
    stackSize = 256 * 1024,
    maxMemory = (isWASM && multithreaded) ? 64 * 1024 * 1024 : undefined,
    evalBranchQuota = 2000000,
    omitFunctions = false,
    omitVariables = false,
    ignoreBuildFile = false,
  } = options;
  const src = node_path.parse(srcPath ?? '');
  const mod = node_path.parse(modPath ?? '');
  const moduleName = mod.name || src.name;
  const modulePath = (src.name !== '?') ? srcPath : undefined;
  const moduleDir = src.dir + node_path.sep;
  const modulePrefix = node_path.basename(moduleName).slice(0, 16);
  const moduleHash = sha1(moduleDir).slice(0, 8);
  const moduleBuildDir = node_path.join(buildDir, modulePrefix + '-' + moduleHash);
  const outputPath = (() => {
    if (!modPath && isWASM) {
      // save output in build folder
      return node_path.join(moduleBuildDir, optimize, `${src.name}.wasm`);
    } else {
      const ext = getLibraryExt(platform);
      return node_path.join(modPath, `${platform}.${arch}.${ext}`);
    }
  })();
  let pdbPath;
  if (platform === 'win32') {
    pdbPath = node_path.join(node_path.dirname(outputPath), `${platform}.${arch}.pdb`);
  }
  const zigArgs = zigArgsStr.split(/\s+/).filter(s => !!s);
  if (!zigArgs.find(s => /^[^-]/.test(s))) {
    zigArgs.unshift('build');
  }
  if (!zigArgs.find(s => /^\-Doptimize=/.test(s))) {
    zigArgs.push(`-Doptimize=${optimize}`);
  }
  if (!zigArgs.find(s => /^\-Dtarget=/.test(s))) {
    // translate from names used by Node to those used by Zig
    const cpuArchs = {
      arm: 'arm',
      arm64: 'aarch64',
      ia32: 'x86',
      loong64: 'loong64',
      mips: 'mips',
      mipsel: 'mipsel',
      ppc: 'powerpc',
      ppc64: 'powerpc64le',
      s390: undefined,
      riscv64: 'riscv64',
      s390x: 's390x',
      x64: 'x86_64',
    };
    const osTags = {
      aix: 'aix',
      darwin: 'macos',
      freebsd: 'freebsd',
      linux: 'linux-gnu',
      openbsd: 'openbsd',
      sunos: 'solaris',
      win32: 'windows',
    };
    const cpuArch = cpuArchs[arch] ?? arch;
    const osTag = osTags[platform] ?? platform;
    zigArgs.push(`-Dtarget=${cpuArch}-${osTag}`);
  }
  if (isWASM && !zigArgs.find(s => /^\-Dcpu=/.test(s))) {
    if (multithreaded) {
      // we need support for atomic operations, among other things
      zigArgs.push(`-Dcpu=generic+atomics+bulk_memory`);
    } else {
      zigArgs.push(`-Dcpu=generic`);
    }
  }
  const zigarSrcPath = node_url.fileURLToPath(new node_url.URL('../zig/', (typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('index.cjs', document.baseURI).href))));
  let buildFilePath = node_path.join(zigarSrcPath, `build.zig`);
  if (!ignoreBuildFile) {
    // use custom build file if one is found
    const customBuildFilePath = await findModuleFile(moduleDir, 'build.zig');
    if (customBuildFilePath) {
      const code = await fs.readFile(customBuildFilePath, 'utf-8');
      const remaining = code.replace(/\/\/.*/g, '').trim();
      if (remaining) {
        buildFilePath = customBuildFilePath;
      }
    }
  }
  // add path to build.extra.zig if it exists
  const extraFilePath = await findModuleFile(moduleDir, 'build.extra.zig');
  // add package manager manifest
  const packageConfigPath = await findModuleFile(moduleDir, 'build.zig.zon');
  return {
    platform,
    arch,
    optimize,
    moduleName,
    modulePath,
    moduleDir,
    moduleBuildDir,
    zigarSrcPath,
    buildDir,
    buildDirSize,
    buildFilePath,
    packageConfigPath,
    outputPath,
    pdbPath,
    clean,
    zigPath,
    zigArgs,
    useLibc,
    useLLVM,
    useRedirection,
    usePthreadEmulation,
    isWASM,
    multithreaded,
    stackSize,
    maxMemory,
    evalBranchQuota,
    omitFunctions,
    omitVariables,
    ignoreBuildFile,
    extraFilePath,
  };
}

async function getManifestLists(buildPath) {
  let dirPath;
  let names;
  try {
    dirPath = node_path.join(buildPath, '.zig-cache', 'h');
    names = await fs.readdir(dirPath);
    /* c8 ignore next 8 */
  } catch (err) {
    try {
      dirPath = node_path.join(buildPath, 'zig-cache', 'h');
      names = await fs.readdir(dirPath);
    } catch (err) {
      names = [];
    }
  }
  return names.filter(n => /\.txt$/.test(n)).map(n => node_path.join(dirPath, n));
}

async function findSourcePaths(buildPath) {
  const realBuildPath = await fs.realpath(buildPath);
  const manifestPaths = await getManifestLists(realBuildPath);
  const involved = {};
  for (const manifestPath of manifestPaths) {
    try {
      const data = await fs.readFile(manifestPath, 'utf-8');
      if (data.length > 0) {
        const lines = data.split(/\r?\n/);
        // https://ziglang.org/documentation/master/std/#std.Build.Cache.Manifest.writeManifest
        // size inode mtime bin_digest prefix sub_path
        const re = /\d+ \d+ \d+ \w+ \d+ (.+)/;
        for (const line of lines) {
          const m = re.exec(line);
          if (m) {
            const srcPath = m[1];
            if(node_path.isAbsolute(srcPath) && !srcPath.startsWith(realBuildPath) && !srcPath.includes('/.cache/zig/')) {
              try {
                await fs.stat(srcPath);
                involved[srcPath] = true;
                /* c8 ignore next */
              } catch {};
            }
          }
        }
      }
      /* c8 ignore next 2 */
    } catch (err) {
    }
  }
  return Object.keys(involved);
}

async function cleanBuildDirectory(config) {
  const { buildDir, buildDirSize } = config;
  try {
    const names = await fs.readdir(buildDir);
    const list = [];
    let total = 0;
    for (const name of names) {
      const path = node_path.join(buildDir, name);
      const info = await fs.stat(path);
      if (info.isDirectory()) {
        const { size, mtimeMs } = await getDirectoryStats(path);
        total += size;
        list.push({ path, size, mtimeMs });
      }
    }
    list.sort((a, b) => a.mtimeMs - b.mtimeMs);
    let free = Infinity;
    if (fs.statfs) {
      const { bsize, bavail } = await fs.statfs(buildDir);
      free = bsize * bavail;
    }
    for (const { path, size } of list) {
      if (!(total > buildDirSize) && (free > 1073741824)) {
        break;
      }
      try {
        const pidPath = `${path}.pid`;
        await acquireLock(pidPath, false);
        try {
          await deleteDirectory(path);
          total -= size;
          free += size;
        } finally {
          await releaseLock(pidPath);
        }
        /* c8 ignore next 2 */
      } catch (err) {
      }
    }
    /* c8 ignore next 2 */
  } catch (err) {
  }
}

const optionsForCompile = {
  optimize: {
    type: 'string',
    enum: [ 'Debug', 'ReleaseSmall', 'ReleaseFast', 'ReleaseSafe' ],
    title: 'Zig optimization mode',
  },
  omitFunctions: {
    type: 'boolean',
    title: 'Omit all Zig functions',
  },
  omitVariables: {
    type: 'boolean',
    title: 'Omit all variables',
  },
  omitExports: {
    type: 'boolean',
    title: 'Omit export statements',
  },
  evalBranchQuota: {
    type: 'number',
    title: 'Value provided to @setEvalBranchQuota() during export',
  },
  useLibc: {
    type: 'boolean',
    title: 'Link in C standard library',
  },
  useLLVM: {
    type: 'boolean',
    title: 'Use LLVM as compiler backend',
  },
  useRedirection: {
    type: 'boolean',
    title: 'Redirect IO operations to JavaScript handlers',
  },
  topLevelAwait: {
    type: 'boolean',
    title: 'Use top-level await to load WASM file',
  },
  multithreaded: {
    type: 'boolean',
    title: 'Enable multithreading',
  },
  buildDir: {
    type: 'string',
    title: 'Root directory where temporary build directories are placed',
  },
  cacheDir: {
    type: 'string',
    title: 'Directory where compiled library files are placed',
  },
  zigPath: {
    type: 'string',
    title: 'Zig command used to build libraries',
  },
  zigArgs: {
    type: 'string',
    title: 'Addition command-line passed to the Zig compiler',
  },
  modules: {
    type: 'object',
    title: 'Information concerning individual modules, including source file and loader',
  },
  sourceFiles: {
    type: 'object',
    title: 'Map of modules to source files/directories (legacy)',
  },
  quiet: {
    type: 'boolean',
    title: 'Disable compilation indicator',
  },
  recompile: {
    type: 'boolean',
    title: 'Recompile module when source file have been changed',
  },
  clean: {
    type: 'boolean',
    title: 'Remove temporary build directory after compilation finishes',
  },
  targets: {
    type: 'object',
    title: 'List of cross-compilation targets',
  },
  ignoreBuildFile: {
    type: 'boolean',
    title: 'Ignore build.zig present alongside source files',
  },
};

const optionsForTranspile = {
  nodeCompat: {
    type: 'boolean',
    title: 'Produce code compatible with Node.js',
  },
  embedWASM: {
    type: 'boolean',
    title: 'Embed WASM file in JavaScript source code',
  },
  stripWASM: {
    type: 'boolean',
    title: 'Remove unnecessary code from WASM file',
  },
  stackSize: {
    type: 'number',
    title: 'Size of the call stack in bytes',
  },
  maxMemory: {
    type: 'number',
    title: 'Maximum amount of shared memory in bytes',
  },
  keepNames: {
    type: 'boolean',
    title: 'Keep names of function in WASM binary when stripping',
  },
  usePthreadEmulation: {
    type: 'boolean',
    title: 'Provide emulated pthread functions',
  },
};

const allOptions = {
  ...optionsForCompile,
  ...optionsForTranspile,
};

function extractOptions(searchParams, availableOptions) {
  const options = {};
  const names = Object.keys(availableOptions);
  for (const [ name, string ] of searchParams) {
    const key = getCamelCase(name, names);
    const option = availableOptions[key];
    if (!option) {
      throw new UnknownOption(name);
    }
    if (key === 'optimize') {
      options[key] = getCamelCase(string, [ 'Debug', 'ReleaseSafe', 'ReleaseFast', 'ReleaseSmall' ]);
    } else {
      switch (option.type) {
        case 'boolean':
          options[key] = !!parseInt(string);
          break;
        case 'number':
          options[key] = parseInt(string);
          break;
        default:
          options[key] = string;
      }
    }
  }
  return options;
}

function getCamelCase(name, names) {
  for (const nameCC of names) {
    const nameSC = nameCC.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
    const nameKC = nameSC.replace(/_/g, '-');
    if (name === nameKC || name === nameSC || name === nameCC) {
      return nameCC;
    }
  }
  return name;
}

class UnknownOption extends Error {
  constructor(key) {
    const adjective = (allOptions[key]) ? 'Unavailable' : 'Unrecognized';
    super(`${adjective} option: ${key}`);
  }
}

async function findConfigFile(name, dir) {
  const path = node_path.join(dir, name);
  try {
    await fs.stat(path);
    return path;
  } catch (err) {
    const parent = node_path.dirname(dir);
    if (parent !== dir) {
      return findConfigFile(name, parent);
    }
  }
}

async function loadConfigFile(cfgPath, availableOptions) {
  const text = await loadFile(cfgPath);
  const json = JSON.parse(text);
  return processConfig(json, cfgPath, availableOptions);
}

function processConfig(object, cfgPath, availableOptions) {
  const options = {};
  for (let [ key, value ] of Object.entries(object)) {
    const option = availableOptions[key];
    if (!option) {
      throw new UnknownOption(key);
    }
    if (typeof(value) !== option.type) {
      throw new Error(`${key} is expected to be a ${option.type}, received: ${value}`);
    }
    if (key === 'sourceFiles') {
      const modules = {};
      for (const [ modulePath, source ] of Object.entries(value)) {
        modules[modulePath] = { source };
      }
      value = modules;
      key = 'modules';
    }
    if (key === 'modules') {
      // expand to absolute paths
      const cfgDir = node_path.dirname(cfgPath);
      const modules = {};
      for (let [ modulePath, module ] of Object.entries(value)) {
        modulePath = node_path.resolve(cfgDir, modulePath);
        module.source = node_path.resolve(cfgDir, module.source);
        if (module.loader) {
          module.loader = node_path.resolve(cfgDir, module.loader);
        }
        modules[modulePath] = module;
      }
      value = modules;
    }
    options[key] = value;
  }
  return options;
}

function findSourceFile(modulePath, options) {
  const { modules } = options;
  return modules?.[modulePath]?.source;
}

const statusCharacters = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
let statusClear;

function showStatus(message) {
  const fd = 2;
  const tty$1 = tty.isatty(fd);
  let currentCP;
  hideStatus();
  if (tty$1) {
    /* c8 ignore start */
    if (os$1.platform() === 'win32') {
      try {
        const m = /\d+/.exec(child_process.execSync('chcp').toString().trim());
        if (m) {
          currentCP = parseInt(m[0]);
          if (currentCP !== 65001) {
            child_process.execSync('chcp 65001');
          }
        }
      } catch (err) {
      }
    }
    /* c8 ignore end */
    let pos = 0;
    const update = () => {
      const c = statusCharacters.charAt(pos++);
      if (pos >= statusCharacters.length) {
        pos = 0;
      }
      fs$1.write(fd, `\r\x1b[33m${c}\x1b[0m ${message}`, () => {});
    };
    const interval = setInterval(update, 150);
    statusClear = () => {
      clearInterval(interval);
      fs$1.write(fd, '\r\x1b[K', () => {});
      /* c8 ignore start */
      if (currentCP && currentCP !== 65001) {
        try {
          child_process.execSync(`chcp ${currentCP}`);
        } catch (err){
        }
      }
      /* c8 ignore end */
    };
    update();
    /* c8 ignore next 6 */
  } else {
    fs$1.write(fd, message, () => {});
    statusClear = () => {
      fs$1.write(fd, `\b \b`.repeat(message.length), () => {});
    };
  }
}

function hideStatus() {
  statusClear?.();
  statusClear = null;
}

function showResult(message) {
  const fd = 2;
  const tty$1 = tty.isatty(fd);
  const c = '\u2713';
  if (tty$1) {
    fs$1.write(fd, `\r\x1b[32m${c}\x1b[0m ${message}\n`, () => {});
    /* c8 ignore next 3 */
  } else {
    fs$1.write(fd, `${message}\n`, () => {});
  }
}

exports.compile = compile;
exports.extractOptions = extractOptions;
exports.findConfigFile = findConfigFile;
exports.findSourceFile = findSourceFile;
exports.generateCode = generateCode;
exports.getArch = getArch;
exports.getCachePath = getCachePath;
exports.getLibraryExt = getLibraryExt;
exports.getModuleCachePath = getModuleCachePath;
exports.getPlatform = getPlatform;
exports.hideStatus = hideStatus;
exports.loadConfigFile = loadConfigFile;
exports.normalizePath = normalizePath;
exports.optionsForCompile = optionsForCompile;
exports.optionsForTranspile = optionsForTranspile;
exports.processConfig = processConfig;
exports.showResult = showResult;
exports.showStatus = showStatus;
exports.test = test;
