import readline from 'readline/promises';
import { getServerStats, startServer, stopServer, storeText } from '../lib/server.zigar';

const server = startServer({ ip: '127.0.0.1', port: 8080, thread_count: 8 });
const { stdin: input, stdout: output } = process;
const rl = readline.createInterface({ input, output });
while (true) {
    const cmd = await rl.question('> ');
    if (cmd === 'quit') {
        break;
    } else if (cmd === 'add') {
        const uri = await rl.question('Enter URI: ');
        const text = await rl.question('Enter Text: ');
        storeText(server, uri, text);
    } else if (cmd === 'stats') {
        const stats = getServerStats(server);
        console.log(stats.valueOf());
    }
}
rl.close();
stopServer(server);