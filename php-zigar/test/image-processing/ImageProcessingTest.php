<?php declare(strict_types=1);

final class ImageProcessingTest extends ZigarTestCase
{   
    public function testRenderPolishFlag(): void
    {
        $m = ZigImporter::load(__DIR__ . '/polish-flag.zig');
        $im_out = imagecreatetruecolor(320, 200);
        $m->render($im_out);
        $output_dir = __DIR__ . '/output';
        if (!file_exists($output_dir)) {
            mkdir($output_dir, 0777);
        }
        $path = $output_dir . '/flag.png';
        imagepng($im_out, $path);
        $ref_data = file_get_contents(__DIR__ . '/images/flag.png');
        $data = file_get_contents($path);
        $this->assertSame($ref_data, $data);
    }

    public function testRenderPolishFlagWithPalette(): void
    {
        $m = ZigImporter::load(__DIR__ . '/polish-flag.zig');
        $im_out = imagecreate(320, 200);
        $m->render($im_out);
        $output_dir = __DIR__ . '/output';
        if (!file_exists($output_dir)) {
            mkdir($output_dir, 0777);
        }
        $path = $output_dir . '/flag-palette.png';
        imagepng($im_out, $path);
        $ref_data = file_get_contents(__DIR__ . '/images/flag-palette.png');
        $data = file_get_contents($path);
        $this->assertSame($ref_data, $data);
    }

    public function testResizeImage(): void
    {
        $m = ZigImporter::load(__DIR__ . '/resize.zig');
        $im_in = imagecreatefrompng(__DIR__ . '/images/malgorzata-socha.png');
        $im_out = imagecreatetruecolor(384, 288);
        $m->resize($im_in, $im_out);
        $output_dir = __DIR__ . '/output';
        if (!file_exists($output_dir)) {
            mkdir($output_dir, 0777);
        }
        $path = $output_dir . '/resized.png';
        imagepng($im_out, $path);   
        $ref_data = file_get_contents(__DIR__ . '/images/resized.png');
        $data = file_get_contents($path);
        $this->assertSame($ref_data, $data);

    }

    public function testEnlargeImage(): void
    {
        $m = ZigImporter::load(__DIR__ . '/resize.zig');
        $im_in = imagecreatefrompng(__DIR__ . '/images/malgorzata-socha.png');
        $im_out = imagecreatetruecolor(800, 600);
        $m->resize($im_in, $im_out);
        $output_dir = __DIR__ . '/output';
        if (!file_exists($output_dir)) {
            mkdir($output_dir, 0777);
        }
        $path = $output_dir . '/enlarged.png';
        imagepng($im_out, $path);
        $ref_data = file_get_contents(__DIR__ . '/images/enlarged.png');
        $data = file_get_contents($path);
        $this->assertSame($ref_data, $data);
    }
}
