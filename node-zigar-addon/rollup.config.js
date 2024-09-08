import Replace from '@rollup/plugin-replace';
// import Terser from '@rollup/plugin-terser';

export default {
  input: 'src/addon.js',
  plugins: [
    Replace({
      preventAssignment: true,
      values: {
        'process.env.DEV': 'false',
        'process.env.TARGET': '"node"',
      },
    })
  ],
  output: {
    file: 'src/addon.js.txt',
    format: 'iife',
    name: 'variable',
    plugins: [
      // Terser(),
      CPPString(),
    ]
  },
};

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