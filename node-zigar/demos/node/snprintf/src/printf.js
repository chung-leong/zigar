require('node-zigar/cjs');
const { printf, I8, I16, Usize } = require('../zig/functions.zig');

const format = 'hello world %hhd %hd %zx\n';
const args = [ new I8(123), new I16(1234), new Usize(0xFFFF_FFFFn) ];
printf(format, ...args);
