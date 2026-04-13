const std = @import("std");

const Generator = @import("generator.zig").Generator;
const php = @import("php.zig");
const ClassEntry = php.ClassEntry;
const HashTable = php.HashTable;
const Object = php.Object;
const ObjectIterator = php.ObjectIterator;
const ObjectIteratorFunctions = php.ObjectIteratorFunctions;
const String = php.String;
const Value = php.Value;
const structure = @import("structure.zig");
const ZigObject = @import("object.zig").ZigObject;

pub fn ArrayIterator(comptime S: type) type {
    return struct {
        iter: ObjectIterator,
        object: *Object,
        len: php.Long,

        fn fromIter(iter: *ObjectIterator) *@This() {
            return @fieldParentPtr("iter", iter);
        }

        pub fn create(obj: *Object) !*ObjectIterator {
            const self = try php.allocator.create(@This());
            const array = ZigObject(S).fromObject(obj).structure();
            php.initializeIterator(&self.iter);
            php.addRef(obj);
            self.object = obj;
            self.len = @intCast(array.getLength());
            self.iter.funcs = &methods;
            self.iter.data = php.createValueNull();
            return &self.iter;
        }

        pub fn destroy(iter: *ObjectIterator) void {
            const self = fromIter(iter);
            php.release(&iter.data);
            php.release(self.object);
        }

        pub fn isValid(iter: *ObjectIterator) !c_int {
            const self = fromIter(iter);
            return if (iter.index < self.len) php.SUCCESS else php.FAILURE;
        }

        pub fn getCurrentData(iter: *ObjectIterator) *Value {
            const self = fromIter(iter);
            const container = ZigObject(S).fromObject(self.object).structure();
            php.release(&iter.data);
            iter.data = container.getElement(iter.index) catch |err| init: {
                _ = &err;
                break :init php.createValueNull();
            };
            return &iter.data;
        }

        pub fn getCurrentKey(iter: *ObjectIterator, key_ptr: *Value) void {
            key_ptr.* = php.createValueLong(@intCast(iter.index));
        }

        pub fn moveForward(_: *ObjectIterator) void {}

        const methods: ObjectIteratorFunctions = .{
            .dtor = php.transform(destroy),
            .valid = php.transform(isValid),
            .get_current_data = php.transform(getCurrentData),
            .get_current_key = php.transform(getCurrentKey),
            .move_forward = php.transform(moveForward),
        };
    };
}

pub fn PropertyIterator(comptime S: type) type {
    return struct {
        iter: ObjectIterator,
        lists: [2][]*String,
        object: *Object,

        fn fromIter(iter: *ObjectIterator) *@This() {
            return @fieldParentPtr("iter", iter);
        }

        pub fn create(obj: *Object, list1: []*String, list2: []*String) !*ObjectIterator {
            const self = try php.allocator.create(@This());
            php.initializeIterator(&self.iter);
            php.addRef(obj);
            self.object = obj;
            self.lists = .{ list1, list2 };
            self.iter.funcs = &methods;
            self.iter.data = php.createValueNull();
            return &self.iter;
        }

        pub fn destroy(iter: *ObjectIterator) void {
            const self = fromIter(iter);
            php.release(&iter.data);
            php.release(self.object);
        }

        pub fn isValid(iter: *ObjectIterator) !c_int {
            const self = fromIter(iter);
            return if (self.findName() != null) php.SUCCESS else php.FAILURE;
        }

        pub fn getCurrentData(iter: *ObjectIterator) *Value {
            const self = fromIter(iter);
            php.release(&iter.data);
            if (self.findValue()) |value| {
                iter.data = value;
            } else {
                iter.data = php.createValueNull();
            }
            return &iter.data;
        }

        pub fn getCurrentKey(iter: *ObjectIterator, key_ptr: *Value) void {
            const self = fromIter(iter);
            if (self.findName()) |name| {
                php.addRef(name);
                key_ptr.* = php.createValueString(name);
            } else {
                key_ptr.* = php.createValueNull();
            }
        }

        pub fn moveForward(_: *ObjectIterator) void {}

        fn findName(self: @This()) ?*String {
            var index = self.iter.index;
            const active_list = for (self.lists) |list| {
                if (index < list.len) break list;
                index -= list.len;
            } else return null;
            return active_list[index];
        }

        fn findValue(self: @This()) ?Value {
            const name = self.findName() orelse return null;
            const container = ZigObject(S).fromObject(self.object).structure();
            return container.getProperty(name, null) catch null;
        }

        const methods: ObjectIteratorFunctions = .{
            .dtor = php.transform(destroy),
            .valid = php.transform(isValid),
            .get_current_data = php.transform(getCurrentData),
            .get_current_key = php.transform(getCurrentKey),
            .move_forward = php.transform(moveForward),
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
        self.iter.funcs = &methods;
        return &self.iter;
    }

    pub fn destroy(iter: *ObjectIterator) void {
        const self = fromIter(iter);
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
        try self.generator.moveForward();
    }

    pub fn rewind(iter: *ObjectIterator) !void {
        const self = fromIter(iter);
        try self.generator.rewind();
    }

    const methods: ObjectIteratorFunctions = .{
        .dtor = php.transform(destroy),
        .valid = php.transform(isValid),
        .get_current_data = php.transform(getCurrentData),
        .get_current_key = php.transform(getCurrentKey),
        .move_forward = php.transform(moveForward),
        .rewind = php.transform(rewind),
    };
};

pub const IteratorIterator = struct {
    iter: ObjectIterator,
    iter_object: *Object,
    flags: packed struct {
        moved: bool = false,
        valid: bool = false,
    },

    fn fromIter(iter: *ObjectIterator) *@This() {
        return @fieldParentPtr("iter", iter);
    }

    pub fn create(obj: *Object) !*ObjectIterator {
        const self = try php.allocator.create(@This());
        php.addRef(obj);
        php.initializeIterator(&self.iter);
        self.iter_object = obj;
        self.iter.funcs = &methods;
        self.flags = .{};
        return &self.iter;
    }

    pub fn destroy(iter: *ObjectIterator) void {
        const self = fromIter(iter);
        php.release(self.iter_object);
    }

    pub fn isValid(iter: *ObjectIterator) !c_int {
        const self = fromIter(iter);
        return if (self.flags.valid) php.SUCCESS else php.FAILURE;
    }

    pub fn getCurrentData(iter: *ObjectIterator) !*Value {
        php.addRef(&iter.data);
        return &iter.data;
    }

    pub fn getCurrentKey(iter: *ObjectIterator, key_ptr: *Value) void {
        key_ptr.* = php.createValueLong(@intCast(iter.index));
    }

    pub fn moveForward(iter: *ObjectIterator) !void {
        const self = fromIter(iter);
        defer self.flags.moved = true;
        if (self.flags.valid) {
            php.release(&self.iter.data);
            self.flags.valid = false;
        }
        if (self.call("next")) |result| {
            if (!php.isValueNull(&result)) {
                self.iter.data = result;
                self.flags.valid = true;
            }
        } else |err| {
            return err;
        }
    }

    pub fn rewind(iter: *ObjectIterator) !void {
        const self = fromIter(iter);
        if (self.flags.moved) {
            if (self.call("reset")) |_| {
                self.flags.moved = false;
            } else |_| {
                return;
            }
        }
        try moveForward(iter);
    }

    fn call(self: *@This(), comptime method: []const u8) !Value {
        const obj_value = php.createValueObject(self.iter_object);
        const method_value = php.createValuePersistentString(method);
        return php.invokeMethod(&obj_value, &method_value, &.{});
    }

    const methods: ObjectIteratorFunctions = .{
        .dtor = php.transform(destroy),
        .valid = php.transform(isValid),
        .get_current_data = php.transform(getCurrentData),
        .get_current_key = php.transform(getCurrentKey),
        .move_forward = php.transform(moveForward),
        .rewind = php.transform(rewind),
    };
};
