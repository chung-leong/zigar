import { MemberFlag, MemberType, StructureType } from '../../zigar-runtime/src/constants.js';
import { findObjects } from '../../zigar-runtime/src/utils.js';

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
  } = params;
  const exports = getExports(structures);
  const lines = [];
  const add = manageIndentation(lines);
  add(`import { createEnvironment } from ${JSON.stringify(runtimeURL)};`);
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
  add(`env.recreateStructures(structures, options);`);
  if (binarySource) {
    if (moduleOptions) {
      add(`\n// initiate loading and compilation of WASM bytecodes`);
    } else {
      add(`\n// load shared library`);
    }
    add(`const source = ${binarySource};`);
    add(`env.loadModule(source, ${moduleOptions ? JSON.stringify(moduleOptions) : null})`);
    // if top level await is used, we don't need to write changes into fixed memory buffers
    add(`env.linkVariables(${!topLevelAwait});`);
  }
  add(`\n// export root namespace and its methods and constants`);
  if (omitExports) {
    add(`const { constructor } = root;`);
    add(`const __zigar = env.getSpecialExports();`);
  } else {
    // the first two exports are default and __zigar
    add(`const { constructor: v0 } = root;`);
    add(`const v1 = env.getSpecialExports();`);
    if (exports.length > 2) {
      add(`const {`)
      for (const [ index, name ] of exports.entries()) {
        if (index >= 2) {
          add(`${name}: v${index},`);
        }
      }
      add(`} = v0;`);
    }
    add(`export {`);
    for (const [ index, name ] of exports.entries()) {
      add(`v${index} as ${name},`);
    }
    add(`};`)
  }
  if (topLevelAwait && binarySource) {
    add(`await v1.init();`);
  }
  const code = lines.join('\n');
  return { code, exports, structures };
}

function addStructureDefinitions(lines, definition) {
  const { structures, options, keys } = definition;
  const { MEMORY, SLOTS, CONST_TARGET } = keys;
  const add = manageIndentation(lines);
  const defaultStructure = {
    constructor: null,
    type: StructureType.Primitive,
    flags: 0,
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
  for (const [ index, dv ] of views.entries()) {
    if (!arrayBufferNames.get(dv.buffer)) {
      const varname = `a${index}`;
      arrayBufferNames.set(dv.buffer, varname);
      let initializers = '';
      if (dv.buffer.byteLength > 0) {
        const ta = new Uint8Array(dv.buffer);
        let allZeros = true;
        for (const byte of ta) {
          if (byte !== 0) {
            allZeros = false;
            break;
          }
        }
        if (allZeros) {
          initializers = `${ta.length}`;
        } else {
          initializers = `[ ${ta.join(', ')} ]`;
        }
      }
      addU();
      add(`const ${varname} = U(${initializers});`);
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
        const buffer = arrayBufferNames.get(dv.buffer);
        const pairs = [ `array: ${buffer}` ];
        if (dv.byteLength < dv.buffer.byteLength) {
          pairs.push(`offset: ${dv.byteOffset}`);
          pairs.push(`length: ${dv.byteLength}`);
        }
        add(`memory: { ${pairs.join(', ')} },`);
        if (dv.hasOwnProperty('reloc')) {
          add(`reloc: ${dv.reloc},`);
        }
        if (object[CONST_TARGET]) {
          add(`const: true,`);
        }
      }
      const entries = (slots) ? Object.entries(slots).filter(a => a[1]) : [];
      if (entries.length > 0) {
        add(`slots: {`);
        const pairs = entries.map(([slot, child]) => `${slot}: ${objectNames.get(child)}`);
        for (const slice of chunk(pairs, 10)) {
          add(slice.join(', ') + ',');
        }
        add(`},`);
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
            case 'instance':
            case 'static': {
              const { members, template } = value;
              add(`${name}: {`);
              add(`members: [`);
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
  add(`const options = {`);
  for (const [ name, value ] of Object.entries(options)) {
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