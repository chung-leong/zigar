import { printDirectoryTree } from './pointer-example-3.zig';

const catImgData = new ArrayBuffer(8000);
const dogImgData = new ArrayBuffer(16000);

printDirectoryTree({
    name: 'root',
    entries: [
        { file: { name: 'README', data: 'Hello world' } },
        {   
            dir: { 
                name: 'images',
                entries: [
                    { file: { name: 'cat.jpg', data: catImgData } },
                    { file: { name: 'dog.jpg', data: dogImgData } },
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
