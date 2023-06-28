import { obtainGetter, obtainSetter } from './struct.js';
import { obtainClearFunction } from './memory.js';
import { throwNotInErrorSet, throwUnknownErrorNumber } from './error.js';
import { MEMORY } from '../src/symbol.js';

export function obtainErrorUnionGetter(members, options) {
  const [ errorMember, valueMember ] = members;
  const getError = obtainGetter(errorMember, options);
  const getValue = obtainGetter(valueMember, options);
  const { structure } = errorMember;
  return function() {
    const errorNumber = getError.call(this);
    if (errorNumber !== 0) {
      const { constructor } = structure;
      const error = constructor(errorNumber);
      if (!error) {
        throwUnknownErrorNumber(errorNumber);
      }
      throw error;
    } else {
      return getValue.call(this);
    }
  };
}

export function obtainErrorUnionSetter(members, options) {
  const [ errorMember, valueMember ] = members;
  const setErrorNumber = obtainSetter(errorMember, options);
  const setValue = obtainSetter(valueMember, options);
  // TODO: rework logic for clearing
  const clear = obtainClearFunction(1);
  const { structure } = errorMember;
  return function(v) {
    if (v instanceof Error) {
      const { constructor, name } = structure;
      const errorNumber = Number(v);
      const error = constructor(errorNumber);
      if (!error) {
        throwNotInErrorSet(name);
      } else {
        clear(this[MEMORY]);
        setErrorNumber.call(this, errorNumber);
      }
    } else {
      clear(this[MEMORY]);
      setValue.call(this, v);
    }
  }
}


