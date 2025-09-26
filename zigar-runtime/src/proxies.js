import { ProxyType } from './constants.js';
import { throwReadOnly } from './errors.js';
import { MEMORY, TARGET } from './symbols.js';

const proxyMap = new WeakMap();
const constProxyMap = new WeakMap();
const proxyTargetMap = new WeakMap();

export function getProxy(target, type) {
  const key = target;
  const map = (type === ProxyType.Const) ? constProxyMap : proxyMap;
  let proxy = map.get(key);
  if (!proxy) {
    let handlers;
    if (type === ProxyType.Pointer) {
      handlers = pointerHandlers;
    } else if (type === ProxyType.Array) {
      handlers = arrayHandlers;
    } else {
      handlers = constTargetHandlers;
      const proxy = proxyTargetMap.get(target);
      if (proxy) {
        target = proxy.target;
        if (proxy.type === ProxyType.Array) {
          handlers = constArrayHandlers;
        } else if (proxy.type === ProxyType.Pointer) {
          handlers = constPointerHandlers;
        }
      } else if (TARGET in target) {
        handlers = constPointerHandlers;
      }
    }
    proxy = new Proxy(target, handlers);
    map.set(key, proxy);
    proxyTargetMap.set(proxy, { target, type });
  }
  return proxy;
}

export function getPointerProxy() {
  return getProxy(this, ProxyType.Pointer);
}

export function getArrayProxy() {
  return getProxy(this, ProxyType.Array);
}

export function getConstProxy() {
  return getProxy(this, ProxyType.Const);
}

export function getProxyTarget(proxy) {
  if (typeof(proxy) === 'object' && proxy) {
    return proxyTargetMap.get(proxy);
  }
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
};

const constPointerHandlers = {
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

const constTargetHandlers = {
  get(target, name) {
    const value = target[name];
    if (value?.[MEMORY]) {
      return getProxy(value, ProxyType.Const);
    } else {
      return value;
    }
  },
  set(target, name, value) {
    throwReadOnly();
  }
};

const arrayHandlers = {
  get(array, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return array.get(index);
    } else {
      return array[name];
    }
  },
  set(array, name, value) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      array.set(index, value);
    } else {
      array[name] = value;
    }
    return true;
  },
  deleteProperty(array, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return false;
    } else {
      delete array[name];
      return true;
    }
  },
  has(array, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return (index >= 0 && index < array.length);
    } else {
      return array[name];
    }
  },
  ownKeys(array) {
    const keys = [];
    for (let i = 0, len = array.length; i < len; i++) {
      keys.push(`${i}`);
    }
    keys.push('length');
    return keys;
  },
  getOwnPropertyDescriptor(array, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      if (index >= 0 && index < array.length) {
        return { value: array.get(index), enumerable: true, writable: true, configurable: true };
      }
    } else {
      return Object.getOwnPropertyDescriptor(array, name);
    }
  },
};

const constArrayHandlers = {
  ...arrayHandlers,
  get (array, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return array.get(index);
    } else if (name === 'set') {
      return throwReadOnly;
    } else {
      return array[name];
    }
  },
  set: throwReadOnly,
}