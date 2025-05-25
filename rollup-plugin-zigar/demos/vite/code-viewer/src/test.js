import { extract, shutdown, startup } from '../zig/decompress.zig';

startup();
try {
  const response = await fetch('https://corsproxy.io/?url=https://github.com/ziglang/zig/archive/refs/tags/0.1.1.tar.gz');
  const reader = response.body.getReader()
  for await (const file of extract(reader)) {
    console.log(file.name.string);
  }
} finally {
  shutdown();
}
