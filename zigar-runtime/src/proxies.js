import { PointerFlag, ProxyType, StructureFlag, StructureType } from './constants.js';
import { throwReadOnly } from './errors.js';
import { PROXY_TYPE, READ_ONLY, TARGET } from './symbols.js';

const proxyMaps = [ 
  0, 
  ProxyType.Const, 
  ProxyType.ReadOnly, 
  ProxyType.Const | ProxyType.ReadOnly 
].reduce((hash, type) => {
  hash[type] = new WeakMap();
  return hash;
}, {});
const proxyTargetMap = new WeakMap();

export function getProxy(target, type) {
  const key = target;
  const map = proxyMaps[type & (ProxyType.Const | ProxyType.ReadOnly)];
  let proxy = map.get(key);
  if (!proxy) {
    proxy = new Proxy(target, handlersHash[type]);
    map.set(key, proxy);
    proxyTargetMap.set(proxy, { target, type });
  }
  return proxy;
}

export function getProxyType(structure, readOnly = false) {
  const { type, flags } = structure;
  let proxyType = (readOnly) ? ProxyType.ReadOnly : 0;
  if (flags & StructureFlag.HasProxy) {
    if (type === StructureType.Pointer) {
      proxyType |= ProxyType.Pointer;
      if (flags & PointerFlag.IsConst) {
        proxyType |= ProxyType.Const;
      }
    } else if (type === StructureType.Function) {
      // functions don't mean to be made read-only
      proxyType = 0;
    } else {
      proxyType |= ProxyType.Slice;
    }
  }
  return proxyType;
}

export function getProxyTarget(arg) {
  if ((typeof(arg) === 'object' || typeof(arg) === 'function') && arg) {
    return proxyTargetMap.get(arg);
  }
}

export function removeProxy(arg) {
  const proxy = getProxyTarget(arg);
  return (proxy) ? [ proxy.target, proxy.type ] : [ arg, 0 ];
}

export function getReadOnlyProxy(object) {
  const proxy = getProxyTarget(object);
  let proxyType;
  if (proxy) {
    if (proxy.type & ProxyType.ReadOnly) {
      // it's already a read-only proxy
      return object;
    } else {
      proxyType = proxy.type | ProxyType.ReadOnly;
      object = proxy.target;
    }
  } else {
    // the check below will filter out functions, which doesn't need the protection
    if (!object || typeof(object) !== 'object' || object[READ_ONLY]) {
      return object;
    }
    proxyType = object.constructor[PROXY_TYPE] ?? ProxyType.ReadOnly;
  }
  return getProxy(object, proxyType);
}

export function addConstTarget(object) {
  // pretend a read-only object is a proxy to itself
  return proxyTargetMap.set(object, { target: object, type: ProxyType.Const });
}

const pointerHandlers = {
  get(pointer, name) {
    if (name in pointer) {
      return pointer[name];
    } else {
      const target = pointer[TARGET];
      return target[name];
    }
  },
  set(pointer, name, value) {
    if (name in pointer) {
      pointer[name] = value;
    } else {
      const target = pointer[TARGET];
      target[name] = value;
    }
    return true;
  },
  deleteProperty(pointer, name) {
    if (name in pointer) {
      delete pointer[name];
    } else {
      const target = pointer[TARGET];
      delete target[name];
    }
    return true;
  },
  has(pointer, name) {
    if (name in pointer) {
      return true;
    } else {
      const target = pointer[TARGET];
      return name in target;
    }
  },
  apply(pointer, thisArg, args) {
    const f = pointer['*'];
    return f.apply(thisArg, args);
  },
};

const readOnlyPointerHandlers = {
  ...pointerHandlers,
  set(pointer, name, value) {
    if (name in pointer) {
      throwReadOnly();
    } else {
      const target = pointer[TARGET];
      target[name] = value;
    }
    return true;
  },
};

const readOnlyHandlers = {
  get(target, name) {
    const value = target[name];
    return (typeof(name) === 'string') ? getReadOnlyProxy(value) : value;
  },
  set(target, name, value) {
    throwReadOnly();
  }
};

const constPointerHandlers = {
  ...pointerHandlers,
  get(pointer, name) {
    if (name in pointer) {
      return pointer[name];
    } else {
      return readOnlyHandlers.get(pointer[TARGET], name);
    }
  },
  set(pointer, name, value) {
    if (name in pointer) {
      pointer[name] = value;
    } else {
      throwReadOnly();
    }
    return true;
  },
};

const readOnlyConstPointerHandlers = {
  ...readOnlyPointerHandlers,
  set: readOnlyHandlers.set,
};

const sliceHandlers = {
  get(slice, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return slice.get(index);
    } else {
      return slice[name];
    }
  },
  set(slice, name, value) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      slice.set(index, value);
    } else {
      slice[name] = value;
    }
    return true;
  },
  deleteProperty(slice, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return false;
    } else {
      delete slice[name];
      return true;
    }
  },
  has(slice, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return (index >= 0 && index < slice.length);
    } else {
      return slice[name];
    }
  },
  ownKeys(slice) {
    const keys = [];
    for (let i = 0, len = slice.length; i < len; i++) {
      keys.push(`${i}`);
    }
    keys.push('length');
    return keys;
  },
  getOwnPropertyDescriptor(slice, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      if (index >= 0 && index < slice.length) {
        return { value: slice.get(index), enumerable: true, writable: true, configurable: true };
      }
    } else {
      return Object.getOwnPropertyDescriptor(slice, name);
    }
  },
};

const readOnlySliceHandlers = {
  ...sliceHandlers,
  get (slice, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return getReadOnlyProxy(slice.get(index));
    } else if (name === 'set') {
      return throwReadOnly;
    } else {
      return slice[name];
    }
  },
  set: throwReadOnly,
};

const handlersHash = {
  [ProxyType.Pointer]: pointerHandlers,
  [ProxyType.Pointer | ProxyType.Const]: constPointerHandlers,
  [ProxyType.Pointer | ProxyType.ReadOnly]: readOnlyPointerHandlers,
  [ProxyType.Pointer | ProxyType.ReadOnly | ProxyType.Const ]: readOnlyConstPointerHandlers,
  [ProxyType.Slice]: sliceHandlers,
  [ProxyType.Slice | ProxyType.ReadOnly]: readOnlySliceHandlers,
  [ProxyType.ReadOnly]: readOnlyHandlers,
};

