import NodeResolve from '@rollup/plugin-node-resolve';
import Replace from '@rollup/plugin-replace';
import Terser from '@rollup/plugin-terser';
import Gzip from 'rollup-plugin-gzip'

const replacements1 = {
  'process.env.DEV': 'false',
  'process.env.BITS': '"64"',
  'process.env.TARGET': '"node"',
  'process.env.MIXIN': '""',
};
const replacements2 = {
  '...(undefined),': '',
  '/* c8 ignore start */': '',
  '/* c8 ignore end */': '',
  '/* c8 ignore next */': '',
};
const terserOptions = {
  keep_classnames: true,
  output: { beautify: true }
};

export default [
  {
    input: 'src/addon.js',
    plugins: [
      NodeResolve(),
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
    output: {
      file: 'src/addon.64b.js',
      format: 'iife',
      name: 'variable',
      plugins: [
        Terser(terserOptions),
        ExtractIIFE(),
        Gzip(),
      ]
    },
  },
  {
    input: 'src/addon.js',
    plugins: [
      NodeResolve(),
      Replace({
        preventAssignment: true,
        values: {
          ...replacements1,
          'process.env.BITS': '"32"',
        },
      }),
      Replace({
        preventAssignment: false,
        values: replacements2,
        delimiters: [ ' *', '\\n*' ],
      }),
    ],
    output: {
      file: 'src/addon.32b.js',
      format: 'iife',
      name: 'variable',
      plugins: [
        Terser(terserOptions),
        ExtractIIFE(),
        Gzip(),
      ]
    },
  }
]

function ExtractIIFE() {
  // place JS code into a C++ raw string
  return {
    name: 'cpp_string',
    renderChunk (code) {
      return code.replace(/var variable\s*=\s*([\s\S]*);/, '($1)');
    }
  };
}