require('node-zigar/cjs');
const { __zigar, hello } = require('./lib/hello.zigar');
__zigar.on('log', ({ source, message }) => {
    process[source].write(message + '\n');
    // return true;
});
hello();

nw.Window.open('./src/index.html', { width: 800, height: 600 });
