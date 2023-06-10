import { StructureType, MemberType, getPrimitive } from './types.js';
import { obtainGetter, obtainSetter } from './struct.js';
import { obtainArrayGetter, obtainArraySetter, obtainArrayLengthGetter, getArrayIterator } from './array.js';
import { obtainTypedArrayGetter } from './typed-array.js';
import { obtainCopyFunction } from './memory.js';
import { obtainDataView, getDataView } from './data-view.js';
import { throwNoNewEnum } from './errors.js';
import { DATA, RELOCATABLE, ENUM_INDEX } from './symbols.js';

export function defineStructure(def, options = {}) {
  var struct;
  switch (def.type) {
    case StructureType.Primitive: 
      return definePrimitive(def, options);
    case StructureType.Array:
      return defineArray(def, options);
    case StructureType.Struct:
    case StructureType.ExternUnion:
      return defineStruct(def, options);
    case StructureType.TaggedUnion:
      return null; // TODO
    case StructureType.Enumeration:
      return defineEnumeration(def, options);
  }
}

function definePrimitive(def, options) {
  const {
    size,
    members: [ member ],
    defaultData,
  } = def; 
  const copy = obtainCopyFunction(size);
  const primitive = getPrimitive(member.type, member.bits);
  const get = obtainGetter(member, options);
  const set = obtainSetter(member, options);
  const constructor = function(arg) {
    var self, dv, init;
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
  Object.defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
    [Symbol.toPrimitive]: { value: get, configurable: true, writable: true },
  });
  return constructor;
}

function defineArray(def, options) {
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
  const constructor = function(arg) {
    var self, dv, init;
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
  Object.defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
    length: { get: getLength, configurable: true },
    [Symbol.iterator]: { value: getArrayIterator, configurable: true },
  });
  if (exposeDataView) {
    attachDataViewAccessors(constructor, [ member ]);
  }
  return constructor;
}

function defineStruct(def, options = {}) {
  const { 
    size,
    members,
    staticMembers,
    defaultData,
    defaultPointers,
    staticPointers,
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
  const internalPointers = (compoundMembers.length > 0) && compoundMembers.map(({ struct, bitOffset, bits, slot }) => {
    return { struct, slot, offset: bitOffset >> 3, size: bits >> 3 };
  });
  const constructor = function(arg) {
    var self, dv, init;
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
      const relocs = {};
      if (defaultPointers) {
        for (const [ slot, value ] of Object.entries(defaultPointers)) {
          relocs[slot] = value;
        }
      }
      if (internalPointers) {
        // initialize compound members (array, struct, etc.), storing them 
        // in relocatables even through they aren't actually relocatable
        const buffer = dv.buffer;
        for (const { struct, slot, offset, size } of internalPointers) {
          const mdv = new DataView(buffer, offset, size);
          const obj = new struct(mdv);
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
  if (exposeDataView) {
    attachDataViewAccessors(constructor, members);
  }
  return constructor;
};

function defineEnumeration(def, options = {}) {
  const { 
    members,
    defaultData,
  } = def;
  const [ member ] = members;
  const primitive = getPrimitive(member.type, member.bits);
  const getValue = obtainArrayGetter(member, options);
  const count = members.length;
  const relocs = {};
  const constructor = function(arg) {
    if (this) {
      // the "constructor" is only used to convert a number into an enum object
      // new enum items cannot be created
      throwNoNewEnum();    
    }
    var index = -1;
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
    return relocs[index];
  };
  // attach the numeric values to the class as its binary data
  // this allows us to reuse the array getter
  Object.defineProperties(constructor, {
    [DATA]: { value: defaultData },
    [RELOCATABLE]: { value: relocs },
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
    relocs[index] = item;
  }
  return constructor;
};

function attachDataViewAccessors(constructor, members) {
  const { prototype } = constructor;
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

export function attachFunction(constructor, def) {
  const {
    name,
    argStruct,   
    thunk,
    isMethod,
  } = def;
  const f = function(...args) {
    const a = new argStruct;
    for (const [ index, arg ] of args.entries()) {
      if (arg !== undefined) {
        a[index] = arg;
      }
    }
    thunk(a);
    return argStruct.return_value;
  }
  Object.defineProperties(f, {
    name: { value: name, writable: false },
  });
  Object.defineProperties(constructor, { 
    [name]: { value: f, configurable: true, writable: true },
  });
  if (def.isMethod) {
    attachMethod(constructor, def);
  }
}

function attachMethod(constructor, def) {
  const {
    name,
    argStruct,   
    thunk,
  } = def;
  const f = function(...args) {
    const a = new argStruct;
    a[0] = this;
    for (const [ index, arg ] of args.entries()) {
      if (arg !== undefined) {
        debugger;
        a[index + 1] = arg;
      }
    }
    thunk(a);
    return a.return_value;
  }
  Object.defineProperties(f, {
    name: { value: name, writable: false }, 
  });
  Object.defineProperties(constructor.prototype, {
    [name]: { value: f, configurable: true, writable: true },
  });
}
