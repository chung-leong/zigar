<?php declare(strict_types=1);

final class MemoryAllocationTest extends ZigarTestCase
{   
    public function testProvideAllocatorToFunctionReturningString(): void
    {
        $m = ZigImporter::load(__DIR__ . '/allocate-memory-for-string.zig');
        $result = $m->getMessage(123, 456, 3.14);
        $this->assertSame('Numbers: 123, 456, 3.14', (string) $result);
    }

    public function testReturnMemoryFromInternalAllocator(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-internal-slice.zig');
        $slice = $m->createSlice(16);
        for ($j = 0; $j < count($slice); $j++) {
            $slice[$j] = ($j + 1) * 10;
        }
        $m->printSlice($slice);
        $this->expectOutputString(<<<OUTPUT
        10
        20
        30
        40
        50
        60
        70
        80
        90
        100
        110
        120
        130
        140
        150
        160

        OUTPUT);
        $m->freeSlice($slice);
    }

    public function testKeepUsableCopyOfAllocator(): void
    {
        $m = ZigImporter::load(__DIR__ . '/retain-allocator.zig');
        $copier = $m->create();
        $copy1 = $copier->dupe('Hello world');
        $this->assertSame('Hello world', (string) $copy1);
        $copy2 = $copier->dupe('Hello world');
        $this->assertSame('Hello world', $copy2->__string);
    }

    // public function testReturnZigAllocator(): void
    // {
    //     $m = ZigImporter::load(__DIR__ . '/return-allocator.zig');
    // }

    // public function testUseReturnedAllocatorInCall(): void
    // {
    //     $m = ZigImporter::load(__DIR__ . '/allocate-from-zig-allocator.zig');
    // }
}
