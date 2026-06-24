<?php declare(strict_types=1);

final class MetaTypesTest extends ZigarTestCase
{   
    public function testMakeFieldString(): void
    {
        $m = ZigImporter::load(__DIR__ . '/special-fields.zig');
        $obj = $m->object;
        $this->assertSame('Hello world', $obj->string);
        $this->assertSame(123, $obj->number);
        $this->assertNull($obj->undefined);
    }

    public function testMakeFieldTypedArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/special-fields.zig');
        $obj = $m->object;
        $this->assertEquals(new Float64Array([ 1, 2, 3, 4 ]), $obj->typed_array);
    }

    public function testMakeFieldClampedArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/special-fields.zig');
        $obj = $m->object;
        $this->assertEquals(new Uint8ClampedArray([ 1, 2, 3, 4 ]), $obj->clamped_array);
    }

    public function testMakeFieldObject(): void
    {
        $m = ZigImporter::load(__DIR__ . '/special-fields.zig');
        $obj = $m->object;
        $this->assertEquals((object) [
            'number1' => 0,
            'number2' => 0,
        ], $obj->object);
    }

    public function testMakeDeclString(): void
    {
        $m = ZigImporter::load(__DIR__ . '/special-decls.zig');
        $this->assertSame('Hello world', $m->string);
        $this->assertSame(123, $m->number);
        $this->assertNull($m->void);
    }

    public function testMakeDeclTypedArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/special-decls.zig');
        $this->assertEquals(new Float64Array([ 1, 2, 3, 4 ]), $m->typed_array);
    }

    public function testMakeDeclClampedArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/special-decls.zig');
        $this->assertEquals(new Uint8ClampedArray([ 1, 2, 3, 4 ]), $m->clamped_array);
    }

    public function testMakeDeclObject(): void
    {
        $m = ZigImporter::load(__DIR__ . '/special-decls.zig');
        $this->assertEquals((object) [
            'number1' => 0,
            'number2' => 0,
        ], $m->object);
    }

    public function testMakeReturnValueString(): void
    {
        $m = ZigImporter::load(__DIR__ . '/special-return-values.zig');
        $result = $m->returnString();
        $this->assertSame('Hello world', $result);
    }

    public function testMakeReturnValueTypedArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/special-return-values.zig');
        $result = $m->returnTypedArray();
        $this->assertEquals(new Uint8Array([ 72, 101, 108, 108, 111,  32, 119, 111, 114, 108, 100 ]), $result);
    }

    public function testMakeReturnValueClampedArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/special-return-values.zig');
        $result = $m->returnClampedArray();
        $this->assertEquals(new Uint8ClampedArray([ 72, 101, 108, 108, 111,  32, 119, 111, 114, 108, 100 ]), $result);
    }

    public function testMakeReturnValueObject(): void
    {
        $m = ZigImporter::load(__DIR__ . '/special-return-values.zig');
        $result = $m->returnObject();
        $this->assertEquals((object) [
            'number1' => 123,
            'number2' => 1234,            
        ], $result);
    }
}
