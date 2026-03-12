<?php declare(strict_types=1);

final class TypeHandlingTest extends ZigarTestCase
{   
    public function testImportTypeAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame(true, is_callable($m->Int32));
        $this->assertSame(true, is_callable([ $m, 'Int32' ]));
        $int32 = new $m->Int32(null);
        $int32->__value = 1234;
        $this->assertSame(1234, $int32->__value);

        $this->assertSame(true, is_callable($m->Int128));
        $int128 = new $m->Int128(0);
        $int128->__value = gmp_init('0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
        $this->assertSame('170141183460469231731687303715884105727', (string) $int128);
        $this->assertSame('170141183460469231731687303715884105727', $int128->__string);
        $this->assertSame(true, gmp_init('0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF') == $int128->__value);

        $object = new $m->Struct();
        $this->assertEquals((object) [
            'number1' => 123,
            'number2' => 456,
        ], $object->__plain);
    }

    public function testIgnoreFunctionAcceptingType(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->assertSame(false, isset($m->print));
    }

    public function testIgnoreFunctionReturningType(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame(false, isset($m->getType));
    }

    public function testHandleTypeInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame(4, count($m->array));
        for ($i = 0; $i < 4; $i++) {
            $this->assertSame(true, is_callable($m->array[$i]));
        }
        foreach ($m->array as $item) {
            $this->assertSame(true, is_callable($item));
            $count++;
        }
        $this->assertSame(4, $count);
    }

    public function testHandleTypeInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame($m->struct_a->Type1, $m->Uint8);
        $this->assertSame($m->struct_a->Type2, $m->Uint16);
    }

    public function testFailWithTypeInPackedStruct(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        });
    }

    public function testHandleTypeAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame(true, is_callable($m->struct_a->Type));
        $b = new $m->StructA(number: 500);
        $this->assertSame(true, is_callable($b->Type));

        $boolean = new $b->Type(true);
        $this->assertSame(true, $boolean->__value);

        // TODO: check __plain
    }

    public function testFailWithTypeInBareUnion(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        });
    }

    public function testHandleTypeInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame(true, is_callable($m->union_a->Type));
        $tag = $m->TagType($m->union_a);
        $this->assertSame('Type', (string) $tag);
        $this->assertSame(null, $m->union_a->number);
    }

    public function testHandleTypeInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->assertSame(true, isset($m->optional1));
        $this->assertSame(true, is_callable([ $m, 'optional1' ]));
        $this->assertSame(true, is_callable($m->optional1));

        $this->assertSame(false, isset($m->optional2));
        $this->assertSame(false, is_callable([ $m, 'optional2' ]));
        $this->assertSame(false, is_callable($m->optional2));

        $this->expectOutputString(<<<OUTPUT
        bool

        OUTPUT);
        $m->print();
    }

    public function testHandleTypeInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame(true, isset($m->error_union1));
        $this->assertSame(true, is_callable([ $m, 'error_union1' ]));
        $this->assertSame(true, is_callable($m->error_union1));

        $this->assertExceptionMessage('goldfish died', function() use($m) {
            $x = $m->error_union2;
        });

        $this->expectOutputString(<<<OUTPUT
        bool

        OUTPUT);
        $m->print();
    }

    public function testFailWithTypeInVector(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        });
    }

    public function testConstructType(): void
    {
        $m = ZigImporter::load(__DIR__ . '/constructor.zig');
        $this->assertSame(false, is_callable([ $m, 'Type' ]));
        $this->assertSame(false, isset($m->Type));
    }
}

