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
        $this->expectOutput(<<<OUTPUT
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

    public function testReturnZigAllocator(): void
    {
        $m = ZigImporter::load(__DIR__ . '/return-allocator.zig');
        $a = $m->getAllocator();
        $struct = new $m->Struct(number1: 123, number2: 456, allocator: $a);
        $this->assertEquals((object) [
            'number1' => 123,
            'number2' => 456,
        ], $struct->__plain);
        $this->expectOutput(<<<OUTPUT
        .{ .number1 = 123, .number2 = 456 }

        OUTPUT);
        $m->ptr_maybe = $struct;        
        $m->print();
        $a->free($struct);
        $msg = 'Hello world';
        $buf = $a->dupe($msg);
        $array = new Uint8Array($buf);
        for ($i = 0; $i < strlen($msg); $i++) {
            $this->assertSame($array[$i], ord($msg[$i]));
        }
        $a->free($buf);
        $this->assertTrue($buf->detached);
        $array1 = new Float64Array([ 1.1, 2.2, 3.3, 4.4, 5.5 ]);
        $buf = $a->dupe($array);
        $array2 = new Float64Array($buf);
        for ($i = 0; $i < count($array1); $i++) {
            $this->assertSame($array1[$i], $array2[$i]);
        }
    }

    public function testUseReturnedAllocatorInCall(): void
    {
        $m = ZigImporter::load(__DIR__ . '/allocate-from-zig-allocator.zig');
        $struct = new $m->Struct(number1: 123, number2: 456, allocator: $m->default_allocator);
        $this->assertEquals((object) [
            'number1' => 123,
            'number2' => 456,
        ], $struct->__plain);
        $m->default_allocator->free($struct);
        $ptr = $m->alloc(allocator: $m->default_allocator);
        $this->assertEquals((object) [
            'number1' => 123,
            'number2' => 456,
        ], $ptr->__plain);
        $m->default_allocator->free($ptr);
    }
}
