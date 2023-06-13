import Terser from '@rollup/plugin-terser';

export default {
  input: 'src/define.js',
  output: {
		file: 'src/addon.js.txt',
		format: 'iife',
    plugins: [ 
      Terser(),
      {
        // turn code into C++ raw string 
        // we can't rely on banner/footer here since those are seen by Terser, 
        // which would prompt throw an syntax error
        name: 'C++ string',
        renderChunk (code) {
          return `R"=====(\n${code}\n)====="`;
        }
      },
    ]
	},
  onwarn(warning, warn) {
    if (warning.code === 'MISSING_NAME_OPTION_FOR_IIFE_EXPORT') return
    warn(warning)
  }   
};