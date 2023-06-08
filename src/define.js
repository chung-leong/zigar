import { StructureType, MemberType, getPrimitive } from './types.js';
import { obtainGetter, obtainSetter } from './struct.js';
import { obtainArrayGetter, obtainArraySetter, obtainArrayLengthGetter, getArrayIterator } from './array.js';
import { obtainTypedArrayGetter } from './typed-array.js';
import { obtainCopyFunction } from './memory.js';
import { obtainDataView, getDataView } from './data-view.js';
import { throwNoNewEnum, throwInvalidEnum } from './errors.js';
import { DATA, RELOCATABLE } from './symbols.js';

export function defineStructure(def, options = {}) {
  var struct;
  switch (def.type) {
    case StructureType.Primitive: 
      return definePrimitive(def, options);
    case StructureType.Array:
      return defineArray(def, options);
    case StructureType.Struct:
      return defineStruct(def, options);
    case StructureType.Union:      
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
  const prototype = {};
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
      self = Object.create(prototype);
      dv = obtainDataView(arg, size);
    }
    Object.defineProperties(self, {
      [DATA]: { value: dv },
    });
    if (!this) {
      return self;
    }
  };
  Object.defineProperties(constructor, {
    prototype: { value: prototype },
  });
  Object.defineProperties(prototype, {
    constructor: { value: constructor, configurable: true, writable: true },
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
  const prototype = {};
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
      self = Object.create(prototype);
      dv = obtainDataView(arg, size);
    }
    Object.defineProperties(self, {
      [DATA]: { value: dv },
    });
    if (!this) {
      return self;
    }
  };
  Object.defineProperties(constructor, {
    prototype: { value: prototype },
  });
  Object.defineProperties(prototype, {
    constructor: { value: constructor, configurable: true, writable: true },
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
  const prototype = {};
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
      self = Object.create(prototype);
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
  Object.defineProperties(constructor, {
    prototype: { value: prototype },
  });
  Object.defineProperties(prototype, {
    constructor: { value: constructor, configurable: true, writable: true },
  });
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
  const prototype = {};
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
    if (index < 0 || index >= count) {
      throwInvalidEnum(arg);
    }
    // return the enum object (created down below)
    return relocs[index];
  };
  // attach the numeric values to the class as its binary data
  // this allows us to reuse the array getter
  Object.defineProperties(constructor, {
    prototype: { value: prototype },
    [DATA]: { value: defaultData },
    [RELOCATABLE]: { value: relocs },
  });
  // this relies on us adding the setter for the property "value" (down below)
  const valueOf = function() { return this.value };
  Object.defineProperties(prototype, {
    constructor: { value: constructor, configurable: true, writable: true },
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
    const item = Object.create(prototype);
    Object.defineProperties(item, {
      name: { value: name },
      value: { value: getValue.call(constructor, index) },
    });
    constructor[name] = relocs[index] = item;
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
