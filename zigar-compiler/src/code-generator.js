import { MEMORY, SLOTS, STRUCTURE } from '../../zigar-runtime/src/symbol.js';
import { MemberType, getMemberFeature } from '../../zigar-runtime/src/member.js';
import { StructureType, getStructureFeature } from '../../zigar-runtime/src/structure.js';

export function generateCode(structures, params) {
  const {
    runtimeURL,
    loadWASM,
    topLevelAwait,
    ...structureOptions
  } = params;
  const lines = [];
  let indent = 0;
  function add(s) {
    if (/^\s*[\]\}]/.test(s)) {
      indent--;
    }
    lines.push(' '.repeat(indent * 2) + s);
    if (/[\[\{]\s*$/.test(s)) {
      indent++;
    }
  }
  const structureFeatures = {}, memberFeatures = {};
  for (const structure of structures) {
    structureFeatures[ getStructureFeature(structure) ] = true;
    for (const members of [ structure.instance.members, structure.static.members ]) {
      for (const member of members) {
        memberFeatures[ getMemberFeature(member) ] = true;
      }
    }
  }
  if (memberFeatures.useIntEx) {
    delete memberFeatures.useInt;
  }
  if (memberFeatures.useEnumerationItemEx) {
    delete memberFeatures.useEnumerationItem;
  }
  if (memberFeatures.useFloatEx) {
    delete memberFeatures.useFloat;
  }
  if (memberFeatures.useBoolEx) {
    delete memberFeatures.useBool;
  }
  const features = [ ...Object.keys(structureFeatures), ...Object.keys(memberFeatures) ];
  const imports = [ 'finalizeStructures' ];
  if (loadWASM) {
    imports.push('linkModule');
  }
  imports.push(...features);
  add(`import {`);
  for (const name of imports) {
    add(`${name},`);
  }
  add(`} from ${JSON.stringify(runtimeURL)};`);

  add(`\n// activate features`);
  for (const feature of features) {
    add(`${feature}();`);
  }

  add(`\n// define structures`);
  const structureNames = new Map();
  const arrayBufferNames = new Map();
  let arrayBufferCount = 0;
  for (const [ index, structure ] of structures.entries()) {
    const varname = `s${index}`;
    addStructure(varname, structure);
    structureNames.set(structure, varname);
  }

  add(`\n// finalize structures`);
  const varnames = [ ...structureNames.values() ];
  if (varnames.length <= 10) {
    add(`const structures = [ ${varnames.join(', ') } ];`);
  } else {
    add(`const structures = [`);
    for (let i = 0; i < varnames.length; i += 10) {
      const slice = varnames.slice(i, i + 10);
      add(`${slice.join(', ')},`);
    }
    add(`];`);
  }
  add(`const linkage = finalizeStructures(structures, ${JSON.stringify(structureOptions)});`);

  // the root structure gets finalized last
  const root = structures[structures.length - 1];
  add(`const module = ${structureNames.get(root)}.constructor;`);

  if (loadWASM) {
    add('\n// initiate loading and compilation of WASM bytecodes');
    add(`const wasmPromise = ${loadWASM};`);
    add('const __init = linkModule(wasmPromise, linkage);');
  } else {
    add('\n// no need to use WASM binary');
    add('const __init = Promise.resolve(true);');
  }

  add('\n// export functions, types, and constants');
  const exportables = [];
  for (const method of root.methods) {
    exportables.push(method.name);
  }
  for (const member of root.static.members) {
    // only read-only properties are exportable
    let readOnly = false;
    if (member.type === MemberType.Type) {
      readOnly = true;
    } else if (member.type === MemberType.Object && member.structure.type === StructureType.Pointer) {
      if (member.isConst) {
        readOnly = true;
      }
    }
    if (readOnly) {
      exportables.push(member.name);
    }
  }
  add(`const {`);
  for (const name of exportables) {
    add(`${name},`);
  }
  add(`} = module;`);
  add(`export {`);
  for (const name of [ 'module as default', ...exportables, '__init' ]) {
    add(`${name},`);
  }
  add(`};`);
  if (topLevelAwait) {
    add(`\n// await initialization`);
    add(`await __init`);
  }
  add(``);

  function addStructure(varname, structure) {
    addBuffers(structure.instance.template);
    addBuffers(structure.static.template);
    add(`const ${varname} = {`);
    for (const [ name, value ] of Object.entries(structure)) {
      switch (name) {
        case 'instance':
        case 'static':
          add(`${name}: {`);
          addMembers(value.members);
          addTemplate(value.template);
          add(`},`);
          break;
        case 'methods':
          addMethods(value);
          break;
        case 'options':
          if (Object.keys(value).length === 0) {
            break;
          } else {
            // falls through
          }
        default:
          add(`${name}: ${JSON.stringify(value)},`);
      }
    }
    add(`};`);
  }

  function addMembers(members) {
    if (members.length > 0) {
      add(`members: [`);
      for (const member of members) {
        addMember(member);
      }
      add(`],`);
    } else {
      add(`members: [],`);
    }
  }

  function addMember(member) {
    add(`{`);
    for (const [ name, value ] of Object.entries(member)) {
      switch (name) {
        case 'structure':
          add(`${name}: ${structureNames.get(value)},`);
          break;
        default:
          add(`${name}: ${JSON.stringify(value)},`);
      }
    }
    add(`},`);
  }

  function addTemplate(template) {
    addObject('template', template);
  }

  function addObject(name, object) {
    if (object) {
      const { [STRUCTURE]: structure, [MEMORY]: dv, [SLOTS]: slots } = object;
      add(`${name}: {`);
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
        if (dv.hasOwnProperty('address')) {
          add(`address: ${dv.address},`);
        }
      }
      if (slots && Object.keys(slots).length > 0) {
        add(`slots: {`);
        for (const [ slot, child ] of Object.entries(slots)) {
          addObject(slot, child);
        }
        add(`},`);
      }
      add(`},`);
    } else {
      add(`${name}: null`);
    }
  }

  function addBuffers(object) {
    if (object) {
      const { [MEMORY]: dv, [SLOTS]: slots } = object;
      if (dv && !arrayBufferNames.get(dv.buffer)) {
        const varname = `a${arrayBufferCount++}`;
        arrayBufferNames.set(dv.buffer, varname);
        const ta = new Uint8Array(dv.buffer);
        add(`const ${varname} = new Uint8Array([ ${ta.join(', ')} ]);`);
      }
      if (slots) {
        for (const [ slot, child ] of Object.entries(slots)) {
          addBuffers(child);
        }
      }
    }
  }

  function addMethods(methods) {
    if (methods.length > 0) {
      add(`methods: [`);
      for (const method of methods) {
        addMethod(method);
      }
      add(`],`);
    } else {
      add(`methods: [],`)
    }
  }

  function addMethod(method) {
    add(`{`);
    for (const [ name, value ] of Object.entries(method)) {
      switch (name) {
        case 'argStruct':
          add(`${name}: ${structureNames.get(value)},`);
          break;
        default:
          add(`${name}: ${JSON.stringify(value)},`);
      }
    }
    add(`},`);
  }

  const code = lines.join('\n');
  return code;
}

