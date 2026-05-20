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
        $data = file_get_contents(__DIR__ . '/output/flag.png');
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
        $data = file_get_contents(__DIR__ . '/output/flag-palette.png');
        $this->assertSame($ref_data, $data);
    }
}
