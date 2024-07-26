require('node-zigar/cjs');
const { sprintf, I32, F64, CStr } = require('../zig/functions.zig');

const format = 'hello world %d %.9f %s\n';
const args = [ new I32(1234), new F64(Math.PI), new CStr('donut') ];
const buffer = new Buffer.alloc(16);
sprintf(buffer, format, ...args);
console.log(buffer.toString());