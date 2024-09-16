import { defineEnvironment } from '../../zigar-runtime/src/environment.js';
import '../../zigar-runtime/src/mixins.js';

export function createEnvironment() {
  // define Environment class, incorporating methods and properties in all mixins
  const Env = defineEnvironment();
  return new Env();
}
