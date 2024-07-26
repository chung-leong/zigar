require('node-zigar/cjs');
const { fopen, fclose, fprintf, I8, I16, Usize } = require('../zig/functions.zig');

const format = 'hello world %hhd %hd %zx\n';
const args = [ new I8(123), new I16(1234), new Usize(0xFFFF_FFFFn) ];
const f = fopen('hello.txt', 'w');
fprintf(f, format, ...args);
fclose(f);
