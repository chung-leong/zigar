import { StructureType, MemberType, getPrimitive } from './type.js';
import { obtainGetter, obtainSetter } from './struct.js';
import { obtainArrayGetter, obtainArraySetter, obtainArrayLengthGetter, getArrayIterator } from './array.js';
import { obtainPointerGetter, obtainPointerSetter, obtainPointerArrayGetter, obtainPointerArraySetter, obtainPointerArrayLengthGetter } from './pointer.js';
import { obtainOptionalGetter, obtainOptionalSetter } from './optional.js';
import { obtainErrorUnionGetter, obtainErrorUnionSetter } from './error-union.js';
import { obtainTypedArrayGetter } from './typed-array.js';
import { obtainCopyFunction } from './memory.js';
import { obtainDataView, getDataView, isBuffer } from './data-view.js';
import { throwNoNewEnum, throwNoNewError, decamelizeErrorName } from './error.js';
import { MEMORY, SLOTS, ZIG, SOURCE, ENUM_INDEX, ENUM_ITEMS, ERROR_INDEX } from './symbol.js';

export const globalSlots = {};

function invokeThunk(thunk, args) {
  thunk.call(args, globalSlots, SLOTS, MEMORY, ZIG);
}

export function log(...args) {
  console.log(...args);
}

export function invokeFactory(thunk) {
  // the factory thunk returns a structure object in slot 1
  // or an error string in slot 0
  const args = { [SLOTS]: {} };
  thunk.call(args, globalSlots, SLOTS, MEMORY, ZIG);
  if (args[SLOTS][1]) {
    return args[SLOTS][1].constructor;
  } else if (args[SLOTS][0]) {
    return decamelizeErrorName(args[SLOTS][0]);
  } else {
    return `Factory function returned nothing`;
  }
}

export function getArgumentBuffers(args) {
  const buffers = [];
  const included = new WeakMap();
  const scanned = new WeakMap();
  const scan = (object) => {
    if (scanned.get(object)) {
      return;
    }
    const memory = object[MEMORY];
    if (memory && memory.buffer instanceof ArrayBuffer) {
      if (!included.get(memory.buffer)) {
        buffers.push(memory.buffer);
        included.set(memory.buffer, true);
      }
    }
    scanned.set(object, true);
    const slots = object[SLOTS];
    if (slots) {
      for (const child of Object.values(slots)) {
        scan(child);
      }
    }
  };
  scan(args);
  return buffers;
}

export function beginStructure(def, options = {}) {
  const {
    type,
    name,
    size,
  } = def;
  return {
    constructor: null,
    copier: null,
    type,
    name,
    size,
    instance: {
      members: [],
      template: null,
    },
    static: {
      members: [],
      template: null,
    },
    methods: [],
    options,
  };
}

export function attachMember(s, def) {
  const target = (def.isStatic) ? s.static : s.instance;
  target.members.push(def);
}

export function attachMethod(s, def) {
  s.methods.push(def);
}

export function attachTemplate(s, def) {
  const target = (def.isStatic) ? s.static : s.instance;
  target.template = def.template;
}

export function finalizeStructure(s) {
  try {
    switch (s.type) {
      case StructureType.Primitive:
        return finalizePrimitive(s);
      case StructureType.Array:
      case StructureType.Slice:
        return finalizeArray(s);
      case StructureType.ArgStruct:
      case StructureType.Struct:
      case StructureType.ExternUnion:
        return finalizeStruct(s);
      case StructureType.TaggedUnion:
        // TODO
        return null;
      case StructureType.Optional:
        return finalizeOptional(s);
      case StructureType.ErrorUnion:
        return finalizeErrorUnion(s);
      case StructureType.ErrorSet:
        return finalizeErrorSet(s);
      case StructureType.Enumeration:
        return finalizeEnumeration(s);
      case StructureType.Pointer:
        return finalizePointer(s);
      case StructureType.Slice:
        // TODO
        return null;
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}

function finalizePrimitive(s) {
  const {
    size,
    name,
    instance: {
      members: [ member ],
    },
    options,
  } = s;
  const primitive = getPrimitive(member.type, member.bitSize);
  const get = obtainGetter(member, options);
  const set = obtainSetter(member, options);
  const copy = obtainCopyFunction(size);
  const copier = s.copier = function (dest, src) {
    copy(dest[MEMORY], src[MEMORY]);
  };
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      // new operation--expect matching primitive
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = obtainDataView(arg, name, size);
    }
    Object.defineProperties(self, {
      [MEMORY]: { value: dv },
    });
    if (creating) {
      if (primitive !== undefined) {
        if (arg !== undefined) {
          this.set(primitive(arg));
        }
      }
    } else {
      return self;
    }
  };
  Object.defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
    [Symbol.toPrimitive]: { value: get, configurable: true, writable: true },
  });
  attachName(s);
  return constructor;
}

function finalizeArray(s) {
  const {
    type,
    size,
    name,
    instance: {
      members: [ member ],
    },
    options,
  } = s;
  const copy = obtainCopyFunction(size);
  const get = obtainArrayGetter(member, options);
  const set = obtainArraySetter(member, options);
  const getLength = obtainArrayLengthGetter(member, options);
  const getPointer = obtainPointerArrayGetter(member, options);
  const setPointer = obtainPointerArraySetter(member, options);
  const getPointerLength = obtainPointerArrayLengthGetter(member, options);
  const objectMember = (member.type === MemberType.Object) ? member : null;
  const isSlice = type == StructureType.Slice;
  const copier = s.copier = function(dest, src) {
    copy(dest[MEMORY], src[MEMORY]);
    if (objectMember) {
      Object.assign(dest[SLOTS], src[SLOTS]);
    }
  };
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = obtainDataView(arg, name, size, isSlice);
    }
    Object.defineProperties(self, {
      [MEMORY]: { value: dv },
    });
    if (objectMember) {
      const slots = {};
      const { structure: { constructor }, byteSize } = objectMember;
      const recv = (this === ZIG) ? this : null;
      for (let slot = 0, offset = 0, len = dv.byteLength; offset < len; slot++, offset += byteSize) {
        const childDV = new DataView(dv.buffer, offset, byteSize);
        slots[slot] = constructor.call(recv, childDV);
      }
      Object.defineProperties(self, {
        [SLOTS]: { value: slots },
      });
    }
    if (creating) {
      // expect an array
      // TODO: validate and set memory
    } else {
      return self;
    }
  };
  Object.defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
    length: { get: getLength, configurable: true },
    [Symbol.iterator]: { value: getArrayIterator, configurable: true },
  });
  if (getPointer) {
    const ptrSourceProto = Object.defineProperties({}, {
      get: { value: getPointer, configurable: true, writable: true },
      set: { value: setPointer, configurable: true, writable: true },
      length: { get: getPointerLength, configurable: true },
      [Symbol.iterator]: { value: getArrayIterator, configurable: true },
    });
    const get = function() {
      const ptrSource = Object.create(ptrSourceProto);
      ptrSource[SOURCE] = this;
      return ptrSource;
    };
    Object.defineProperties(constructor.prototype, {
      '&': { get, configurable: true, enumerable: true, writable: false }
    });
  }
  attachDataViewAccessors(s);
  attachName(s);
  return constructor;
}

function finalizeStruct(s) {
  const {
    type,
    size,
    name,
    instance: {
      members,
      template,
    },
    options,
  } = s;
  const isArgStruct = (type === StructureType.ArgStruct);
  const copy = obtainCopyFunction(size);
  const descriptors = {};
  for (const member of members) {
    const isArgument = isArgStruct && !isNaN(parseInt(member.name));
    const get = obtainGetter(member, { autoDeref: !isArgument, ...options });
    const set = obtainSetter(member, { autoDeref: !isArgument, ...options });
    descriptors[member.name] = { get, set, configurable: true, enumerable: true };
  }
  // pointer
  const ptrDescriptors = {};
  if (!isArgStruct) {
    for (const member of members) {
      const get = obtainPointerGetter(member, options);
      const set = obtainPointerSetter(member, options);
      if (get) {
        ptrDescriptors[member.name] = { get, set, configurable: true, enumerable: true };
      }
    }
  }
  const objectMembers = members.filter(m => m.type === MemberType.Object);
  const copier = s.copier = function(dest, src) {
    copy(dest[MEMORY], src[MEMORY]);
    if (objectMembers.length > 0) {
      Object.assign(dest[SLOTS], src[SLOTS]);
    }
  };
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      // new operation--expect an object
      // TODO: validate argument
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = obtainDataView(arg, name, size);
    }
    Object.defineProperties(self, {
      [MEMORY]: { value: dv },
    });
    Object.defineProperties(self, descriptors);
    if (objectMembers.length > 0) {
      // create child objects
      const recv = (this === ZIG) ? this : null;
      const slots = {};
      for (const { structure: { constructor }, bitOffset, byteSize, slot } of objectMembers) {
        const offset = bitOffset >> 3;
        const childDV = new DataView(dv.buffer, offset, byteSize);
        slots[slot] = constructor.call(recv, childDV);
      }
      Object.defineProperties(self, {
        [SLOTS]: { value: slots },
      });
    }
    if (creating) {
      if (template) {
        copier(this, template);
      }
      if (arg) {
        for (const [ key, value ] of Object.entries(arg)) {
          this[key] = value;
        }
      }
    } else {
      return self;
    }
  };
  if (Object.keys(ptrDescriptors).length > 0) {
    const ptrSourceProto = Object.defineProperties({}, ptrDescriptors);
    const get = function() {
      const ptrSource = Object.create(ptrSourceProto);
      ptrSource[SOURCE] = this;
      return ptrSource;
    };
    Object.defineProperties(constructor.prototype, {
      '&': { get, configurable: true, enumerable: true },
    });
  }
  attachDataViewAccessors(s);
  attachStaticMembers(s);
  attachMethods(s);
  attachName(s);
  return constructor;
};

function finalizeOptional(s) {
  const {
    name,
    size,
    instance: {
      members,
    },
    options,
  } = s;
  const get = obtainOptionalGetter(members, options);
  const set = obtainOptionalSetter(members, options);
  const copy = obtainCopyFunction(size);
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const copier = s.copier = function (dest, src) {
    copy(dest[MEMORY], src[MEMORY]);
    if (hasObject) {
      dest[SLOTS] = { ...src[SLOTS] };
    }
  };
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      // new operation
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = obtainDataView(arg, name, size);
    }
    Object.defineProperties(self, {
      [MEMORY]: { value: dv },
    });
    if (creating) {
      this.set(arg);
    } else {
      return self;
    }
  };
  Object.defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
  });
  attachName(s);
  return constructor;
}

function finalizeErrorUnion(s) {
  const {
    name,
    size,
    instance: {
      members,
    },
    options,
  } = s;
  const get = obtainErrorUnionGetter(members, options);
  const set = obtainErrorUnionSetter(members, options);
  const copy = obtainCopyFunction(size);
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const copier = s.copier = function (dest, src) {
    copy(dest[MEMORY], src[MEMORY]);
    if (hasObject) {
      dest[SLOTS] = { ...src[SLOTS] };
    }
  };
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      // new operation
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = obtainDataView(arg, name, size);
    }
    Object.defineProperties(self, {
      [MEMORY]: { value: dv },
    });
    if (creating) {
      this.set(arg);
    } else {
      return self;
    }
  };
  Object.defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
  });
  attachName(s);
  return constructor;
}

function finalizeErrorSet(s) {
  const {
    name,
    instance: {
      members,
    },
  } = s;
  const errors = {};
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    if (creating) {
      throwNoNewError();
    }
    const index = Number(arg);
    return errors[index];
  };
  Object.setPrototypeOf(constructor.prototype, Error.prototype);
  const valueOf = function() { return this[ERROR_INDEX] };
  const toStringTag = function() { return 'Error' };
  Object.defineProperties(constructor.prototype, {
    // provide a way to retrieve the error index
    [Symbol.toPrimitive]: { value: valueOf, configurable: true, writable: true },
    // ensure that libraries that rely on the string tag for type detection will
    // correctly identify the object as an error
    [Symbol.toStringTag]: { get: toStringTag, configurable: true },
  });
  // attach the errors to the constructor and the
  for (const [ index, { name, slot } ] of members.entries()) {
    // can't use the constructor since it would throw
    const error = Object.create(constructor.prototype);
    const message = decamelizeErrorName(name);
    Object.defineProperties(error, {
      message: { value: message, configurable: true, enumerable: true, writable: false },
      [ERROR_INDEX]: { value: slot },
    });
    Object.defineProperties(constructor, {
      [name]: { value: error, configurable: true, enumerable: true, writable: true },
    });
    errors[slot] = error;
  }
  attachName(s);
  return constructor;
};

function finalizeEnumeration(s) {
  const {
    name,
    instance: {
      members,
      template,
    },
    options,
  } = s;
  const primitive = getPrimitive(members[0].type, members[0].bitSize);
  const getValue = obtainArrayGetter(members[0], options);
  const count = members.length;
  const items = {};
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    if (creating) {
      // the "constructor" is only used to convert a number into an enum object
      // new enum items cannot be created
      throwNoNewEnum();
    }
    let index = -1;
    if (isSequential) {
      // normal enums start at 0 and go up, so the value is the index
      index = Number(arg);
    } else {
      // it's not sequential, so we need to compare values
      // casting just in case the enum is BigInt
      const v = primitive(arg);
      for (let i = 0; i < count; i++) {
        const value = getValue.call(constructor, i);
        if (value === v) {
          index = i;
          break;
        }
      }
    }
    // return the enum object (created down below)
    return items[index];
  };
  // attach the numeric values to the class as its binary data
  // this allows us to reuse the array getter
  Object.defineProperties(constructor, {
    [MEMORY]: { value: template[MEMORY] },
    [ENUM_ITEMS]: { value: items },
  });
  const valueOf = function() {
    const index = this[ENUM_INDEX] ;
    return getValue.call(constructor, index);
  };
  Object.defineProperties(constructor.prototype, {
    [Symbol.toPrimitive]: { value: valueOf, configurable: true, writable: true },
    // so we don't get an empty object when JSON.stringify() is used
    toJSON: { value: valueOf, configurable: true, writable: true },
  });
  // now that the class has the right hidden properties, getValue() will work
  // scan the array to see if the enum's numeric representation is sequential
  const isSequential = (() => {
    // try-block in the event that the enum has bigInt items
    try {
      for (let i = 0; i < count; i++) {
        if (get.call(constructor, i) !== i) {
          return false;
        }
      }
      return true;
    } catch (err) {
      return false;
    }
  })();
  // attach the enum items to the constructor
  for (const [ index, { name } ] of members.entries()) {
    // can't use the constructor since it would throw
    const item = Object.create(constructor.prototype);
    Object.defineProperties(item, {
      [ENUM_INDEX]: { value: index },
    });
    Object.defineProperties(constructor, {
      [name]: { value: item, configurable: true, enumerable: true, writable: true },
    });
    items[index] = item;
  }
  attachStaticMembers(s);
  attachMethods(s);
  attachName(s);
  return constructor;
};

export function finalizePointer(s) {
  const {
    size,
    name,
    instance: {
      members: [ member ],
    },
    options,
  } = s;
  const get = obtainGetter(member, options);
  const set = obtainSetter(member, options);
  const copy = obtainCopyFunction(size);
  const copier = s.copier = function (dest, src) {
    copy(dest[MEMORY], src[MEMORY]);
    Object.assign(dest[SLOTS], src[SLOTS]);
  };
  const { structure: target } = member;
  const isSlice = target.type === StructureType.Slice;
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    const slots = { 0: null };
    if (creating) {
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = obtainDataView(arg, name, size);
    }
    Object.defineProperties(self, {
      [MEMORY]: { value: dv },
      [SLOTS]: { value: slots },
      // a boolean value indicating whether Zig currently owns the pointer
      [ZIG]: { value: this === ZIG, writable: true },
    });
    if (creating) {
      const { constructor } = target;
      if (!(arg instanceof constructor)) {
        const recv = (this === ZIG) ? this : null;
        arg = isBuffer(arg) ? constructor.call(recv, arg) : new constructor(arg);
      }
      slots[0] = arg;
    } else {
      return self;
    }
  };
  Object.defineProperties(constructor.prototype, {
    '*': { get, set, configurable: true, enumerable: true },
  });
  attachName(s);
  return constructor;
}

export function attachStaticMembers(s) {
  const {
    constructor,
    static: {
      members,
      template,
    },
    options,
  } = s;
  const descriptors = {
    [SLOTS]: { value: template?.[SLOTS] },
  };
  for (const member of members) {
    const get = obtainGetter(member, options);
    const set = obtainSetter(member, options);
    descriptors[member.name] = { get, set, configurable: true, enumerable: true };
  };
  Object.defineProperties(constructor, descriptors);
}

export function attachMethods(s) {
  const {
    constructor,
    methods,
  } = s;
  for (const method of methods) {
    const {
      name,
      argStruct,
      thunk,
      isStaticOnly,
    } = method;
    const f = function(...args) {
      const { constructor } = argStruct;
      const a = new constructor();
      for (const [ index, arg ] of args.entries()) {
        if (arg !== undefined) {
          a[index] = arg;
        }
      }
      invokeThunk(thunk, a);
      return a.retval;
    }
    Object.defineProperties(f, {
      name: { value: name, writable: false },
    });
    Object.defineProperties(constructor, {
      [name]: { value: f, configurable: true, enumerable: true, writable: true },
    });
    if (!isStaticOnly) {
      const m = function(...args) {
        const { constructor } = argStruct;
        const a = new constructor();
        a[0] = this;
        for (const [ index, arg ] of args.entries()) {
          if (arg !== undefined) {
            a[index + 1] = arg;
          }
        }
        invokeThunk(thunk, a);
        return a.retval;
      }
      Object.defineProperties(m, {
        name: { value: name, writable: false },
      });
      Object.defineProperties(constructor.prototype, {
        [name]: { value: m, configurable: true, writable: true },
      });
    }
  }
}

function attachName(s) {
  const {
    name,
    constructor,
  } = s;
  if (name) {
    Object.defineProperties(constructor, {
      name: { value: name, writable: false },
    });
  }
}

function attachDataViewAccessors(s) {
  const {
    constructor: {
      prototype,
    },
    instance: {
      members
    },
  } = s;
  if (!Object.getOwnPropertyDescriptor(prototype, 'dataView')) {
    Object.defineProperties(prototype, {
      dataView: { get: getDataView, configurable: true, enumerable: true },
    });
  }
  const getTypedArray = obtainTypedArrayGetter(members);
  if (getTypedArray && !Object.getOwnPropertyDescriptor(prototype, 'typedArray')) {
    Object.defineProperties(prototype, {
      typedArray: { get: getTypedArray, configurable: true, enumerable: true },
    });
  }
}
