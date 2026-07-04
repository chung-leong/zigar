const std = @import("std");

const AbortSignal = @import("../abort-signal.zig").AbortSignal;
const accessor = @import("../accessor.zig");
const Transform = accessor.Transform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const failure = @import("../failure.zig");
const Error = failure.Error;
const Generator = @import("../generator.zig").Generator;
const interface = @import("../module/native/interface.zig");
const MemberType = interface.MemberType;
const ZigObject = @import("../object.zig").ZigObject;
const getObjectBuffer = @import("../object.zig").getObjectBuffer;
const php = @import("../php.zig");
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const Promise = @import("../promise.zig").Promise;
const structure = @import("../structure.zig");
const Pointer = structure.Pointer;

pub const VariadicStruct = struct {
    attributes: []ArgAttributes = &.{},
    table: Value = undefined,
    buffer: *ByteBuffer = undefined,

    pub const Super = structure.Parent(@This());
    pub const Static = struct {
        arg_members: []*ZigClassEntry.Member = undefined,
        last_arg_optional: bool = false,
        first_variadic_slot: usize = 0,
        retval_accessors: *accessor.Any = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            var iter = class.getMemberIterator(.instance);
            if (iter.len == 0) return error.Unexpected;
            var arg_count: usize = 0;
            var last_arg_class: *ZigClassEntry = undefined;
            _ = iter.next(); // first member is retval
            var variadic_slot: usize = 0;
            while (iter.next()) |member| {
                switch (member.class.purpose) {
                    else => {
                        arg_count += 1;
                        last_arg_class = member.class;
                    },
                }
                if (member.slot) |slot| variadic_slot = slot + 1;
            }
            iter.reset();
            self.arg_members = try php.allocator.alloc(*ZigClassEntry.Member, arg_count);
            const retval_member = iter.next().?;
            self.retval_accessors = &retval_member.accessors;
            var index: usize = 0;
            while (iter.next()) |member| {
                self.arg_members[index] = member;
                index += 1;
            }
            if (arg_count > 0) {
                // allow omission of last argument if it's a struct with no required fields
                if (last_arg_class.type == .@"struct") {
                    const static = last_arg_class.getStaticData(structure.Struct);
                    self.last_arg_optional = static.required_field_count == 0;
                }
            }
            self.first_variadic_slot = variadic_slot;
        }

        pub fn deinit(self: *@This()) void {
            php.allocator.free(self.arg_members);
        }
    };
    pub const ArgAttributes = extern struct {
        offset: u16,
        bit_size: u16,
        alignment: u16,
        is_float: bool,
        is_signed: bool,

        pub fn set(self: *@This(), offset: usize, bit_size: usize, alignment: std.mem.Alignment, member_type: MemberType) void {
            self.* = .{
                .offset = @intCast(offset),
                .bit_size = @intCast(bit_size),
                .alignment = @intCast(alignment.toByteUnits()),
                .is_float = member_type == .float,
                .is_signed = member_type == .int or member_type == .float,
            };
        }
    };

    pub fn copyArguments(self: *@This(), allocator: ?*std.mem.Allocator, arg_iter: *php.ArgumentIterator) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const max_arg_count = static.arg_members.len;
        const min_arg_count = if (static.last_arg_optional) max_arg_count - 1 else max_arg_count;
        const arg_count = arg_iter.len;
        if (arg_count < min_arg_count) {
            return error.IncorrectArgumentCount;
        }
        const al = allocator orelse &php.allocator;
        var struct_size = class.byte_size.?;
        var arg_index: usize = 0;
        self.attributes = try al.alloc(ArgAttributes, arg_count);
        errdefer {
            al.free(self.attributes);
            self.attributes = &.{};
        }
        var variadic_slot = static.first_variadic_slot;
        while (arg_iter.next()) |arg| : (arg_index += 1) {
            if (arg_index < max_arg_count) {
                const member = static.arg_members[arg_index];
                self.attributes[arg_index].set(
                    member.bit_offset.? / 8,
                    member.bit_size,
                    member.class.alignment,
                    member.type,
                );
            } else {
                const arg_class = get: {
                    if (php.getValueObject(arg) catch null) |obj| {
                        if (ZigClassEntry.isZig(obj.ce)) {
                            break :get ZigClassEntry.fromEntry(obj.ce);
                        }
                    }
                    const arg_type = php.getValueType(arg);
                    return failure.report("variadic arguments must be Zig objects, received: {s}", .{
                        @tagName(arg_type),
                    });
                };
                switch (arg_class.type) {
                    .primitive => {
                        const member = try arg_class.getMember(.instance, 0);
                        const offset = arg_class.alignment.forward(struct_size);
                        struct_size = offset + member.byte_size.?;
                        self.attributes[arg_index].set(
                            offset,
                            member.bit_size,
                            arg_class.alignment,
                            member.type,
                        );
                    },
                    else => {
                        const alignment: std.mem.Alignment = .fromByteUnits(@alignOf(*anyopaque));
                        const offset = alignment.forward(struct_size);
                        struct_size = offset + @sizeOf(*anyopaque);
                        self.attributes[arg_index].set(
                            offset,
                            @bitSizeOf(*anyopaque),
                            alignment,
                            .object,
                        );
                        try php.setPropertyRef(&self.table, variadic_slot, arg);
                        variadic_slot += 1;
                    },
                }
            }
        }
        try self.buffer.allocate(allocator, struct_size);
        arg_index = 0;
        arg_iter.reset();
        while (arg_iter.next()) |arg| : (arg_index += 1) {
            if (arg_index < max_arg_count) {
                const acc = static.arg_members[arg_index].accessors;
                try acc.set(self, arg);
            } else {
                const obj = php.getValueObject(arg) catch unreachable;
                const arg_class = ZigClassEntry.fromEntry(obj.ce);
                const offset: usize = self.attributes[arg_index].offset;
                switch (arg_class.type) {
                    inline else => |t| {
                        if (t == .@"comptime") return error.ComptimeValue;
                        const S = @field(structure.by_enum, @tagName(t));
                        if (!ZigObject(S).isInstance(obj)) return error.UnexpectedClass;
                        const arg_struct = S.fromObject(obj);
                        const arg_bytes = arg_struct.buffer.bytes;
                        if (t == .primitive or t == .pointer) {
                            const dest_bytes = self.buffer.bytes[offset .. offset + arg_bytes.len];
                            @memcpy(dest_bytes, arg_bytes);
                        } else {
                            const address_ptr: *usize = @ptrCast(@alignCast(self.buffer.bytes[offset..].ptr));
                            address_ptr.* = @intFromPtr(arg_bytes.ptr);
                        }
                    },
                }
            }
        }
    }

    pub fn getArgumentCount(self: *@This()) usize {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return static.arg_members.len;
    }

    pub fn getReturnValue(self: *@This()) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return try static.retval_accessors.get(self);
    }

    pub fn vivicatePointerTargets(self: *@This()) !void {
        try self.visitPointers(Pointer.vivificateTarget, .{}, .{
            .ignore_uncreated = false,
            .ignore_arguments = false,
            .ignore_return_value = false,
        });
    }

    pub fn detachFunctionThunks(self: *@This()) !void {
        try self.visitPointers(Pointer.detachFunctionThunk, .{}, .{ .ignore_arguments = false });
    }

    pub fn visitPointers(self: *@This(), cb: anytype, args: anytype, comptime options: structure.VisitOptions) Error!void {
        const class = ZigClassEntry.fromStructure(self);
        if (class.flags.common.has_pointer) {
            var iter = class.getMemberIterator(.instance);
            var index: usize = 0;
            while (iter.next()) |member| : (index += 1) {
                if (options.ignore_return_value and index == 0) continue;
                if (options.ignore_arguments and index != 0) continue;
                if (member.class.flags.common.has_pointer) {
                    if (try member.accessors.getObject(self, !options.ignore_uncreated)) |obj| {
                        try structure.invokeMethod(obj, "visitPointers", .{ cb, args, options });
                    }
                }
            }
        }
        const static = class.getStaticData(@This());
        const ht = try php.getValueHashTable(&self.table);
        var iter: HashTableIterator = .init(ht, .{});
        while (iter.next()) |entry| {
            const slot = iter.currentIndex().?;
            if (slot >= static.first_variadic_slot) {
                const obj = try php.getValueObject(entry);
                try structure.invokeMethod(obj, "visitPointers", .{ cb, args, options });
            }
        }
    }

    pub fn freeObject(obj: *Object) void {
        const self = fromObject(obj);
        if (self.attributes.len != 0) {
            const al = self.buffer.getAllocator() orelse &php.allocator;
            al.free(self.attributes);
        }
        return Super.freeObject(obj);
    }

    pub const setStorage = Super.setStorage;
    pub const getValue = Super.getValue;
    pub const propertyExists = Super.propertyExists;
    pub const getGarbageCollection = Super.getGarbageCollection;
    pub const fromObject = Super.fromObject;
    pub const fromValue = Super.fromValue;
};
