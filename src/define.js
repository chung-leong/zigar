import { StructureType, MemberType, getPrimitive } from './type.js';
import { obtainGetter, obtainSetter } from './struct.js';
import { obtainArrayGetter, obtainArraySetter, obtainArrayLengthGetter, getArrayIterator } from './array.js';
import { obtainTypedArrayGetter } from './typed-array.js';
import { obtainCopyFunction } from './memory.js';
import { obtainDataView, getDataView } from './data-view.js';
import { throwNoNewEnum } from './error.js';
import { DATA, RELOCATABLE, ENUM_INDEX, ENUM_ITEMS } from './symbol.js';

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
      data: null,
      pointers: null,
    },
    static: {
      members: [],
      data: null,
      pointers: null,
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

export function attachDefaultValues(s, def) {
  const target = (def.isStatic) ? s.static : s.instance;
  if (def.data) {
    target.data = def.data;
  }
  if (def.pointers) {
    target.pointers = def.pointers;
  }
}

export function finalizeStructure(s) {
  try {
    switch (s.type) {
      case StructureType.Primitive: 
        return finalizePrimitive(s);
      case StructureType.Array:
        return finalizeArray(s);
      case StructureType.Struct:
      case StructureType.ExternUnion:
        return finalizeStruct(s);
      case StructureType.TaggedUnion:
        // TODO
        return null;
      case StructureType.Enumeration:
        return finalizeEnumeration(s);
    } 
  } catch (err) {
    console.error(err);
    throw err;
  }
}

function finalizePrimitive(s) {
  const { 
    size,
    instance: {
      members: [ member ],
    },
    options,
  } = s;
  const copy = obtainCopyFunction(size);
  const primitive = getPrimitive(member.type, member.bitSize);
  const get = obtainGetter(member, options);
  const set = obtainSetter(member, options);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv, init;
    if (creating) {
      // new operation--expect matching primitive
      if (arg !== undefined) {
        init = primitive(arg);
      }
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = obtainDataView(arg, size);
    }
    Object.defineProperties(self, {
      [DATA]: { value: dv },
    });
    if (!creating) {
      return self;
    }
  };
  s.copier = function (dest, src) {
    copy(dest[DATA], src[DATA]);
  };
  s.size = size;
  Object.defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
    [Symbol.toPrimitive]: { value: get, configurable: true, writable: true },
  });
  return constructor;
}

function finalizeArray(s) {
  const {
    size,
    instance: {
      members: [ member ],
    },
    options,
  } = s; 
  const copy = obtainCopyFunction(size); 
  const get = obtainArrayGetter(member, options);
  const set = obtainArraySetter(member, options);
  const getLength = obtainArrayLengthGetter(member, options);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv, init;
    if (creating) {
      // new operation--expect an array
      // TODO: validate
      if (arg !== undefined) {
        init = arg;
      }
      self = this;
      dv = new DataView(new ArrayBuffer(size));
    } else {
      self = Object.create(constructor.prototype);
      dv = obtainDataView(arg, size);
    }
    Object.defineProperties(self, {
      [DATA]: { value: dv },
    });
    if (!creating) {
      return self;
    }
  };
  Object.defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
    length: { get: getLength, configurable: true },
    [Symbol.iterator]: { value: getArrayIterator, configurable: true },
  });
  attachDataViewAccessors(s);
  return constructor;
}

function finalizeStruct(s) {
  const { 
    size,
    instance: {
      members,
      data,
      pointers,
    },
    options,
  } = s;
  const copy = obtainCopyFunction(size);
  const descriptors = {};
  for (const member of members) {
    const get = obtainGetter(member, options);
    const set = obtainSetter(member, options);
    descriptors[member.name] = { get, set, configurable: true, enumerable: true };
  }
  const relocatables = {};
  for (const member of members) {
    if (member.type === MemberType.Pointer) {
      const { constructor } = member.structure;
      const buffer = pointers?.[member.slot];
      relocatables[member.slot] = (buffer) ? constructor(buffer) : null;
    } else if (member.type === MemberType.Compound || member.type === MemberType.Enum) {
      relocatables[member.slot] = null;
    }
  }
  const hasRelocatables = Object.keys(relocatables).length > 0;
  const hasCompounds = !!members.find(m => m.type === MemberType.Compound);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv, init;
    if (creating) {
      // new operation--expect an object
      // TODO: validate
      if (arg !== undefined) {
        init = arg;
      }
      self = this;
      dv = new DataView(new ArrayBuffer(size));
      if (data) {
        copy(dv, data);
      }
    } else {
      self = Object.create(constructor.prototype);
      dv = obtainDataView(arg, size);
    }
    Object.defineProperties(self, {
      [DATA]: { value: dv },
    });
    Object.defineProperties(self, descriptors);
    if (hasRelocatables) {
      const relocs = Object.assign({}, relocatables);
      if (hasCompounds) {
        // initialize compound members (array, struct, etc.), storing them 
        // in relocatables even through they aren't actually relocatable
        for (const member of members) {
          if (member.type === MemberType.Compound) {
            const { 
              structure: { constructor },
              bitOffset,
              byteSize,
              slot,
            } = member;
            // "cast" the dataview into the correct type (not using the new operator)
            relocs[slot] = constructor(new DataView(dv.buffer, bitOffset >> 3, byteSize));
          }
        }
      }
      Object.defineProperties(self, {
        [RELOCATABLE]: { value: relocs },
      });  
    } 
    if (!creating) {
      return self;
    }
  };
  s.copier = function(dest, src) {
    copy(dest[DATA], src[DATA]);
    if (hasRelocatables) {
      Object.assign(dest[RELOCATABLE], src[RELOCATABLE]);
    }
  };
  attachDataViewAccessors(s);
  attachStaticMembers(s);
  attachMethods(s);
  return constructor;
};

function finalizeEnumeration(s) {
  const { 
    instance: {
      members,
      data,
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
    [DATA]: { value: data },
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
  // attach the enum items to the constructor and the reloc object
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
  return constructor;
};

export function attachStaticMembers(s) {
  const {
    constructor,
    static: {
      members,
      pointers,
    },
    options,
  } = s;
  const relocs = {};
  const descriptors = {
    [RELOCATABLE]: { value: relocs },
  };
  // static variables are all pointers, with each represented by an object 
  // sittinng a relocatable slot
  for (const member of members) {
    const get = obtainGetter(member, options);
    const set = obtainSetter(member, options);
    descriptors[member.name] = { get, set, configurable: true, enumerable: true };
    const buffer = pointers[member.slot];
    const { constructor } = member.structure;
    relocs[member.slot] = constructor(buffer);
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
      const a = new argStruct;
      for (const [ index, arg ] of args.entries()) {
        if (arg !== undefined) {
          a[index] = arg;
        }
      }
      thunk(a);
      return a.retval;
    }
    Object.defineProperties(f, {
      name: { value: name, writable: false },
    });
    Object.defineProperties(constructor, { 
      [name]: { value: f, configurable: true, writable: true },
    });
    if (!isStaticOnly) {
      const m = function(...args) {
        const a = new argStruct;
        a[0] = this;
        for (const [ index, arg ] of args.entries()) {
          if (arg !== undefined) {
            a[index + 1] = arg;
          }
        }
        thunk(a);
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
