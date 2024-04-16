require('node-zigar/cjs');
const { pi, hello } = require('./module-example-1.zig');

hello();
console.log(pi);
