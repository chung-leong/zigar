import { mixin } from '../environment.js';
import { SLOTS } from '../symbols.js';
import { bindSlot } from './all.js';

export default mixin({
  defineMemberType(member, env) {
    const { slot } = member;
    return bindSlot(slot, { get: getType });
  }
});

function getType(slot) {
  // unsupported types will have undefined structure
  const structure = this[SLOTS][slot];
  return structure?.constructor;
}

