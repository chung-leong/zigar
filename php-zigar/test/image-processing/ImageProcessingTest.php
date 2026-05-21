<?php declare(strict_types=1);

final class ImageProcessingTest extends ZigarTestCase
{   
    public function testRenderPolishFlag(): void
    {
        $m = ZigImporter::load(__DIR__ . '/polish-flag.zig');
        $im_out = imagecreatetruecolor(320, 200);
        $m->render($im_out);
        $filename = 'flag.png';
        $path = get_output_path($filename);
        imagepng($im_out, $path);
        $ref_data = file_get_contents(__DIR__ . "/images/$filename");
        $data = file_get_contents($path);
        $this->assertSame($ref_data, $data);
    }

    public function testRenderPolishFlagWithPalette(): void
    {
        $m = ZigImporter::load(__DIR__ . '/polish-flag.zig');
        $im_out = imagecreate(320, 200);
        $m->render($im_out);
        $filename = 'flag-palette.png';
        $path = get_output_path($filename);
        imagepng($im_out, $path);
        $ref_data = file_get_contents(__DIR__ . "/images/$filename");
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
        $filename = 'resized.png';
        $path = get_output_path($filename);
        imagepng($im_out, $path);   
        $ref_data = file_get_contents(__DIR__ . "/images/$filename");
        $data = file_get_contents($path);
        $this->assertSame($ref_data, $data);

    }

    public function testEnlargeImage(): void
    {
        $m = ZigImporter::load(__DIR__ . '/resize.zig');
        $im_in = imagecreatefrompng(__DIR__ . '/images/malgorzata-socha.png');
        $im_out = imagecreatetruecolor(800, 600);
        $m->resize($im_in, $im_out);
        $filename = 'enlarged.png';
        $path = get_output_path($filename);
        imagepng($im_out, $path);
        $ref_data = file_get_contents(__DIR__ . "/images/$filename");
        $data = file_get_contents($path);
        $this->assertSame($ref_data, $data);
    }

    public function testRunSepiaFilter(): void
    {
        $m = ZigImporter::load(__DIR__ . '/sepia.zig');
        $im_in = imagecreatefrompng(__DIR__ . '/images/malgorzata-socha.png');
        $im_out = imagecreatetruecolor(imagesx($im_in), imagesy($im_in));
        $m->process([ 
            'src' => $im_in,
        ], [ 
            'dst' => $im_out, 
        ], [
            'intensity' => 0.3,
        ]);
        $filename = 'sepia.png';
        $path = get_output_path($filename);
        imagepng($im_out, $path);
    }
}

function get_output_path($filename) {
    $dir_path = __DIR__ . '/output';
    if (!file_exists($dir_path)) {
        mkdir($dir_path, 0777);
    }
    return "$dir_path/$filename";
}
