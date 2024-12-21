require('node-zigar/cjs');
const { hello } = require('./lib/hello.zigar');
console.log = (s) => process.stderr.write(`${s}\n`);
hello();

nw.Window.open('./src/index.html', { width: 800, height: 600 });
