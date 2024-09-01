import { ENTRIES_GETTER, TUPLE, TYPE } from '../../symbol.js';
import { mixin } from '../class.js';
import { StructureType } from '../structures/all.js';

export default mixin({
  getSpecialMethodDescriptors() {
    return {
      toJSON: { value: convertToJSON },
      valueOf: { value: convertToJS },
    };
  },
});

function convertToJS() {
  return normalizeObject(this, false);
}

function convertToJSON() {
  return normalizeObject(this, true);
}

const INT_MAX = BigInt(Number.MAX_SAFE_INTEGER);
const INT_MIN = BigInt(Number.MIN_SAFE_INTEGER);

function normalizeObject(object, forJSON) {
  const error = (forJSON) ? 'return' : 'throw';
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
        case StructureType.PackedStruct:
        case StructureType.ExternStruct:
        case StructureType.TaggedUnion:
        case StructureType.BareUnion:
        case StructureType.ExternUnion:
          entries = value[ENTRIES_GETTER]?.({ error });
          result = value.constructor[TUPLE] ? [] : {};
          break;
        case StructureType.Array:
        case StructureType.Vector:
        case StructureType.Slice:
          entries = value[ENTRIES_GETTER]?.({ error });
          result = [];
          break;
        case StructureType.SinglePointer:
        case StructureType.SlicePointer:
        case StructureType.MultiPointer:
        case StructureType.CPointer:
          try {
            result = value['*'];
          } catch (err) {
            result = Symbol.for('inaccessible');
          }
          break;
        case StructureType.Enum:
          result = handleError(() => String(value), { error });
          break;
        case StructureType.Opaque:
          result = {};
          break;
        default:
          result = handleError(() => value.$, { error });
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

function handleError(cb, options = {}) {
  const { error = 'throw' } = options;
  try {
    return cb();
  } catch (err) {
    if (error === 'return') {
      return err;
    } else {
      throw err;
    }
  }
}

