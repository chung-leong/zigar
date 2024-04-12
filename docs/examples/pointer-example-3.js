import { printDirectoryTree } from './pointer-example-3.zig';

printDirectoryTree({
    name: 'root',
    entries: [
        { file: { name: 'README', data: 'Hello world' } },
        {   
            dir: { 
                name: 'images',
                entries: [
                    { file: { name: 'cat.jpg', data: new ArrayBuffer(8000) } },
                    { file: { name: 'lobster.jpg', data: new ArrayBuffer(16000) } },
                ]
            }
        },
        { 
            dir: {
                name: 'src',
                entries: [
                    { file: { name: 'index.js', data: 'while (true) alert("You suck!")' } },
                    { dir: { name: 'empty', entries: [] } },
                ]
            }
        }
    ]
});
