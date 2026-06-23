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
      render(outputImage);
      const outputPath = getOutputPath('flag.png');
      await saveImage(outputImage, outputPath);
      const refImage = await loadImage(absolute('images/flag.png'));
      expect(compareImages(outputImage, refImage)).to.be.true;
    })
    it('should resize image', async function() {
      const { resize } = await importTest('resize');
      const inputImage = await loadImage(absolute('images/malgorzata-socha.png'));
      const outputImage = createImage(384, 288);
      resize(inputImage, outputImage);
      const outputPath = getOutputPath('resized.png');
      await saveImage(outputImage, outputPath);
      const refImage = await loadImage(absolute('images/resized.png'));
      expect(compareImages(outputImage, refImage)).to.be.true;
    })
    it('should apply sepia filter', async function() {
      const { apply } = await importTest('sepia');
      const inputImage = await loadImage(absolute('images/malgorzata-socha.png'));
      const outputImage = createImage(inputImage.width, inputImage.height);
      apply(inputImage, outputImage, 0.3);
      const outputPath = getOutputPath('sepia.png');
      await saveImage(inputImage, outputPath);
      const refImage = await loadImage(absolute('images/sepia.png'));
      expect(compareImages(outputImage, refImage)).to.be.true;
    })
    it('should apply circle-pattern filter', async function() {
      const { apply } = await importTest('circle-pattern');
      const inputImage = await loadImage(absolute('images/malgorzata-socha.png'));
      const outputImage = createImage(inputImage.width, inputImage.height);
      apply(inputImage, outputImage, {
        fill: 0.2,
        scale: 1,
        distort: [ 5, 2 ],
        center: [ 325, 120 ],
        minSolid: 0.001,
        maxSolid: 0.04,
      });
      const outputPath = getOutputPath('circle-pattern.png');
      await saveImage(outputImage, outputPath);
      const refImage = await loadImage(absolute('images/circle-pattern.png'));
      expect(compareImages(outputImage, refImage)).to.be.true;
    })
    it('should apply metallic filter', async function() {
      const { process } = await importTest('metallic');
      const inputImage1 = await loadImage(absolute('images/zig-logo.png'));
      const inputImage2 = await loadImage(absolute('images/stripe.png'));
      const outputImage = createImage(inputImage1.width, inputImage1.height);
      process({
        source: inputImage1,
        stripe: inputImage2,
      }, { 
        dst: outputImage,
      }, {
        lightsource: [ 240, 230, 50 ],
        shininess: 35,
        shadow: 0.4,
        relief: 3.25,
        stripesize: [ 256, 10 ],
        viewDirection: [ 0.5, 0.02, 1 ],
      });
      const outputPath = getOutputPath('metallic.png');
      await saveImage(outputImage, outputPath);
      const refImage = await loadImage(absolute('images/metallic.png'));
      expect(compareImages(outputImage, refImage)).to.be.true;
    })
    it('should apply droste filter', async function() {
      const { process } = await importTest('droste');
      const inputImage = await loadImage(absolute('images/ipad.png'));
      const outputImage = createImage(inputImage.width, inputImage.height);
      process({
        src: inputImage,
      }, { 
        dst: outputImage,
      }, {
        strandMirror: true,
        transparentInside: true,
        transparentOutside: true,
        twist: true,
        periodicityAuto: false,
        hyperDroste: false,
        antialiasing: 2,
        size: [ 680, 725 ],
        radiusInside: 56,
        radiusOutside: 100,
        periodicity: 1,
        strands: 1,
        centerShift: [ -32, 1.5 ],
      });
      const outputPath = getOutputPath('droste.png');
      await saveImage(outputImage, outputPath);
      const refImage = await loadImage(absolute('images/droste.png'));
      expect(compareImages(outputImage, refImage)).to.be.true;
    })
    it('should run raytracer', async function() {
      const { process } = await importTest('raytracer');
      const outputImage = createImage(512, 512);
      process({}, { 
        dst: outputImage,
      }, {});
      const outputPath = getOutputPath('raytracer.png');
      await saveImage(outputImage, outputPath);
      const refImage = await loadImage(absolute('images/raytracer.png'));
      expect(compareImages(outputImage, refImage)).to.be.true;
    })
    it('should render Mandelbulb', async function() {
      const { process } = await importTest('mandelbulb-quick');
      const outputImage = createImage(400, 400);
      process({}, { 
        dst: outputImage,
      }, {
        size: [ outputImage.width, outputImage.height ],
      });
      const outputPath = getOutputPath('mandelbulb-quick.png');
      await saveImage(outputImage, outputPath);
      // const refImage = await loadImage(absolute('images/mandelbulb-quick.png'));
      // expect(compareImages(outputImage, refImage)).to.be.true;
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

