const std = @import("std");

const Generator = @import("generator.zig").Generator;
const php = @import("php.zig");
const ClassEntry = php.ClassEntry;
const HashTable = php.HashTable;
const Object = php.Object;
const ObjectIterator = php.ObjectIterator;
const ObjectIteratorFunctions = php.ObjectIteratorFunctions;
const Value = php.Value;
const structure = @import("structure.zig");
const ZigObject = @import("object.zig").ZigObject;

pub fn ArrayIterator(comptime S: type) type {
    return struct {
        iter: ObjectIterator,
        object: *Object,
        len: c_ulong,

        fn fromIter(iter: *ObjectIterator) *@This() {
            return @fieldParentPtr("iter", iter);
        }

        pub fn create(obj: *Object) !*ObjectIterator {
            const self = try php.allocator.create(@This());
            var count: c_long = undefined;
            _ = try S.countElements(obj, &count);
            php.addRef(obj);
            php.initializeIterator(&self.iter);
            self.object = obj;
            self.len = @intCast(count);
            self.iter.funcs = &functions;
            return &self.iter;
        }

        pub fn destroy(iter: *ObjectIterator) void {
            const self = fromIter(iter);
            php.release(self.object);
        }

        pub fn isValid(iter: *ObjectIterator) !c_int {
            const self = fromIter(iter);
            return if (iter.index < self.len) php.SUCCESS else php.FAILURE;
        }

        pub fn getCurrentData(iter: *ObjectIterator) !*Value {
            const self = fromIter(iter);
            var key = php.createValueLong(@intCast(iter.index));
            _ = try S.readElement(self.object, &key, 0, &iter.data);
            return &iter.data;
        }

        pub fn getCurrentKey(iter: *ObjectIterator, key_ptr: *Value) void {
            key_ptr.* = php.createValueLong(@intCast(iter.index));
        }

        pub fn moveForward(iter: *ObjectIterator) void {
            iter.index += 1;
        }

        pub fn rewind(iter: *ObjectIterator) void {
            iter.index = 0;
        }

        const functions: ObjectIteratorFunctions = .{
            .dtor = php.transform(destroy),
            .valid = php.transform(isValid),
            .get_current_data = php.transform(getCurrentData),
            .get_current_key = php.transform(getCurrentKey),
            .move_forward = php.transform(moveForward),
            .rewind = php.transform(rewind),
        };
    };
}

pub const GeneratorIterator = struct {
    iter: ObjectIterator,
    generator: *Generator,

    fn fromIter(iter: *ObjectIterator) *@This() {
        return @fieldParentPtr("iter", iter);
    }

    pub fn create(obj: *Object) !*ObjectIterator {
        const generator_struct = ZigObject(structure.Struct).fromObject(obj).structure();
        const generator = try generator_struct.getSpecialContext(Generator);
        const self = try php.allocator.create(@This());
        generator.addRef();
        php.initializeIterator(&self.iter);
        self.generator = generator;
        self.iter.funcs = &functions;
        return &self.iter;
    }

    pub fn destroy(iter: *ObjectIterator) void {
        const self = fromIter(iter);
        php.freeIterator(&self.iter);
        self.generator.release();
    }

    pub fn isValid(iter: *ObjectIterator) !c_int {
        const self = fromIter(iter);
        return if (self.generator.isValid()) php.SUCCESS else php.FAILURE;
    }

    pub fn getCurrentData(iter: *ObjectIterator) !*Value {
        const self = fromIter(iter);
        iter.data = self.generator.result;
        php.addRef(&iter.data);
        return &iter.data;
    }

    pub fn getCurrentKey(iter: *ObjectIterator, key_ptr: *Value) void {
        key_ptr.* = php.createValueLong(@intCast(iter.index));
    }

    pub fn moveForward(iter: *ObjectIterator) !void {
        const self = fromIter(iter);
        if (try self.generator.moveForward()) {
            iter.index += 1;
        }
    }

    pub fn rewind(iter: *ObjectIterator) !void {
        const self = fromIter(iter);
        if (try self.generator.rewind()) {
            iter.index += 0;
        }
    }

    const functions: ObjectIteratorFunctions = .{
        .dtor = php.transform(destroy),
        .valid = php.transform(isValid),
        .get_current_data = php.transform(getCurrentData),
        .get_current_key = php.transform(getCurrentKey),
        .move_forward = php.transform(moveForward),
        .rewind = php.transform(rewind),
    };
};
