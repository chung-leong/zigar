const addon = require('./build/Release/addon');

const zig = addon.load('/home/cleong/node-zig/libimport.so');

console.log(zig);
zig.hello(12345);
zig.world(45, -1, 88);