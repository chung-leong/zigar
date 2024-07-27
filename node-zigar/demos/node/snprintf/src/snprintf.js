require('node-zigar/cjs');
const { snprintf, I32, F64, CStr } = require('../zig/functions.zig');

const format = 'hello world %d %.9f %s\n';
const args = [ new I32(1234), new F64(Math.PI), new CStr('donut') ];
const len = snprintf(null, 0, format, ...args);
const buffer = new Buffer.alloc(len);
snprintf(buffer, buffer.length, format, ...args);
console.log(buffer.toString());
