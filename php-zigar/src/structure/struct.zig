const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const StructurePurpose = @import("../enums.zig").StructurePurpose;
const Generator = @import("../generator.zig").Generator;
const GeneratorIterator = @import("../iterator.zig").GeneratorIterator;
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ClassEntry = php.ClassEntry;
const HashTable = php.HashTable;
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const ObjectIterator = php.ObjectIterator;
const String = php.String;
const Value = php.Value;
const Promise = @import("../promise.zig").Promise;
const structure = @import("../structure.zig");

pub const Struct = struct {
    table: Value = undefined,
    buffer: *ByteBuffer = undefined,

    pub const SpecialArgs = struct {
        allocator: ?Value = null,
        callback: ?Value = null,
        abort_signal: ?Value = null,
    };

    const Super = structure.StructLike(@This());

    pub const Static = struct {
        required_field_count: usize = 0,
        class_obj: *Object = undefined,
        callback: ?*Object = null,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            var iter = class.getMemberIterator(.instance);
            while (iter.next()) |member| {
                if (member.flags.is_required) self.required_field_count += 1;
            }
            // because methods are really static functions, we need to maintain a ref on the class object
            self.class_obj = class_obj;
            php.addRef(self.class_obj);
            switch (class.purpose) {
                inline .promise, .generator => |p| {
                    const closure = switch (p) {
                        .promise => Promise.getHandler(),
                        .generator => Generator.getHandler(),
                        else => unreachable,
                    };
                    const cb_member = try class.getMember(.instance, "callback");
                    if (cb_member.class.type != .pointer) return error.Unexpected;
                    const cb_obj = try cb_member.class.createObject(null, &closure);
                    self.callback = cb_obj;
                },
                else => {},
            }
        }

        pub fn deinit(self: *@This()) void {
            php.release(self.class_obj);
            if (self.callback) |cb| php.release(cb);
        }
    };

    pub fn checkArguments(self: *@This(), arg_iter: *php.ArgumentIterator) !void {
        if (arg_iter.len != 1) {
            // check if the struct has default values for all fields
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            if (arg_iter.len != 0 or static.required_field_count != 0) {
                return php.throwExceptionFmt("{s} constructor expects an array as argument or named arguments", .{
                    class.getStructureName(),
                });
            }
        }
    }

    pub fn readSelf(self: *@This(), transform: ObjectTransform) !Value {
        const class = ZigClassEntry.fromStructure(self);
        if (transform == .to_integer) {
            const flags = class.getFlags(@This());
            if (flags.is_packed) {
                // TODO: handle packed struct
                @panic("TODO");
            }
        }
        return Super.readSelf(self, transform);
    }

    pub fn initSpecial(self: *@This(), comptime T: type, args: SpecialArgs) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        switch (T) {
            std.mem.Allocator => {
                if (args.allocator) |av| {
                    const src_obj = try php.getValueObject(&av);
                    const src_class = ZigClassEntry.fromObject(src_obj);
                    if (src_class.type != .@"struct" or src_class.purpose != .allocator) {
                        return error.NotAllocator;
                    }
                    const src_struct = fromObject(src_obj);
                    try self.buffer.copy(src_struct.buffer);
                } else {
                    const byte_ptr: [*]u8 = @ptrCast(&class.host.allocator);
                    const bytes = byte_ptr[0..@sizeOf(std.mem.Allocator)];
                    try self.buffer.copyBytes(bytes);
                }
            },
            Promise, Generator => {
                const ctx = try T.create(args.callback);
                const ptr_member = try class.getMember(.instance, php.persistent("ptr"));
                const opaque_class = try ptr_member.class.getPointerTarget();
                const opaque_obj = try opaque_class.createPreinitializedObject(ctx.buffer, null);
                defer php.release(opaque_obj);
                const opaque_value = php.createValueObject(opaque_obj);
                try self.writeMember(php.persistent("ptr"), &opaque_value, null);
                const callback_value = php.createValueObject(static.callback.?);
                try self.writeMember(php.persistent("callback"), &callback_value, null);
                if (class.getMember(.instance, php.persistent("allocator"))) |m| {
                    const allocator_value = try m.accessors.get(self);
                    const allocator_obj = try php.getValueObject(&allocator_value);
                    defer php.release(allocator_obj);
                    const allocator_struct = ZigObject(structure.Struct).fromObject(allocator_obj).structure();
                    try allocator_struct.initSpecial(std.mem.Allocator, args);
                } else |_| {}
            },
            else => {},
        }
    }

    pub fn getSpecialContext(self: *@This(), comptime T: type) !*T {
        const target = try self.readMember(php.persistent("ptr"), null);
        return accessor.getOpaqueTarget(T, &target);
    }

    pub fn freeObject(obj: *Object) void {
        const class = ZigClassEntry.fromObject(obj);
        const self = fromObject(obj);
        // release the promise/generator context
        switch (class.purpose) {
            inline .promise, .generator => |t| {
                const T = switch (t) {
                    .promise => Promise,
                    .generator => Generator,
                    else => {},
                };
                if (self.getSpecialContext(T)) |ctx| ctx.release() else |_| {}
            },
            else => {},
        }
        Super.freeObject(obj);
    }

    pub fn getIterator(_: *ClassEntry, this: *Value, _: c_int) !?*ObjectIterator {
        const obj = try php.getValueObject(this);
        const class = ZigClassEntry.fromObject(obj);
        if (class.purpose == .generator) {
            return try GeneratorIterator.create(obj);
        }
        return null;
    }

    pub const getExtent = Super.getExtent;
    pub const initialize = Super.initialize;
    pub const writeSelf = Super.writeSelf;
    pub const castObject = Super.castObject;
    pub const getMethod = Super.getMethod;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getProperties = Super.getProperties;
    pub const getPropertyPointer = Super.getPropertyPointer;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const fromObject = Super.fromObject;
    const readMember = Super.readMember;
    const writeMember = Super.writeMember;
};
