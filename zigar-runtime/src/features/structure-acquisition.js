import {
  CONST_TARGET,
  ENVIRONMENT, MEMORY, SENTINEL, SLOTS, ZIG
} from '../../src/symbols.js';
import {
  ErrorSetFlag, ExportFlag, MemberType, ModuleAttribute, PointerFlag, PrimitiveFlag, SliceFlag,
  structureNames, StructureType
} from '../constants.js';
import { mixin } from '../environment.js';
import { decodeText, findObjects } from '../utils.js';

export default mixin({
  comptime: false,
  slots: {},
  structures: [],
  structureCounters: {
    struct: 0,
    union: 0,
    errorSet: 0,
    enum: 0,
    opaque: 0,
  },
  littleEndian: true,
  runtimeSafety: false,
  libc: false,

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
      flags,
      name,
      length,
      byteSize,
      align,
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
    if (!structure.name) {
      this.inferTypeName(structure);
    }
    this.structures.push(structure);
    this.finalizeStructure(structure);
  },
  captureView(address, len, copy, handle) {
    if (copy) {
      // copy content into JavaScript memory
      const dv = this.allocateJSMemory(len, 0);
      if (len > 0) {
        this.copyExternBytes(dv, address, len);
      }
      return dv;
    } else {
      // link into Zig memory
      const dv = this.obtainZigView(address, len);
      if (process.env.TARGET === 'wasm') {
        dv[ZIG].handle = address;
      } else {
        dv[ZIG].handle = handle;
      }
      return dv;
    }
  },
  castView(address, len, copy, structure, handle) {
    const { constructor, flags } = structure;
    const dv = this.captureView(address, len, copy, handle);
    const object = constructor.call(ENVIRONMENT, dv);
    if (copy && len > 0) {
      this.makeReadOnly?.(object);
    }
    return object;
  },
  acquireStructures(options) {
    const attrs = this.getModuleAttributes();
    this.littleEndian = !!(attrs & ModuleAttribute.LittleEndian);
    this.runtimeSafety = !!(attrs & ModuleAttribute.RuntimeSafety);
    this.libc = !!(attrs & ModuleAttribute.LibC);
    const thunkAddress = this.getFactoryThunk();
    const thunk = { [MEMORY]: this.obtainZigView(thunkAddress, 0) };
    const { littleEndian } = this;
    const FactoryArg = function(options) {
      const {
        omitFunctions = false,
        omitVariables = false,
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
    const args = new FactoryArg(options);
    this.comptime = true;
    this.invokeThunk(thunk, thunk, args);
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
    this.prepareObjectsForExport();
    const { structures, runtimeSafety, littleEndian, libc } = this;
    return {
      structures,
      settings: { runtimeSafety, littleEndian, libc },
      keys: { MEMORY, SLOTS, CONST_TARGET, ZIG },
    };
  },
  prepareObjectsForExport() {
    for (const object of findObjects(this.structures, SLOTS)) {
      const zig = object[MEMORY]?.[ZIG];
      if (zig) {
        // replace Zig memory
        const { address, len, handle } = zig;
        const jsDV = object[MEMORY] = this.captureView(address, len, true);
        if (handle) {
          jsDV.handle = handle;
          if (process.env.MIXIN === 'track') {
            // mixin "features/object-linkage" is used when there are objects linked to Zig memory
            this.useObjectLinkage();
          }
        }
      }
    }
  },
  useStructures() {
    const module = this.getRootModule();
    // add Zig memory object to list so they can be unlinked
    const objects = findObjects(this.structures, SLOTS);
    for (const object of objects) {
      if (object[MEMORY]?.[ZIG]) {
        this.variables.push({ object });
      }
    }
    // clear comptime-only variables
    this.slots = {};
    this.structures = [];
    module.__zigar = this.getSpecialExports();
    return module;
  },
  inferTypeName(s) {
    const handlerName = `get${structureNames[s.type]}Name`;
    const handler = this[handlerName];
    s.name = handler.call(this, s);
  },
  getPrimitiveName(s) {
    const { instance: { members: [ member ] }, static: { template }, flags } = s;
    switch (member.type) {
      case MemberType.Bool:
        return `bool`;
      case MemberType.Int:
        return (flags & PrimitiveFlag.IsSize) ? `isize` : `i${member.bitSize}`;
      case MemberType.Uint:
        return (flags & PrimitiveFlag.IsSize) ? `usize` : `u${member.bitSize}`;
      case MemberType.Float:
        return `f${member.bitSize}`;
      case MemberType.Void:
        return 'void';
      case MemberType.Literal:
        return 'enum_literal';
      case MemberType.Null:
        return 'null';
      case MemberType.Undefined:
        return 'undefined';
      case MemberType.Type:
        return 'type';
      case MemberType.Object:
        return 'comptime';
      default:
        return 'unknown';
    }
  },
  getArrayName(s) {
    const { instance: { members: [ element ] }, length } = s;
    return `[${length}]${element.structure.name}`;
  },
  getStructName(s) {
    return `S${this.structureCounters.struct++}`;
  },
  getUnionName(s) {
    return `U${this.structureCounters.union++}`;
  },
  getErrorUnionName(s) {
    const { instance: { members: [ payload, errorSet ] } } = s;
    return `${errorSet.structure.name}!${payload.structure.name}`;
  },
  getErrorSetName(s) {
    return (s.flags & ErrorSetFlag.IsGlobal) ? 'anyerror' : `ES${this.structureCounters.errorSet++}`;
  },
  getEnumName(s) {
    return `EN${this.structureCounters.enum++}`;
  },
  getOptionalName(s) {
    const { instance: { members: [ payload ] } } = s;
    return `?${payload.structure.name}`;
  },
  getPointerName(s) {
    const { instance: { members: [ target ] }, flags } = s;
    let prefix = '*'
    let targetName = target.structure.name;
    if (target.structure.type === StructureType.Slice) {
      targetName = targetName.slice(3);
    }
    if (flags & PointerFlag.IsMultiple) {
      if (flags & PointerFlag.HasLength) {
        prefix = '[]';
      } else if (flags & PointerFlag.IsSingle) {
        prefix = '[*c]';
      } else {
        prefix = '[*]';
      }
    }
    // constructor can be null when a structure is recursive
    const sentinel = target.structure.constructor?.[SENTINEL];
    if (sentinel) {
      prefix = prefix.slice(0, -1) + `:${sentinel.value}` + prefix.slice(-1);
    }
    if (flags & PointerFlag.IsConst) {
      prefix = `${prefix}const `;
    }
    return prefix + targetName;
  },
  getSliceName(s) {
    const { instance: { members: [ element ] }, flags } = s;
    return (flags & SliceFlag.IsOpaque) ? 'anyopaque' : `[_]${element.structure.name}`;
  },
  getVectorName(s) {
    const { instance: { members: [ element ] }, length } = s;
    return `@Vector(${length}, ${element.structure.name})`;
  },
  getOpaqueName(s) {
    return `O${this.structureCounters.opaque++}`;
  },
  getArgStructName(s) {
    const { instance: { members } } = s;
    const retval = members[0];
    const args = members.slice(1);
    const rvName = retval.structure.name;
    const argNames = args.map(a => a.structure.name);
    return `Arg(fn (${argNames.join(', ')}) ${rvName})`;
  },
  getVariadicStructName(s) {
    const { instance: { members } } = s;
    const retval = members[0];
    const args = members.slice(1);
    const rvName = retval.structure.name;
    const argNames = args.map(a => a.structure.name);
    return `Arg(fn (${argNames.join(', ')}, ...) ${rvName})`;
  },
  getFunctionName(s) {
    const { instance: { members: [ args ] } } = s;
    const argName = args.structure.name;
    return argName.slice(4, -1);
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
      getModuleAttributes: { argType: '', returnType: 'i' },
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
      getModuleAttributes: null,
    },
  /* c8 ignore next */
  } : undefined),
});
