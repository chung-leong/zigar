import { expect } from 'chai';
import { mkdirSync } from 'fs';
import { join } from 'path';
import Sharp from 'sharp';
import { fileURLToPath } from 'url';

export function addTests(importModule, options) {
  const { target, optimize } = options;
  const importTest = async (name, options) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url, options);
  };
  describe('Image processing', function() {
    this.timeout(0);
    it('should render Polish flag', async function() {
      const { render } = await importTest('polish-flag');
      const outputImage = createImage(320, 200);
      render({ web: outputImage });      
      const outputPath = getOutputPath('flag.png');
      await saveImage(outputImage, outputPath);
      const refImage = await loadImage(absolute('images/flag.png'));
      expect(compareImages(outputImage, refImage)).to.be.true;
    })
  })
}

function createImage(width, height) {
  // pixel count = width * height * [number of channels]
  const size = width * height * 4;
  const data = new Uint8ClampedArray(size);
  return { data, width, height };
}

async function loadImage(path) {
  const image = Sharp(path).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function compareImages(image1, image2) {
  const data1 = image1.data;
  const data2 = image2.data;
  for (let i = 0; i < data1.length; i++) {
    if (data1[i] !== data2[i]) return false;
  }
  return true;
}

async function saveImage(image, path) {
  const { data, width, height } = image;
  await Sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(path);
}

function getOutputPath(filename) {
  const dir = absolute('output');
  mkdirSync(dir, { recursive: true });
  return join(dir, filename);
}

function absolute(relPath) {
  return fileURLToPath(new URL(relPath, import.meta.url));
}

