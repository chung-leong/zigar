const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const failure = @import("../failure.zig");
const Error = failure.Error;
const js_compat = @import("../js-compat.zig");
const TypedArrayOf = js_compat.TypedArrayOf;
const TypedArray = js_compat.TypedArray;
const getObjectBuffer = @import("../object.zig").getObjectBuffer;
const php = @import("../php.zig");
const ClassEntry = php.ClassEntry;
const Function = php.Function;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");
const invokeMethod = structure.invokeMethod;

pub const Pointer = struct {
    last_address: usize = 0,
    last_length: usize = 0,
    max_length: usize = 1,
    table: Value = undefined,
    buffer: *ByteBuffer = undefined,

    pub const Super = structure.OptionalLike(@This());
    pub const Static = struct {
        target_class: *ZigClassEntry = undefined,
        address_acc: *accessor.Int(.{ .bit_size = @bitSizeOf(usize), .signedness = .unsigned }) = undefined,
        length_acc: ?*accessor.Int(.{ .bit_size = @bitSizeOf(usize), .signedness = .unsigned }) = null,

        pub const props = .{.child};
        pub const prefix = "__";
        pub const aliases = .{};

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const target_member = try class.getMember(.instance, 0);
            self.target_class = target_member.class;
            const address_member = try class.getMember(.instance, 1);
            const usize_tag = switch (@bitSizeOf(usize)) {
                64 => .u64,
                32 => .u32,
                else => @compileError("Unsupported pointer size"),
            };
            if (address_member.accessors != usize_tag) return error.Unexpected;
            self.address_acc = &@field(address_member.accessors, @tagName(usize_tag));
            self.address_acc.runtime_check = false;
            if (class.getMember(.instance, 2) catch null) |length_member| {
                if (length_member.accessors != usize_tag) return error.Unexpected;
                self.length_acc = &@field(length_member.accessors, @tagName(usize_tag));
                self.length_acc.?.runtime_check = false;
            }
        }

        pub fn loadTarget(self: *@This(), pointer: *Pointer) !void {
            const address_value = try self.address_acc.get(pointer.buffer);
            const address: usize = try php.getValueUsize(&address_value);
            const length: usize = if (self.target_class.type == .slice) get: {
                if (self.length_acc) |acc| {
                    const value = try acc.get(pointer.buffer);
                    break :get @intCast(try php.getValueLong(&value));
                } else if (self.target_class.flags.slice.has_sentinel) {
                    const slice_static = self.target_class.getStaticData(structure.Slice);
                    const ptr: [*]u8 = @ptrFromInt(address);
                    break :get slice_static.findSentinelIndex(ptr);
                } else {
                    break :get pointer.max_length;
                }
            } else 1;
            if (pointer.last_address != address or pointer.last_length != length) {
                const previous = pointer.table;
                defer php.release(&previous);
                if (address != 0) {
                    const class = ZigClassEntry.fromStatic(self);
                    const flags = class.getFlags(Pointer);
                    const byte_size = length * (self.target_class.byte_size orelse 1);
                    const target = try self.target_class.obtainObjectAtAddress(address, byte_size, flags.is_const);
                    if (pointer.last_address != address and self.target_class.type == .slice) {
                        // remember the original length
                        pointer.max_length = length;
                    }
                    pointer.table = php.createValueObject(target);
                } else {
                    pointer.table = php.createValueNull();
                }
                pointer.last_address = address;
                pointer.last_length = length;
            }
        }

        pub fn saveTarget(self: *@This(), pointer: *Pointer, target_obj: *Object) !void {
            php.release(&pointer.table);
            pointer.table = php.createValueObject(target_obj);
            const extent = try invokeMethod(target_obj, "getExtent", .{});
            try self.setAddress(pointer, extent.address);
            try self.setLength(pointer, extent.len);
            pointer.last_address = extent.address;
            pointer.last_length = extent.len;
            pointer.max_length = extent.len;
        }

        pub fn getAddress(self: *@This(), pointer: *Pointer) !usize {
            const address_value = try self.address_acc.get(pointer.buffer);
            return try php.getValueUsize(&address_value);
        }

        pub fn setAddress(self: *@This(), pointer: *Pointer, address: usize) !void {
            const address_value = php.createValueLong(@bitCast(address));
            try self.address_acc.set(pointer.buffer, &address_value);
        }

        pub fn setLength(self: *@This(), pointer: *Pointer, len: usize) !void {
            if (self.length_acc) |acc| {
                const len_value = php.createValueLong(@bitCast(len));
                try acc.set(pointer.buffer, &len_value);
            }
        }

        pub fn getStaticProperty(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) !Value {
            const class = ZigClassEntry.fromStatic(self);
            const id_cache = class.getIdCache(Static.props, Static.prefix, Static.aliases);
            if (id_cache.idFromString(name, cache_slot)) |id| {
                const prop_obj = switch (id) {
                    .child => self.target_class.object,
                };
                return php.createValueObject(php.reuse(prop_obj));
            } else {
                return error.Missing;
            }
        }

        pub fn staticPropertyExists(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) bool {
            const class = ZigClassEntry.fromStatic(self);
            const id_cache = class.getIdCache(Static.props, Static.prefix, Static.aliases);
            return id_cache.idFromString(name, cache_slot) != null;
        }
    };
    pub const props = .{ .target, .length };
    pub const prefix = "__";
    pub const aliases = .{ .@"*" = .target };

    pub fn getValue(self: *@This(), transform: accessor.Transform) Error!Value {
        const target_obj = try self.getTarget();
        return switch (transform) {
            .none => php.createValueObject(php.reuse(target_obj)),
            else => try invokeMethod(target_obj, "getValue", .{transform}),
        };
    }

    pub fn setValue(self: *@This(), value: *const Value, transform: accessor.Transform) Error!void {
        if (self.buffer.flags.inaccessible) {
            if (!php.isValueNull(value)) return self.reportInaccessiblePointer();
        }
        if (transform == .none) {
            const class = ZigClassEntry.fromStructure(self);
            const read_only = class.flags.pointer.is_const;
            const static = class.getStaticData(@This());
            const target_obj = init: {
                const target_class = static.target_class;
                switch (php.getValueType(value)) {
                    .object => {
                        var obj = php.getValueObject(value) catch unreachable;
                        const obj_class = ZigClassEntry.fromObject(obj);
                        if (obj_class.type == .pointer) {
                            const ptr_struct = structure.Pointer.fromObject(obj);
                            obj = try ptr_struct.getTarget();
                        }
                        if (php.instanceOf(obj, target_class.entry())) {
                            // pointing to existing object
                            const buf = getObjectBuffer(obj);
                            if (buf.flags.uninitialized) return error.AccessingDeallocatedMemory;
                            // make sure it's writable when the pointer is non-const
                            if (!read_only and buf.flags.read_only) {
                                return failure.report("'{s}' cannot point to a read-only object", .{
                                    class.getName(),
                                });
                            } else if (read_only and !buf.flags.read_only) {
                                // create a read-only version of the object unless the pointer is transient
                                // (i.e. in an argument struct)
                                if (!self.buffer.flags.transient) {
                                    obj = try target_class.obtainReadOnlyObject(buf);
                                }
                            }
                            break :init php.reuse(obj);
                        }
                        // only extract buffer from a TypedArray if it's compatible with the class
                        if (target_class.extractBuffer(obj, true)) |buf| {
                            if (buf.flags.read_only and !read_only) {
                                return failure.report("pointer '{s}' cannot pointer to a read-only buffer", .{
                                    class.getName(),
                                });
                            }
                            try target_class.validateBuffer(buf);
                            const new_obj = try target_class.obtainObjectFromBuffer(buf, null);
                            break :init new_obj;
                        }
                        // TODO: deal with array -> slice cast
                    },
                    .pointer => {
                        const ptr = php.getValuePointer(*anyopaque, value) catch unreachable;
                        const address = @intFromPtr(ptr);
                        try static.setAddress(self, address);
                        return;
                    },
                    .null => {
                        if (!class.flags.pointer.is_nullable) {
                            return failure.report("pointer '{s}' cannot be null", .{
                                class.getName(),
                            });
                        }
                        php.release(&self.table);
                        self.table = php.createValueNull();
                        try static.setAddress(self, 0);
                        return;
                    },
                    .array => {
                        const ht = php.getValueArray(value) catch unreachable;
                        if (!class.flags.pointer.is_single and !php.isNormalArray(ht)) {
                            return failure.report("target of '{s}' expects an array with numeric keys", .{
                                class.getName(),
                            });
                        }
                    },
                    else => {},
                }
                // autovivificate new target, using the allocator associated with the pointer
                const allocator = self.buffer.getAllocator();
                const new_obj = try target_class.createObject(allocator, value, read_only);
                break :init new_obj;
            };
            errdefer php.release(target_obj);
            if (self.buffer.inZigMemory()) {
                // pointer in Zig memory cannot point to garbage-collected memory
                const target_buf = getObjectBuffer(target_obj);
                if (!target_buf.inZigMemory()) {
                    return failure.report("pointers in Zig memory cannot point to garbage-collected object", .{});
                }
            }
            try static.saveTarget(self, target_obj);
        } else {
            return Super.setValue(self, value, transform);
        }
    }

    pub fn getAddress(self: *@This()) !usize {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return try static.getAddress(self);
    }

    pub fn visitPointers(self: *@This(), cb: anytype, args: anytype, comptime _: structure.VisitOptions) Error!void {
        try @call(.auto, cb, .{self} ++ args);
    }

    pub fn getProperty(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) Error!Value {
        const target_obj = try self.getTarget();
        const class = ZigClassEntry.fromStructure(self);
        const id_cache = class.getIdCache(props, prefix, aliases);
        if (id_cache.idFromString(name, cache_slot)) |id| {
            const static = class.getStaticData(@This());
            switch (id) {
                .target => {
                    return if (static.target_class.flags.common.has_value)
                        invokeMethod(target_obj, "getValue", .{.none})
                    else
                        php.createValueObject(php.reuse(target_obj));
                },
                .length => {
                    if (!class.flags.pointer.is_multiple) return error.Missing;
                    return php.createValueAnyInt(self.last_length);
                },
            }
        } else {
            if (self.isPointerToPointer()) return self.reportNoAutoDereference();
            return try invokeMethod(target_obj, "getProperty", .{ name, cache_slot });
        }
    }

    pub fn setProperty(self: *@This(), name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) Error!void {
        const target_obj = try self.getTarget();
        const class = ZigClassEntry.fromStructure(self);
        const id_cache = class.getIdCache(props, prefix, aliases);
        if (id_cache.idFromString(name, cache_slot)) |id| {
            const static = class.getStaticData(@This());
            switch (id) {
                .target => {
                    try invokeMethod(target_obj, "setValue", .{ value, .none });
                },
                .length => {
                    if (!class.flags.pointer.is_multiple) return error.Missing;
                    if (static.target_class.flags.slice.has_sentinel) return error.WriteProtected;
                    const len: usize = try php.getValueUlong(value);
                    if (static.length_acc != null) {
                        if (len > self.max_length) return error.OutOfBound;
                        try static.setLength(self, len);
                    } else {
                        const max_length = get: {
                            const slice_struct = structure.Slice.fromObject(target_obj);
                            const max = slice_struct.buffer.getMaximumExtent();
                            const available = (max.address + max.len) - self.last_address;
                            const element_size = static.target_class.byte_size orelse 1;
                            break :get available / element_size;
                        };
                        if (len > max_length) return error.OutOfBound;
                        self.max_length = len;
                    }
                },
            }
        } else {
            if (self.isPointerToPointer()) return self.reportNoAutoDereference();
            try invokeMethod(target_obj, "setProperty", .{ name, value, cache_slot });
        }
    }

    pub fn propertyExists(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) bool {
        const class = ZigClassEntry.fromStructure(self);
        const id_cache = class.getIdCache(props, prefix, aliases);
        return id_cache.idFromString(name, cache_slot) != null or check: {
            const target_obj = self.getTarget() catch return false;
            if (self.isPointerToPointer()) return false;
            break :check invokeMethod(target_obj, "propertyExists", .{ name, cache_slot }) catch unreachable;
        };
    }

    pub fn vivificateTarget(self: *@This()) Error!void {
        const prev = self.table;
        const target_obj = self.getTarget() catch return;
        if (prev.value.obj != self.table.value.obj) {
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            if (static.target_class.flags.common.has_pointer) {
                try invokeMethod(target_obj, "visitPointers", .{
                    vivificateTarget,
                    .{},
                    structure.VisitOptions{
                        .ignore_uncreated = false,
                        .ignore_arguments = false,
                        .ignore_return_value = false,
                    },
                });
            }
        }
    }

    pub fn externalizeTarget(self: *@This()) Error!void {
        const target_obj = php.getValueObject(&self.table) catch return;
        try invokeMethod(target_obj, "externalize", .{});
    }

    pub fn detachFunctionThunk(self: *@This()) Error!void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        if (static.target_class.type == .function) {
            const func_struct = structure.Function.fromValue(&self.table) catch return;
            func_struct.detachThunk();
        }
    }

    pub fn restrictAccess(self: *@This()) !void {
        self.buffer.flags.inaccessible = true;
    }

    pub fn getTarget(self: *@This()) !*Object {
        if (self.buffer.flags.inaccessible) return self.reportInaccessiblePointer();
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        try static.loadTarget(self);
        return php.getValueObject(&self.table) catch return error.NullPointer;
    }

    pub fn getChildObject(self: *@This()) ?*Object {
        return self.getTarget() catch return null;
    }

    pub fn getCallable(self: *@This()) !*php.Function {
        const target_obj = try self.getTarget();
        const target_class = ZigClassEntry.fromObject(target_obj);
        if (target_class.type != .function) return error.NotFunction;
        const func_struct = structure.Function.fromObject(target_obj);
        return func_struct.getCallable();
    }

    pub fn getClosure(obj: *Object, ce: *[*c]ClassEntry, func: *[*c]Function, this: ?*[*c]Object, _: bool) c_int {
        const self = fromObject(obj);
        func.* = self.getCallable() catch return php.FAILURE;
        ce.* = obj.ce;
        if (this) |ptr| ptr.* = obj;
        return php.SUCCESS;
    }

    pub fn compare(a: *Value, b: *Value) !c_int {
        const op1 = try resolveReference(a);
        const op2 = try resolveReference(b);
        return php.compareValues(&op1, &op2);
    }

    pub fn doOperation(opcode: php.Uchar, retval: *Value, a: *Value, b: *Value) !c_int {
        const op1 = try resolveReference(a);
        const op2 = try resolveReference(b);
        retval.* = try php.performOperation(opcode, &op1, &op2);
        return php.SUCCESS;
    }

    fn isPointerToPointer(self: *@This()) bool {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return static.target_class.type == .pointer;
    }

    fn resolveReference(operand: *Value) !Value {
        if (php.getValueObject(operand) catch null) |ptr_obj| {
            if (ZigClassEntry.isZigInstance(ptr_obj)) {
                const class = ZigClassEntry.fromObject(ptr_obj);
                if (class.type == .pointer) {
                    const self = fromObject(ptr_obj);
                    const target_obj = try self.getTarget();
                    return php.createValueObject(target_obj);
                }
            }
        }
        return operand.*;
    }

    fn reportInaccessiblePointer(_: *@This()) error{FailureReported} {
        return failure.report("pointer is inaccessible because it's in an untagged union", .{});
    }

    fn reportNoAutoDereference(self: *@This()) error{FailureReported} {
        const class = ZigClassEntry.fromStructure(self);
        return failure.report("cannot access properties through pointer '{s}', only one level of automatic dereferencing", .{
            class.getName(),
        });
    }

    pub const getExtent = Super.getExtent;
    pub const setStorage = Super.setStorage;
    pub const initialize = Super.initialize;
    pub const finalize = Super.finalize;
    pub const externalize = Super.externalize;
    pub const checkArguments = Super.checkArguments;
    pub const getElement = Super.getElement;
    pub const setElement = Super.setElement;
    pub const getLength = Super.getLength;
    pub const findMethod = Super.findMethod;
    pub const getConstructor = Super.getConstructor;
    pub const cloneObject = Super.cloneObject;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getProperties = Super.getProperties;
    pub const getPropertyPointer = Super.getPropertyPointer;
    pub const readElement = Super.readElement;
    pub const writeElement = Super.writeElement;
    pub const hasElement = Super.hasElement;
    pub const countElements = Super.countElements;
    pub const getMethod = Super.getMethod;
    pub const getGarbageCollection = Super.getGarbageCollection;
    pub const getIterator = Super.getIterator;
    pub const fromObject = Super.fromObject;
    pub const fromValue = Super.fromValue;
};
