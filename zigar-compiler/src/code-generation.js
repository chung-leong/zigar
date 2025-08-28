import {
  MemberFlag, MemberType, StructurePurpose, StructureType
} from '../../zigar-runtime/src/constants.js';
import { CONST_TARGET, MEMORY, SLOTS } from '../../zigar-runtime/src/symbols.js';
import { findObjects } from '../../zigar-runtime/src/utils.js';
import { getArch, getLibraryExt, getPlatform } from './utility-functions.js';

export function generateCode(definition, params) {
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
  const exports = getExports(structures);
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
    if (exports.length > 2) {
      add(`const {`)
      for (const [ index, name ] of exports.entries()) {
        if (index >= 2) {
          add(`${name}: v${index},`);
        }
      }
      add(`} = v0;`);
    }
    if (type == 'esm') {
      add(`export {`);
      for (const [ index, name ] of exports.entries()) {
        add(`v${index} as ${name},`);
      }
      add(`};`)
    } else {
      add(`module.exports = {`)
      for (const [ index, name ] of exports.entries()) {
        add(`${name}: v${index},`);
      }
      add(`};`)
    }
  } else {
    add(`const { constructor } = root;`);
    add(`const __zigar = env.getSpecialExports();`);
    specialVarName = '__zigar'
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
  return { code, exports, structures };
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
        add(`},`)
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
        if (handle) {
          add(`handle: ${handle},`);
        }
        if (object[CONST_TARGET]) {
          add(`const: true,`);
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
  add(`];`)
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
