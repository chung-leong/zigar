<?php declare(strict_types=1);

final class ZigBenchmarksGameTest extends ZigarTestCase
{   
    public function testProduceRightResultsForBinaryTreesExample(): void
    {
        $m = ZigImporter::load(__DIR__ . '/binary-trees.zig');
        $n = 12;
        $ref_text = file_get_contents(__DIR__ . "/data/binary-trees-$n.txt");
        ob_start();
        $m->binaryTree($n);
        $text = ob_get_clean();
        $lines = split($text);
        $ref_lines = split($ref_text);
        foreach ($lines as $index => $line) {
            $this->assertSame($ref_lines[$index], $line);
        }
    }

    public function testProduceRightResultsForFannkuchReduxExample(): void
    {
        $m = ZigImporter::load(__DIR__ . '/fannkuch-redux.zig');
        $n = 10;
        $result = $m->Pfannkuchen($n);
        $this->assertSame(73196, $result->checksum);
        $this->assertSame(38, $result->max_flips_count);
    }

    public function testProduceRightResultsForFastaExample(): void
    {
        $m = ZigImporter::load(__DIR__ . '/fasta.zig');
        $n = 250000;
        $ref_text = file_get_contents(__DIR__ . "/data/fasta-$n.txt");
        ob_start();
        $m->fasta($n);
        $text = ob_get_clean();
        $lines = split($text);
        $ref_lines = split($ref_text);
        foreach ($lines as $index => $line) {
            $this->assertSame($ref_lines[$index], $line);
        }
    }

    public function testProduceRightResultsForKNucleotideExample(): void
    {
        $m = ZigImporter::load(__DIR__ . '/k-nucleotide.zig');
        $n = 250000;
        $ref_text = file_get_contents(__DIR__ . "/data/k-nucleotide-$n.txt");
        $input_text = file_get_contents(__DIR__ . "/data/fasta-$n.txt");
        $input = [];
        $started = false;
        foreach (split($input_text) as $line) {
            if (!$started) {
                if (preg_match('/^>THREE/', $line)) {
                    $started = true;
                }
            } else {
                $input[] = $line;
            }
        }
        $output = $m->kNucleotide($input);
        $lines = [];
        foreach ($output as $line) {
            foreach (split($line->__string) as $sub_line) {
                $lines[] = $sub_line;
            }
        }
        $ref_lines = split(trim($ref_text));
        $this->assertSame($ref_lines, $lines);
    }

    public function testProduceRightResultsForMandelbrotExample(): void
    {
        $m = ZigImporter::load(__DIR__ . '/mandelbrot.zig');
        $n = 2000;
        $ref_text = file_get_contents(__DIR__ . "/data/mandelbrot-$n.txt");
        ob_start();
        $m->mandelbrot($n);
        $text = ob_get_clean();
        $lines = split($text);
        $ref_lines = split($ref_text);
        foreach ($lines as $index => $line) {
            $this->assertSame($ref_lines[$index], $line);
        }
    }

    public function testProduceRightResultsForNBodyExample(): void
    {
        $m = ZigImporter::load(__DIR__ . '/nbody.zig');
        $solar_bodies = new $m->Planets([
            // Sun
            [
                'x' => 0.0,
                'y' => 0.0,
                'z' => 0.0,
                'vx' => 0.0,
                'vy' => 0.0,
                'vz' => 0.0,
                'mass' => $m->solar_mass,
            ],
            // Jupiter
            [
                'x' => 4.84143144246472090e+00,
                'y' => -1.16032004402742839e+00,
                'z' => -1.03622044471123109e-01,
                'vx' => 1.66007664274403694e-03 * $m->year,
                'vy' => 7.69901118419740425e-03 * $m->year,
                'vz' => -6.90460016972063023e-05 * $m->year,
                'mass' => 9.54791938424326609e-04 * $m->solar_mass,
            ],
            // Saturn
            [
                'x' => 8.34336671824457987e+00,
                'y' => 4.12479856412430479e+00,
                'z' => -4.03523417114321381e-01,
                'vx' => -2.76742510726862411e-03 * $m->year,
                'vy' => 4.99852801234917238e-03 * $m->year,
                'vz' => 2.30417297573763929e-05 * $m->year,
                'mass' => 2.85885980666130812e-04 * $m->solar_mass,
            ],
            // Uranus
            [
                'x' => 1.28943695621391310e+01,
                'y' => -1.51111514016986312e+01,
                'z' => -2.23307578892655734e-01,
                'vx' => 2.96460137564761618e-03 * $m->year,
                'vy' => 2.37847173959480950e-03 * $m->year,
                'vz' => -2.96589568540237556e-05 * $m->year,
                'mass' => 4.36624404335156298e-05 * $m->solar_mass,
            ],
            // Neptune
            [
                'x' => 1.53796971148509165e+01,
                'y' => -2.59193146099879641e+01,
                'z' => 1.79258772950371181e-01,
                'vx' => 2.68067772490389322e-03 * $m->year,
                'vy' => 1.62824170038242295e-03 * $m->year,
                'vz' => -9.51592254519715870e-05 * $m->year,
                'mass' => 5.15138902046611451e-05 * $m->solar_mass,
            ],
        ]);
        $n = 50000;
        $m->offset_momentum($solar_bodies);
        $result1 = $m->energy($solar_bodies->{'*'});
        $m->advance($solar_bodies, 0.01, $n);
        $result2 = $m->energy($solar_bodies->{'*'});
        $this->assertEquals('365.24', round($m->year, 2));
        $this->assertSame(4.0 * M_PI * M_PI, $m->solar_mass);
        $this->assertEquals('-0.169075164', round($result1, 9));
        $this->assertEquals('-0.169078071', round($result2, 9));
    }

    public function testProduceRightResultsForReverseComplementExample(): void
    {
        $m = ZigImporter::load(__DIR__ . '/reverse-complement.zig');
        $n = 250000;
        $ref_buf = new ArrayBuffer(file_get_contents(__DIR__ . "/data/reverse-complement-$n.txt"), true);
        $buf = new ArrayBuffer(file_get_contents(__DIR__ . "/data/fasta-$n.txt"));
        $m->reverseComplement($buf);
        $ref_bytes = new Uint8Array($ref_buf);
        $bytes = new Uint8Array($buf);
        $different = false;
        for ($i = 0; $i < $ref_bytes->byteLength; $i++) {
            if ($ref_bytes[$i] != $bytes[$i]) {
                $different = true;
                break;
            }
        }
        $this->assertFalse($different);
        $this->assertTrue($ref_bytes == $bytes);
    }

    public function testProduceRightResultsForSpectralNormExample(): void
    {
        $m = ZigImporter::load(__DIR__ . '/spectral-norm.zig');
        $n = 1500;
        $result = $m->spectralNorm($n);
        $this->assertEquals('1.274224151', round($result, 9));
    }
}

function split($text) {
    return preg_split('/\r?\n/', $text);
}