import { defineEnvironment } from './environment.js';

function createEnvironment() {
  // define Environment class, incorporating methods and properties in imported mixins
  const Env = defineEnvironment();
  return new Env();
}

export { createEnvironment };
