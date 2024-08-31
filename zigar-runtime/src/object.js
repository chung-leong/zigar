import {
  SLOTS, TARGET_SETTER
} from './symbol.js';

export function copyPointer({ source }) {
  const target = source[SLOTS][0];
  if (target) {
    this[TARGET_SETTER](target);
  }
}

export function getSelf() {
  return this;
}

