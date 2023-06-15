import { StructureType, MemberType, getPrimitive } from './type.js';
import { obtainGetter, obtainSetter } from './struct.js';
import { obtainArrayGetter, obtainArraySetter, obtainArrayLengthGetter, getArrayIterator } from './array.js';
import { obtainTypedArrayGetter } from './typed-array.js';
import { obtainCopyFunction } from './memory.js';
import { obtainDataView, getDataView } from './data-view.js';
import { throwNoNewEnum } from './error.js';
import { DATA, RELOCATABLE, ENUM_INDEX, ENUM_ITEMS } from './symbol.js';

export function createStructure(type, name) {
  return { type, name, constructor: null, copier: null };
}

export function shapeStructure(s, def, options = {}) {
  switch (s.type) {
    case StructureType.Primitive: 
      return shapePrimitive(s, def, options);
    case StructureType.Array:
      return shapeArray(s, def, options);
    case StructureType.Struct:
    case StructureType.ExternUnion:
      return shapeStruct(s, def, options);
    case StructureType.TaggedUnion:
      return null; // TODO
    case StructureType.Enumeration:
      return shapeEnumeration(s, def, options);
  }
}

function shapePrimitive(s, def, options) {
  const { 
    size,
    members: [ member ],
    defaultData,
  } = def;
  const copy = obtainCopyFunction(size);
  const primitive = getPrimitive(member.type, member.bitSize);
  const get = obtainGetter(member, options);
  const set = obtainSetter(member, options);
  const constructor = s.constructor = function(arg) {
    let self, dv, init;
    if (this) {
      // new operation--expect matching primitive
      if (arg !== undefined) {
        init = primitive(arg);
      }
      self = this;
      dv = new DataView(new ArrayBuffer(size));
      if (defaultData && init === undefined) {
        copy(dv, defaultData);
      }
    } else {
      self = Object.create(constructor.prototype);
      dv = obtainDataView(arg, size);
    }
    Object.defineProperties(self, {
      [DATA]: { value: dv },
    });
    if (!this) {
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

function shapeArray(s, def, options) {
  const {
    size,
    members: [ member ],
    defaultData,
    exposeDataView = false,
  } = def; 
  const copy = obtainCopyFunction(size); 
  const get = obtainArrayGetter(member, options);
  const set = obtainArraySetter(member, options);
  const getLength = obtainArrayLengthGetter(member, options);
  const constructor = s.constructor = function(arg) {
    let self, dv, init;
    if (this) {
      // new operation--expect an array
      // TODO: validate
      if (arg !== undefined) {
        init = arg;
      }
      self = this;
      dv = new DataView(new ArrayBuffer(size));
      if (defaultData && init === undefined) {
        copy(dv, defaultData);
      }
    } else {
      self = Object.create(constructor.prototype);
      dv = obtainDataView(arg, size);
    }
    Object.defineProperties(self, {
      [DATA]: { value: dv },
    });
    if (!this) {
      return self;
    }
  };
  s.size = size;
  Object.defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
    length: { get: getLength, configurable: true },
    [Symbol.iterator]: { value: getArrayIterator, configurable: true },
  });
  if (exposeDataView) {
    attachDataViewAccessors(s, [ member ]);
  }
  return constructor;
}

function shapeStruct(s, def, options) {
  const { 
    size,
    members,
    defaultData,
    defaultPointers,
    exposeDataView = false,
  } = def;
  const copy = obtainCopyFunction(size);
  const descriptors = {};
  for (const member of members) {
    const get = obtainGetter(member, options);
    const set = obtainSetter(member, options);
    descriptors[member.name] = { get, set, configurable: true, enumerable: true };
  }
  const hasRelocatable = !!members.find(m => m.type === MemberType.Compound || m.type === MemberType.Pointer);
  const compoundMembers = members.filter(m => m.type === MemberType.Compound);
  const internalPointers = (compoundMembers.length > 0) && compoundMembers.map(({ structure, bitOffset, align, slot }) => {
    return { 
      constructor: structure.constructor, 
      slot, 
      offset: bitOffset >> 3, 
      align,
    };
  });
  const constructor = s.constructor = function(arg) {
    let self, dv, init;
    if (this) {
      // new operation--expect an object
      // TODO: validate
      if (arg !== undefined) {
        init = arg;
      }
      self = this;
      dv = new DataView(new ArrayBuffer(size));
      if (defaultData && init === undefined) {
        copy(dv, defaultData);
      }
    } else {
      self = Object.create(constructor.prototype);
      dv = obtainDataView(arg, size);
    }
    Object.defineProperties(self, {
      [DATA]: { value: dv },
    });
    Object.defineProperties(self, descriptors);
    if (hasRelocatable) {
      const relocs = Object.assign({}, defaultPointers);
      if (internalPointers) {
        // initialize compound members (array, struct, etc.), storing them 
        // in relocatables even through they aren't actually relocatable
        for (const { constructor, slot, offset, align } of internalPointers) {
          const mdv = new DataView(dv.buffer, offset, align);
          const obj = new constructor(mdv);
          relocs[slot] = obj;
        }
      }
      Object.defineProperties(self, {
        [RELOCATABLE]: { value: relocs },
      });  
    } 
    if (!this) {
      return self;
    }
  };
  s.copier = function(dest, src) {
    copy(dest[DATA], src[DATA]);
    if (hasRelocatable) {
      Object.assign(dest[RELOCATABLE], src[RELOCATABLE]);
    }
  };
  s.size = size;
  if (exposeDataView) {
    attachDataViewAccessors(s, members);
  }
  return constructor;
};

function shapeEnumeration(s, def, options) {
  const { 
    size,
    members,
    defaultData,
  } = def;
  const primitive = getPrimitive(members[0].type, members[0].bitSize);
  const getValue = obtainArrayGetter(members[0], options);
  const count = members.length;
  const items = {};
  const constructor = s.constructor = function(arg) {
    if (this) {
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
  s.size = size;
  // attach the numeric values to the class as its binary data
  // this allows us to reuse the array getter
  Object.defineProperties(constructor, {
    [DATA]: { value: defaultData },
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
  return constructor;
};

function attachDataViewAccessors(s, members) {
  const { prototype } = s.constructor;
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

export function attachVariables(s, def, options = {}) {
  const { constructor } = s;
  const {
    members,
    defaultPointers,
  } = def;
  const descriptors = {};
  // static variables are all pointers
  for (const member of members) {
    const get = obtainGetter(member, options);
    const set = obtainSetter(member, options);
    descriptors[member.name] = { get, set, configurable: true, enumerable: true };
  };
  const relocs = Object.assign({}, defaultPointers);
  descriptors[RELOCATABLE] = { value: relocs };
  Object.defineProperties(constructor, descriptors);
}

export function attachMethods(s, def, options = {}) {
  const { constructor } = s;
  const {
    methods,
  } = def;
  for (const method of methods) {
    const {
      name,
      argStruct,   
      thunk,
      staticOnly,
    } = method;
    const f = function(...args) {
      const a = new argStruct;
      for (const [ index, arg ] of args.entries()) {
        if (arg !== undefined) {
          a[index] = arg;
        }
      }
      thunk(a);
      return a.return_value;
    }
    Object.defineProperties(f, {
      name: { value: name, writable: false },
    });
    Object.defineProperties(constructor, { 
      [name]: { value: f, configurable: true, writable: true },
    });
    if (!staticOnly) {
      const m = function(...args) {
        const a = new argStruct;
        a[0] = this;
        for (const [ index, arg ] of args.entries()) {
          if (arg !== undefined) {
            a[index + 1] = arg;
          }
        }
        thunk(a);
        return a.return_value;
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
