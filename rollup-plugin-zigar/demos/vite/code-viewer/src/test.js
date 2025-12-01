import { extract, shutdown } from '../zig/decompress.zig';

const { body: stream } = await fetch('https://corsproxy.io/?url=https://github.com/ziglang/zig/archive/refs/tags/0.1.1.tar.gz');
try {
  for await (const file of extract(stream)) {
    console.log(file.name.string);
  }
} finally {
  stream.close();
  await shutdown();
}
