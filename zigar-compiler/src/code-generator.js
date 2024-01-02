import { MemberType, isReadOnly } from '../../zigar-runtime/src/member.js';
import { StructureType, findAllObjects, getFeaturesUsed } from '../../zigar-runtime/src/structure.js';

export function generateCodeForWASM(definition, params) {
  const { structures, keys } = definition;
  const {
    runtimeURL,
    loadWASM,
    topLevelAwait = true,
    omitExports = false,
  } = params;
  const features = getFeaturesUsed(structures);
  const exports = getExports(structures);
  const lines = [];
  const add = manageIndentation(lines);
  add(`import {`);
  for (const name of [ 'loadModule', ...features ]) {
    add(`${name},`);
  }
  add(`} from ${JSON.stringify(runtimeURL)};`);
  // reduce file size by only including code of features actually used
  // dead-code remover will take out code not referenced here
  add(`\n// activate features`);
  for (const feature of features) {
    add(`${feature}();`);
  }
  add(`\n// initiate loading and compilation of WASM bytecodes`);
  add(`const source = ${loadWASM ?? null};`);
  // write out the structures as object literals
  lines.push(...generateStructureDefinitions(structures, keys));
  lines.push(...generateLoadStatements('source', JSON.stringify(!topLevelAwait)));
  lines.push(...generateExportStatements(exports, omitExports));
  if (topLevelAwait && loadWASM) {
    add(`await __zigar.init();`);
  }
  const code = lines.join('\n');
  return { code, exports, structures };
}

export function generateCodeForNode(definition, params) {
  const { structures, keys } = definition;
  const {
    runtimeURL,
    libPath,
    topLevelAwait = true,
    omitExports = false,
  } = params;
  const exports = getExports(structures);
  const lines = [];
  const add = manageIndentation(lines);
  add(`import { loadModule } from ${JSON.stringify(runtimeURL)};`);
  // all features are enabled by default for Node
  lines.push(...generateStructureDefinitions(structures, keys));
  lines.push(...generateLoadStatements(JSON.stringify(libPath), 'false'));
  lines.push(...generateExportStatements(exports, omitExports));
  if (topLevelAwait) {
    add(`await __zigar.init();`);
  }
  const code = lines.join('\n');
  return { code, exports, structures };
}

function generateLoadStatements(source, writeBack) {
  const lines = [];
  const add = manageIndentation(lines);
  add(`// create runtime environment`);
  add(`const env = loadModule(${source});`);
  add(`const __zigar = env.getControlObject();`);
  add(`env.recreateStructures(structures);`);
  add(`env.linkVariables(${writeBack});`);
  add(``);
  return lines;
}

function generateExportStatements(exports, omitExports) {
  const lines = [];
  const add = manageIndentation(lines);
  add(`const { constructor } = root;`);
  if (!omitExports) {
    add(`export { constructor as default, __zigar }`);
    // the first two exports are default and __zigar
    const exportables = exports.slice(2);
    if (exportables.length > 0) {
      const oneLine = exportables.join(', ');
      if (oneLine.length < 70) {
        add(`export const { ${oneLine} } = constructor;`);
      } else {
        add(`export const {`)
        for (const name of exportables) {
          add(`${name},`);
        }
        add(`} = constructor;`);
      }
    }
  }
  return lines;
}

function generateStructureDefinitions(structures, keys) {
  const { MEMORY, SLOTS, CONST } = keys;
  const lines = [];
  const add = manageIndentation(lines);
  const defaultStructure = {
    constructor: null,
    typedArray: null,
    type: StructureType.Primitive,
    name: undefined,
    byteSize: 0,
    align: 0,
    isConst: false,
    hasPointer: false,
    instance: {
      members: [],
      methods: [],
      template: null,
    },
    static: {
      members: [],
      methods: [],
      template: null,
    },
  };
  add(`\n// structure defaults`);
  add(`const s = {`);
  for (const [ name, value ] of Object.entries(defaultStructure)) {
    add(`${name}: ${JSON.stringify(value)},`);
  }
  add(`};`);
  const defaultMember = {
    type: MemberType.Void,
    isRequired: false,
  };
  add(`\n// member defaults`);
  add(`const m = {`);
  for (const [ name, value ] of Object.entries(defaultMember)) {
    add(`${name}: ${JSON.stringify(value)},`);
  }
  add(`};`);
  // create empty objects first, to allow objects to reference each other
  add(``);
  const structureNames = new Map();
  const structureMap = new Map();
  for (const [ index, structure ] of structures.entries()) {
    const varname = `s${index}`;
    structureNames.set(structure, varname);
    structureMap.set(structure.constructor, structure);
  }
  for (const slice of chunk(structureNames.values(), 10)) {
    add(`const ${slice.map(n => `${n} = {}`).join(', ')};`);
  }
  const objects = findAllObjects(structures, SLOTS);
  const objectNames = new Map();
  const views = [];
  for (const [ index, object ] of objects.entries()) {
    const varname = `o${index}`;
    objectNames.set(object, varname);
    if (object[MEMORY]) {
      views.push(object[MEMORY]);
    }
  }
  for (const slice of chunk(objectNames.values(), 10)) {
    add(`const ${slice.map(n => `${n} = {}`).join(', ')};`);
  }
  // define buffers
  const arrayBufferNames = new Map();
  for (const [ index, dv ] of views.entries()) {
    if (!arrayBufferNames.get(dv.buffer)) {
      const varname = `a${index}`;
      arrayBufferNames.set(dv.buffer, varname);
      if (dv.buffer.byteLength > 0) {
        const ta = new Uint8Array(dv.buffer);
        add(`const ${varname} = new Uint8Array([ ${ta.join(', ')} ]);`);
      } else {
        add(`const ${varname} = new Uint8Array();`);
      }
    }
  }
  // add properties to objects
  if (objects.length > 0) {
    add('\n// define objects');
    for (const object of objects) {
      const varname = objectNames.get(object);
      const structure = structureMap.get(object.constructor);
      const { [MEMORY]: dv, [SLOTS]: slots } = object;
      add(`Object.assign(${varname}, {`);
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
          if (object[CONST]) {
            add(`const: true,`);
          }
        }
      }
      const entries = (slots) ? Object.entries(slots) : [];
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
  const methods = [];
  for (const structure of structures) {
    // add static members; instance methods are also static methods, so
    // we don't need to add them separately
    methods.push(...structure.static.methods);
  }
  const methodNames = new Map();
  if (methods.length > 0) {
    add(`\n// define functions`);
    for (const [ index, method ] of methods.entries()) {
      const varname = `f${index}`;
      methodNames.set(method, varname);
      add(`const ${varname} = {`);
      for (const [ name, value ] of Object.entries(method)) {
        switch (name) {
          case 'argStruct':
            add(`${name}: ${structureNames.get(value)},`);
            break;
          default:
            add(`${name}: ${JSON.stringify(value)},`);
        }
      }
      add(`};`);
    }
  }
  add('\n// define structures');
  for (const structure of structures) {
    const varname = structureNames.get(structure);
    add(`Object.assign(${varname}, {`);
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
            const { methods, members, template } = value;
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
            add(`methods: [`);
            for (const slice of chunk(methods, 10)) {
              add(slice.map(m => methodNames.get(m)).join(', ') + ',');
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
  add(`const structures = [`);
  for (const slice of chunk([ ...structureNames.values() ], 10)) {
    add(slice.join(', ') + ',');
  }
  add(`];`)
  const root = structures[structures.length - 1];
  add(`const root = ${structureNames.get(root)};`);
  add(``);
  return lines;
}

function getExports(structures) {
  const root = structures[structures.length - 1];
  const exportables = [];
  // export only members whose names are legal JS identifiers
  const legal = /^[$\w]+$/;
  for (const method of root.static.methods) {
    if (legal.test(method.name)) {
      exportables.push(method.name);
    }
  }
  for (const member of root.static.members) {
    // only read-only properties are exportable
    if (isReadOnly(member.type) && legal.test(member.name)) {
      // make sure that getter wouldn't throw (possible with error union)
      const { constructor } = root;
      try {
        const value = constructor[member.name];
        exportables.push(member.name);
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