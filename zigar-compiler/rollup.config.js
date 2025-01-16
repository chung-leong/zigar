import NodeResolve from '@rollup/plugin-node-resolve';
import Replace from '@rollup/plugin-replace';

const replacements1 = {
  'process.env.DEV': 'false',
  'process.env.TARGET': '"wasm"',
  'process.env.BITS': '"32"',
  'process.env.MIXIN': '"track"',
  'process.env.COMPAT': '""',
};
const replacements2 = {
  '...(undefined),': '',
  '/* c8 ignore start */': '',
  '/* c8 ignore end */': '',
  '/* c8 ignore next */': '',
};

export default [
  {
    input: './src/index.js',
    plugins: [
      NodeResolve({}),
      Replace({
        preventAssignment: true,
        values: {
          'process.env.DEV': 'false',
        },
      })
    ],
    output: [
      {
        file: './dist/index.js',
        format: 'esm',
      },
      {
        file: './dist/index.cjs',
        format: 'commonjs',
      },
    ],
  },
  {
    input: './src/transpiler.js',
    plugins: [
      NodeResolve({}),
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
      file: './dist/transpiler.js',
      format: 'esm',
    },
  }
];
