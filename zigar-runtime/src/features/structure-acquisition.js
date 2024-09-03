import { CONST_TARGET, FIXED, MEMORY, SLOTS } from '../../src/symbols.js';
import { MemberType, StructureType } from '../constants.js';
import { mixin } from '../environment.js';

export default mixin({
  comptime: false,
  slots: {},
  structures: [],

  readSlot(target, slot) {
    const slots = target ? target[SLOTS] : this.slots;
    return slots?.[slot];
  },
  writeSlot(target, slot, value) {
    const slots = target ? target[SLOTS] : this.slots;
    if (slots) {
      slots[slot] = value;
    }
  },
  createTemplate(dv) {
    return {
      [MEMORY]: dv,
      [SLOTS]: {}
    };
  },
  beginStructure(def) {
    const {
      type,
      name,
      length,
      byteSize,
      align,
      isConst,
      isTuple,
      isIterator,
      hasPointer,
    } = def;
    return {
      constructor: null,
      typedArray: null,
      type,
      name,
      length,
      byteSize,
      align,
      isConst,
      isTuple,
      isIterator,
      hasPointer,
      instance: {
        members: [],
        template: null,
      },
      static: {
        members: [],
        template: null,
      },
    };
  },
  attachMember(structure, member, isStatic = false) {
    const target = (isStatic) ? structure.static : structure.instance;
    target.members.push(member);
  },
  attachTemplate(structure, template, isStatic = false) {
    const target = (isStatic) ? structure.static : structure.instance;
    target.template = template;
  },
  endStructure(structure) {
    this.structures.push(structure);
    this.finalizeStructure(structure);
  },
  defineFactoryArgStruct() {
    const options = this.beginStructure({
      type: StructureType.Struct,
      name: 'Options',
      byteSize: 2,
      hasPointer: false,
    })
    this.attachMember(options, {
      type: MemberType.Bool,
      name: 'omitFunctions',
      bitOffset: 0,
      bitSize: 1,
      byteSize: 1,
    });
    this.attachMember(options, {
      type: MemberType.Bool,
      name: 'omitVariables',
      bitOffset: 8,
      bitSize: 1,
      byteSize: 1,
    });
    this.defineStructure(options);
    const structure = this.beginStructure({
      type: StructureType.ArgStruct,
      name: 'ArgFactory',
      byteSize: 2,
      hasPointer: false,
    });
    this.attachMember(structure, {
      type: MemberType.Void,
      name: 'retval',
      bitOffset: 0,
      bitSize: 0,
      byteSize: 0
    });
    this.attachMember(structure, {
      type: MemberType.Object,
      name: '0',
      bitOffset: 0,
      bitSize: 16,
      byteSize: 2,
      slot: 0,
      structure: options,
    });
    return this.defineStructure(structure);
  },
  acquireStructures(options) {
    const {
      omitFunctions = false,
      omitVariables = isElectron(),
    } = options;
    this.resetGlobalErrorSet();
    const thunkAddress = this.getFactoryThunk();
    const ArgStruct = this.defineFactoryArgStruct();
    const args = new ArgStruct([ { omitFunctions, omitVariables } ]);
    this.comptime = true;
    this.invokeThunk(thunkAddress, thunkAddress, args);
    this.comptime = false;
  },
  getRootModule() {
    const root = this.structures[this.structures.length - 1];
    return root.constructor;
  },
  hasMethods() {
    return !!this.structures.find(s => s.type === StructureType.Function);
  },
  exportStructures() {
    this.acquireDefaultPointers();
    this.prepareObjectsForExport();
    const { structures, runtimeSafety, littleEndian } = this;
    return {
      structures,
      options: { runtimeSafety, littleEndian },
      keys: { MEMORY, SLOTS, CONST_TARGET },
    };
  },
  prepareObjectsForExport() {
    const objects = findAllObjects(this.structures, SLOTS);
    const list = [];
    for (const object of objects) {
      if (object[MEMORY]?.[FIXED]) {
        // replace fixed memory
        const dv = object[MEMORY];
        const address = this.getViewAddress(dv);
        const offset = this.getMemoryOffset(address);
        const len = dv.byteLength;
        const relocDV = this.captureView(address, len, true);
        relocDV.reloc = offset;
        object[MEMORY] = relocDV;
        list.push({ offset, len, owner: object, replaced: false });
      }
    }
    // larger memory blocks come first
    list.sort((a, b) => b.len - a.len);
    for (const a of list) {
      if (!a.replaced) {
        for (const b of list) {
          if (a !== b && !b.replaced) {
            if (a.offset <= b.offset && b.offset < a.offset + a.len) {
              // B is inside A--replace it with a view of A's buffer
              const dv = a.owner[MEMORY];
              const pos = b.offset - a.offset + dv.byteOffset;
              const newDV = this.obtainView(dv.buffer, pos, b.len);
              newDV.reloc = b.offset;
              b.owner[MEMORY] = newDV;
              b.replaced = true;
            }
          }
        }
      }
    }
  },
  useStructures() {
    const module = this.getRootModule();
    // add fixed memory object to list so they can be unlinked
    const objects = findAllObjects(this.structures, SLOTS);
    for (const object of objects) {
      if (object[MEMORY]?.[FIXED]) {
        this.variables.push({ object });
      }
    }
    // clear comptime-only variables
    this.slots = {};
    this.structures = [];
    module.__zigar = this.getSpecialExports();
    return module;
  },
  acquireDefaultPointers() {
    for (const structure of this.structures) {
      const { constructor, hasPointer, instance: { template } } = structure;
      if (hasPointer && template && template[MEMORY]) {
        // create a placeholder for retrieving default pointers
        const placeholder = Object.create(constructor.prototype);
        placeholder[MEMORY] = template[MEMORY];
        placeholder[SLOTS] = template[SLOTS];
        this.updatePointerTargets(placeholder);
      }
    }
  },
  ...(process.env.TARGET === 'wasm' ? {
    exports: {
      captureString: { argType: 'ii', returnType: 'v' },
      captureView: { argType: 'iib', returnType: 'v' },
      castView: { argType: 'iibv', returnType: 'v' },
      readSlot: { argType: 'vi', returnType: 'v' },
      writeSlot: { argType: 'viv' },
      getViewAddress: { argType: 'v', returnType: 'i' },
      beginDefinition: { returnType: 'v' },
      insertInteger: { argType: 'vsi', alias: 'insertProperty' },
      insertBoolean: { argType: 'vsb', alias: 'insertProperty' },
      insertString: { argType: 'vss', alias: 'insertProperty' },
      insertObject: { argType: 'vsv', alias: 'insertProperty' },
      beginStructure: { argType: 'v', returnType: 'v' },
      attachMember: { argType: 'vvb' },
      attachMethod: { argType: 'vvb' },
      createTemplate: { argType: 'v', returnType: 'v' },
      attachTemplate: { argType: 'vvb' },
      defineStructure: { argType: 'v' },
      endStructure: { argType: 'v' },
    },
    imports: {
      getFactoryThunk: { argType: '', returnType: 'i' },
    },

    beginDefinition() {
      return {};
    },
    insertProperty(def, name, value) {
      def[name] = value;
    },
    captureString(address, len) {
      const { buffer } = this.memory;
      const ta = new Uint8Array(buffer, address, len);
      return decodeText(ta);
    },
  } : process.env.TARGET === 'node' ? {
    imports: {
      getFactoryThunk: null,
    },
  } : {}),
});

export function findAllObjects(structures, SLOTS) {
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

function isElectron() {
  return typeof(process) === 'object'
      && typeof(process?.versions) === 'object'
      && !!process.versions?.electron;
}