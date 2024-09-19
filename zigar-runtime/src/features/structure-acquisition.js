import { CONST_TARGET, COPY, ENVIRONMENT, FIXED, MEMORY, SLOTS } from '../../src/symbols.js';
import { ExportFlag, StructureFlag, StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { decodeText, defineProperty, findObjects } from '../utils.js';

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
      flags,
    } = def;
    return {
      constructor: null,
      type,
      name,
      length,
      byteSize,
      align,
      flags,
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
  captureView(address, len, copy) {
    if (copy) {
      // copy content into reloctable memory
      const dv = this.allocateRelocMemory(len, 0);
      if (len > 0) {
        this.copyExternBytes(dv, address, len);
      }
      return dv;
    } else {
      // link into fixed memory
      return this.obtainFixedView(address, len);
    }
  },
  castView(address, len, copy, structure) {
    const { constructor, flags } = structure;
    const dv = this.captureView(address, len, copy);
    const object = constructor.call(ENVIRONMENT, dv);
    if (flags & StructureFlag.HasPointer) {
      // acquire targets of pointers
      this.updatePointerTargets(object);
    }
    if (copy && len > 0) {
      this.makeReadOnly?.(object);
    }
    return object;
  },
  acquireDefaultPointers() {
    for (const structure of this.structures) {
      const { constructor, flags, instance: { template } } = structure;
      if (flags & StructureFlag.HasPointer && template && template[MEMORY]) {
        // create a placeholder for retrieving default pointers
        const placeholder = Object.create(constructor.prototype);
        placeholder[MEMORY] = template[MEMORY];
        placeholder[SLOTS] = template[SLOTS];
        this.updatePointerTargets(placeholder);
      }
    }
  },
  acquireStructures(options) {
    this.resetGlobalErrorSet?.();
    const thunkAddress = this.getFactoryThunk();
    const { littleEndian } = this;
    const FactoryArg = function(options) {
      const {
        omitFunctions = false,
        omitVariables = isElectron(),
      } = options;
      const dv = new DataView(new ArrayBuffer(4));
      let flags = 0;
      if (omitFunctions) {
        flags |= ExportFlag.OmitMethods;
      }
      if (omitVariables) {
        flags |= ExportFlag.OmitVariables;
      }
      dv.setUint32(0, flags, littleEndian);
      this[MEMORY] = dv;
    };
    defineProperty(FactoryArg.prototype, COPY, this.defineCopier(4));
    const args = new FactoryArg(options);
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
    const objects = findObjects(this.structures, SLOTS);
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
    if (process.env.MIXIN === 'track') {
      if (list.length > 0) {
        // mixin "features/object-linkage" is used when there are objects linked to fixed memory
        this.useObjectLinkage();
      }
    }
  },
  useStructures() {
    const module = this.getRootModule();
    // add fixed memory object to list so they can be unlinked
    const objects = findObjects(this.structures, SLOTS);
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
  ...(process.env.TARGET === 'wasm' ? {
    exports: {
      captureString: { argType: 'ii', returnType: 'v' },
      captureView: { argType: 'iib', returnType: 'v' },
      castView: { argType: 'iibv', returnType: 'v' },
      readSlot: { argType: 'vi', returnType: 'v' },
      writeSlot: { argType: 'viv' },
      beginDefinition: { returnType: 'v' },
      insertInteger: { argType: 'vsi', alias: 'insertProperty' },
      insertBoolean: { argType: 'vsb', alias: 'insertProperty' },
      insertString: { argType: 'vss', alias: 'insertProperty' },
      insertObject: { argType: 'vsv', alias: 'insertProperty' },
      beginStructure: { argType: 'v', returnType: 'v' },
      attachMember: { argType: 'vvb' },
      createTemplate: { argType: 'v', returnType: 'v' },
      attachTemplate: { argType: 'vvb' },
      defineStructure: { argType: 'v', returnType: 'v' },
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
    getMemoryOffset(address) {
      // WASM address space starts at 0
      return address;
    },
  } : process.env.TARGET === 'node' ? {
    exports: {
      captureView: null,
      castView: null,
      readSlot: null,
      writeSlot: null,
      beginStructure: null,
      attachMember: null,
      createTemplate: null,
      attachTemplate: null,
      defineStructure: null,
      endStructure: null,
    },
    imports: {
      getFactoryThunk: null,
      getMemoryOffset: null,
    },
  } : {}),
});

function isElectron() {
  return typeof(process) === 'object'
      && typeof(process?.versions) === 'object'
      && !!process.versions?.electron;
}