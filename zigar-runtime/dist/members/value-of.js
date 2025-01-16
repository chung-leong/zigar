import { StructureType, StructFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { TYPE, ENTRIES, FLAGS } from '../symbols.js';

var valueOf = mixin({
  defineValueOf() {
    return {
      value() {
        return normalizeObject(this, false);
      },
    };
  },
});

const INT_MAX = BigInt(Number.MAX_SAFE_INTEGER);
const INT_MIN = BigInt(Number.MIN_SAFE_INTEGER);

function normalizeObject(object, forJSON) {
  const handleError = (forJSON)
  ? (cb) => {
      try {
        return cb();
      } catch (err) {
        return err;
      }
    }
  : (cb) => cb();
  const resultMap = new Map();
  const process = function(value) {
    // handle type (i.e. constructor) like a struct
    const type = (typeof(value) === 'function') ? StructureType.Struct : value?.constructor?.[TYPE];
    if (type === undefined) {
      if (forJSON) {
        if (typeof(value) === 'bigint' && INT_MIN <= value && value <= INT_MAX) {
          return Number(value);
        } else if (value instanceof Error) {
          return { error: value.message };
        }
      }
      return value;
    }
    let result = resultMap.get(value);
    if (result === undefined) {
      let entries;
      switch (type) {
        case StructureType.Struct:
          entries = value[ENTRIES]();
          result = (value.constructor[FLAGS] & StructFlag.IsTuple) ? [] : {};
          break;
        case StructureType.Union:
          entries = value[ENTRIES]();
          result = {};
          break;
        case StructureType.Array:
        case StructureType.Vector:
        case StructureType.Slice:
          entries = value[ENTRIES]();
          result = [];
          break;
        case StructureType.Pointer:
          try {
            result = value['*'];
          } catch (err) {
            result = Symbol.for('inaccessible');
          }
          break;
        case StructureType.Enum:
          result = handleError(() => String(value));
          break;
        case StructureType.Opaque:
          result = {};
          break;
        default:
          result = handleError(() => value.$);
      }
      result = process(result);
      resultMap.set(value, result);
      if (entries) {
        for (const [ key, child ] of entries) {
          result[key] = process(child);
        }
      }
    }
    return result;
  };
  return process(object);
}

export { valueOf as default, normalizeObject };
