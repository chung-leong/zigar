import { startServer } from '../zig/server.zig';

const host = '127.0.0.1';
const port = 8080;
startServer(host, port);
console.log(`Listening at http://${host}:${port}`);
