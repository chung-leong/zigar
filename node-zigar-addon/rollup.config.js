import Replace from '@rollup/plugin-replace';
// import Terser from '@rollup/plugin-terser';

export default [
  {
    input: 'src/addon.js',
    plugins: [
      Replace({
        preventAssignment: true,
        values: {
          'process.env.DEV': 'false',
          'process.env.BITS': '"64"',
          'process.env.TARGET': '"node"',
          'process.env.MIXIN': '""',
        },
      })
    ],
    output: {
      file: 'src/addon.64b.js.txt',
      format: 'iife',
      name: 'variable',
      plugins: [
        // Terser(),
        CPPString(),
      ]
    },
  },
  {
    input: 'src/addon.js',
    plugins: [
      Replace({
        preventAssignment: true,
        values: {
          'process.env.DEV': 'false',
          'process.env.BITS': '"32"',
          'process.env.TARGET': '"node"',
        },
      })
    ],
    output: {
      file: 'src/addon.32b.js.txt',
      format: 'iife',
      name: 'variable',
      plugins: [
        // Terser(),
        CPPString(),
      ]
    },
  }
]

function CPPString() {
  // place JS code into a C++ raw string
  // we can't rely on banner/footer here since those are seen by Terser,
  // which would promptly throw a syntax error
  return {
    name: 'C++ string',
    renderChunk (code) {
      code = code.replace(/var variable\s*=\s*([\s\S]*);/, '($1)');
      return `R"=====(\n${code}\n)====="`;
    }
  };
}