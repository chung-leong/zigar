// hello-name-generator.js
import { hello } from './hello-name.zig';

function *alphabet() {
  for (let c = 'A'.charCodeAt(0); c < 'Z'.charCodeAt(0) + 1; c++) {
    yield c;
  }
}

hello(alphabet());

// console output:
// Hello, ABCDEFGHIJKLMNOPQRSTUVWXYZ!
