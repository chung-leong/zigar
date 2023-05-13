const addon = require('./build/Release/addon');

const zig = addon.load('./libtest.so');

console.log(zig.integer);

console.log(zig);
const retval = zig.hello(12345);
console.log(retval);