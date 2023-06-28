import { obtainGetter, obtainSetter } from './struct.js';
import { obtainClearFunction } from './memory.js';
import {  } from './error.js';
import { MEMORY } from '../src/symbol.js';

export function obtainOptionalGetter(members, options) {
  const [ valueMember, presentMember ] = members;
  const getPresent = obtainGetter(presentMember, options);
  const getValue = obtainGetter(valueMember, options);
  return function() {
    const present = getPresent.call(this);
    if (present) {
      return getValue.call(this);
    } else {
      return null;
    }
  };
}

export function obtainOptionalSetter(members, options) {
  const [ valueMember, presentMember ] = members;
  const setPresent = obtainSetter(presentMember, options);
  const setValue = obtainSetter(valueMember, options);
  // TODO: rework logic for clearing
  const clear = obtainClearFunction(1);
  return function(v) {
    if (v == null) {
      clear(this[MEMORY]);
    } else {
      setPresent.call(this, true);
      setValue.call(this, v);
    }
  }
}


