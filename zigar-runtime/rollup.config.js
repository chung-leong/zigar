import Replace from '@rollup/plugin-replace';

import { readdirSync, writeFileSync } from 'fs';
import { basename, dirname, join, sep } from 'path';

const replacements1 = {
  'process.env.DEV': 'false',
  'process.env.TARGET': '"wasm"',
  'process.env.BITS': '"32"',
  'process.env.MIXIN': '""',
  'process.env.COMPAT': '""',
};
const replacements2 = {
  '...(undefined),': '',
  '/* c8 ignore start */': '',
  '/* c8 ignore end */': '',
  '/* c8 ignore next */': '',
};

const config = [];
const mixins = {};

for (const subpath of readdirSync('./src', { recursive: true })) {
  const filename = basename(subpath);
  const folder = dirname(subpath);
  if (/\.js$/.test(filename)) {
    if (folder !== '.' && filename !== `worker-support.js`) {
      const prefix = folder.slice(0, -1).replace(/^./, m => m.toUpperCase());
      const name = prefix + filename.slice(0, -3)
                              .replace(/\-./g, m => m.slice(1).toUpperCase())
                              .replace(/^./, m => m.toUpperCase());
      mixins[name] = `./${subpath.split(sep).join('/')}`;
    }
    config.push({
      input: join('./src', subpath),
      output: {
        file: join('./dist', subpath),
        format: 'esm',
      },
      plugins: [
        Replace({
          preventAssignment: true,
          values: replacements1,
        }),
        Replace({
          preventAssignment: false,
          values: replacements2,
          delimiters: [ ' *', '\\n*' ],
        }),
      ],
      external: path => true,
    });
    if (filename === `worker-support.js`) {
      config.push({
        input: join('./src', subpath),
        output: {
          file: join('./dist', subpath.replace('.js', '-compat.js')),
          format: 'esm',
        },
        plugins: [
          Replace({
            preventAssignment: true,
            values: {
              ...replacements1,
              'process.env.COMPAT': '"node"',
            },
          }),
          Replace({
            preventAssignment: false,
            values: replacements2,
            delimiters: [ ' *', '\\n*' ],
          }),
          ],
        external: path => true,
      });
    }
  }
}

const lines = [ '// generated by rollup.config.js' ];
for (const [ name, path ] of Object.entries(mixins)) {
  lines.push(`export { default as ${name} } from '${path}';`);
}
writeFileSync('./src/mixins.js', lines.join('\n') + '\n');

export default config;
