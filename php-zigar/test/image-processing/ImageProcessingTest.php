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
        $m->apply($im_in, $im_out, 0.3);
        $filename = 'sepia.png';
        $path = get_output_path($filename);
        imagepng($im_out, $path);
        $ref_data = file_get_contents(__DIR__ . "/images/$filename");
        $data = file_get_contents($path);
        $this->assertSame($ref_data, $data);
    }

    public function testRunCirclePatternFilter(): void
    {
        $m = ZigImporter::load(__DIR__ . '/circle-pattern.zig');
        $im_in = imagecreatefrompng(__DIR__ . '/images/malgorzata-socha.png');
        $im_out = imagecreatetruecolor(imagesx($im_in), imagesy($im_in));
        imagesavealpha($im_out, true);
        $m->apply($im_in, $im_out, [
            'fill' => 0.2,
            'scale' => 1,
            'distort' => [ 5, 2 ],
            'center' => [ 325, 120 ],
            'minSolid' => 0.001,
            'maxSolid' => 0.04,
        ]);
        $filename = 'circle-pattern.png';
        $path = get_output_path($filename);
        imagepng($im_out, $path);
        $ref_data = file_get_contents(__DIR__ . "/images/$filename");
        $data = file_get_contents($path);
        $this->assertSame($ref_data, $data);
    }

    public function testRunMetallicFilter(): void
    {
        $m = ZigImporter::load(__DIR__ . '/metallic.zig');
        $im_in0 = imagecreatefrompng(__DIR__ . '/images/zig-logo.png');
        $im_in1 = imagecreatefrompng(__DIR__ . '/images/stripe.png');
        $im_out = imagecreatetruecolor(imagesx($im_in0), imagesy($im_in0));
        imagesavealpha($im_out, true);
        $m->process([ 
            'source' => $im_in0,
            'stripe' => $im_in1,
        ], [ 
            'dst' => $im_out, 
        ], [
            'lightsource' => [ 240, 230, 50 ],
            'shininess' => 35,
            'shadow' => 0.4,
            'relief' => 3.25,
            'stripesize' => [ 256, 10 ],
            'viewDirection' => [ 0.5, 0.02, 1 ],
        ]);
        $filename = 'metallic.png';
        $path = get_output_path($filename);
        imagepng($im_out, $path);
        $ref_data = file_get_contents(__DIR__ . "/images/$filename");
        $data = file_get_contents($path);
        $this->assertSame($ref_data, $data);
    }

    public function testRunDrosteFilter(): void
    {
        $m = ZigImporter::load(__DIR__ . '/droste.zig');
        $im_in = imagecreatefrompng(__DIR__ . '/images/ipad.png');
        $im_out = imagecreatetruecolor(imagesx($im_in), imagesy($im_in));
        $m->process([ 
            'src' => $im_in,
        ], [ 
            'dst' => $im_out, 
        ], [
            'strandMirror' => true,
            'transparentInside' => true,
            'transparentOutside' => true,
            'twist' => true,
            'periodicityAuto' => false,
            'hyperDroste' => false,
            'antialiasing' => 2,
            'size' => [ 680, 725 ],
            'radiusInside' => 56,
            'radiusOutside' => 100,
            'periodicity' => 1,
            'strands'  => 1,
            'centerShift' => [ -32, 1.5 ],
        ]);
        $filename = 'droste.png';
        $path = get_output_path($filename);
        imagepng($im_out, $path);
        $ref_data = file_get_contents(__DIR__ . "/images/$filename");
        $data = file_get_contents($path);
        $this->assertSame($ref_data, $data);
    }

    public function testRunRayTracer(): void
    {
        $m = ZigImporter::load(__DIR__ . '/raytracer.zig');
        $im_out = imagecreatetruecolor(512, 512);
        $m->process([], [ 
            'dst' => $im_out, 
        ], []);
        $filename = 'raytracer.png';
        $path = get_output_path($filename);
        imagepng($im_out, $path);
        $ref_data = file_get_contents(__DIR__ . "/images/$filename");
        $data = file_get_contents($path);
        $this->assertSame($ref_data, $data);
    }

    public function testRenderMandelbulb(): void
    {
        $m = ZigImporter::load(__DIR__ . '/mandelbulb-quick.zig');
        $im_out = imagecreatetruecolor( 400, 400 );
        $m->process([], [ 
            'dst' => $im_out, 
        ], [
            'size' => [ 400, 400 ],
        ]);
        $filename = 'mandelbulb-quick.png';
        $path = get_output_path($filename);
        imagepng($im_out, $path);
        $ref_data = file_get_contents(__DIR__ . "/images/$filename");
        $data = file_get_contents($path);
        $this->assertSame($ref_data, $data);
    }

}

function get_output_path($filename) {
    $dir_path = __DIR__ . '/output';
    if (!file_exists($dir_path)) {
        mkdir($dir_path, 0777);
    }
    return "$dir_path/$filename";
}
