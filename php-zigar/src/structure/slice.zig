const std = @import("std");

const accessor = @import("../accessor.zig");
const Transform = accessor.Transform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const cache = @import("../cache.zig");
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const Error = @import("../failure.zig").Error;
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Slice = struct {
    table: Value = undefined,
    buffer: *ByteBuffer = undefined,

    pub const Super = structure.ArrayLike(@This());
    pub const Static = struct {
        value_acc: *accessor.Any = undefined,
        element_class: *ZigClassEntry = undefined,
        element_size: usize = undefined,
        element_shift: ?u6 = undefined,
        sentinel: struct {
            buffer: *ByteBuffer,
            accessors: *accessor.Any,
        } = undefined,

        pub const StaticPropCache = cache.IdCache(.{.child}, "__", .{});

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const member = try class.getMember(.instance, 0);
            self.value_acc = &member.accessors;
            self.element_class = member.class;
            self.element_size = class.byte_size orelse 1;
            self.element_shift = init: {
                const shift = std.math.log2_int(usize, self.element_size);
                const one: usize = 1;
                break :init if (one << shift == self.element_size) shift else null;
            };
            if (class.flags.slice.has_sentinel) {
                const sentinel_member = class.getMember(.instance, 1) catch return error.Unexpected;
                self.sentinel = .{
                    .buffer = class.instance.template.buffer orelse return error.Unexpected,
                    .accessors = &sentinel_member.accessors,
                };
            }
        }

        pub fn getStaticProperty(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) !Value {
            if (StaticPropCache.idFromString(name, cache_slot)) |id| {
                return switch (id) {
                    .child => get: {
                        php.addRef(self.element_class.object);
                        break :get php.createValueObject(self.element_class.object);
                    },
                };
            } else {
                return error.Missing;
            }
        }

        pub fn staticPropertyExists(_: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) bool {
            return StaticPropCache.idFromString(name, cache_slot) != null;
        }

        pub fn findSentinelIndex(self: *@This(), ptr: [*]const u8) usize {
            const sentinel_bytes = self.sentinel.buffer.bytes;
            const end = std.math.maxInt(usize) - @intFromPtr(ptr) - sentinel_bytes.len;
            var i: usize = 0;
            var j: usize = 0;
            while (j < end) : (j += sentinel_bytes.len) {
                const element_slice = ptr[j .. j + sentinel_bytes.len];
                if (std.mem.eql(u8, element_slice, sentinel_bytes)) {
                    return i;
                }
                i += 1;
            }
            return 0;
        }
    };

    pub fn initialize(self: *@This(), allocator: ?*const std.mem.Allocator, initializer: ?*const Value, read_only: bool) !void {
        const class = ZigClassEntry.fromStructure(self);
        if (initializer) |value| {
            // anyopaque is represented by a slice with no size
            const element_size = class.byte_size orelse 1;
            if (php.getValueString(value) catch null) |str| {
                if (class.flags.slice.is_string or class.flags.slice.is_opaque) {
                    const str_bytes = php.getStringContent(str);
                    if (element_size == 1) {
                        const using_string = use: {
                            if (!read_only) break :use false;
                            if (class.flags.slice.has_sentinel) {
                                // make sure sentinel is present
                                const static = class.getStaticData(@This());
                                const sentinel_bytes = static.sentinel.buffer.bytes;
                                const end = str_bytes.len;
                                const sentinel_end = end + sentinel_bytes.len;
                                const element_slice = str_bytes.ptr[end..sentinel_end];
                                if (!std.mem.eql(u8, element_slice, sentinel_bytes)) {
                                    break :use false;
                                }
                            }
                            self.buffer.referenceString(str, read_only);
                            break :use true;
                        };
                        if (!using_string) {
                            try self.initializeBuffer(allocator, str_bytes.len);
                            try self.buffer.copyBytes(str_bytes);
                        }
                    } else if (element_size == 2) {
                        const len = std.unicode.calcWtf16LeLen(str_bytes) catch return error.IncorrectEncoding;
                        try self.initializeBuffer(allocator, len * 2);
                        const bytes = try self.buffer.data(0, true);
                        const wtf16_ptr: [*]u16 = @ptrCast(@alignCast(bytes.ptr));
                        const wtf16_slice = wtf16_ptr[0..len];
                        _ = std.unicode.wtf8ToWtf16Le(wtf16_slice, str_bytes) catch return error.IncorrectEncoding;
                    } else unreachable;
                    return;
                }
            }
            const element_count: usize, const copy = get: {
                if (php.getValueLong(value) catch null) |long| {
                    // initialize array to a specific length
                    if (long < 0) return error.NegativeValue;
                    break :get .{ @intCast(long), false };
                } else if (php.getValueArray(value) catch null) |arr| {
                    // initialize with an array
                    break :get .{ if (php.isNormalArray(arr)) arr.nNumOfElements else 1, true };
                } else {
                    // let setValue() throw an error
                    break :get .{ 0, true };
                }
            };
            try self.initializeBuffer(allocator, element_size * element_count);
            if (copy) try self.setValue(value, .none) else try self.buffer.clear();
            if (read_only) self.buffer.protect();
        } else {
            try self.initializeBuffer(allocator, 0);
        }
    }

    pub fn getExtent(self: *@This()) ByteBuffer.Extent {
        return .{
            .address = @intFromPtr(self.buffer.bytes.ptr),
            .len = self.getLength(),
        };
    }

    pub fn getLength(self: *@This()) usize {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const len = self.buffer.bytes.len;
        return if (static.element_shift) |shift|
            len >> shift
        else
            len / static.element_size;
    }

    pub fn getElement(self: *@This(), index: usize) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return try static.value_acc.getElement(self, index);
    }

    pub fn getElementEx(self: *@This(), index: usize, transform: ?Transform) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return try static.value_acc.getElementEx(self, index, transform);
    }

    pub fn setElement(self: *@This(), index: usize, value: *const Value) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        try static.value_acc.setElement(self, index, value);
    }

    pub fn setValue(self: *@This(), value: *const Value, transform: accessor.Transform) Error!void {
        if (transform == .none) {
            if (php.getValueArray(value) catch null) |ht| {
                if (!php.isNormalArray(ht)) {
                    const array = php.createArray();
                    _ = php.appendHashEntryRef(array, value);
                    const array_value = php.createValueArray(array);
                    defer php.release(array);
                    return Super.setValue(self, &array_value, transform);
                }
            }
        }
        return Super.setValue(self, value, transform);
    }

    fn initializeBuffer(self: *@This(), allocator: ?*const std.mem.Allocator, content_len: usize) !void {
        const class = ZigClassEntry.fromStructure(self);
        if (class.flags.slice.has_sentinel) {
            // allocate extra space for the sentinel
            const static = class.getStaticData(@This());
            const sentinel_bytes = static.sentinel.buffer.bytes;
            const buf = try ByteBuffer.create(self.buffer.alignment);
            defer buf.release();
            try buf.allocate(allocator, content_len + sentinel_bytes.len);
            @memcpy(buf.bytes[content_len..], sentinel_bytes);
            self.buffer.referenceBuffer(buf, 0, content_len);
        } else {
            try self.buffer.allocate(allocator, content_len);
        }
    }

    pub const setStorage = Super.setStorage;
    pub const finalize = Super.finalize;
    pub const externalize = Super.externalize;
    pub const checkArguments = Super.checkArguments;
    pub const getValue = Super.getValue;
    pub const getProperty = Super.getProperty;
    pub const setProperty = Super.setProperty;
    pub const propertyExists = Super.propertyExists;
    pub const visitPointers = Super.visitPointers;
    pub const getConstructor = Super.getConstructor;
    pub const readElement = Super.readElement;
    pub const writeElement = Super.writeElement;
    pub const hasElement = Super.hasElement;
    pub const countElements = Super.countElements;
    pub const getProperties = Super.getProperties;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getPropertyPointer = Super.getPropertyPointer;
    pub const compare = Super.compare;
    pub const getGarbageCollection = Super.getGarbageCollection;
    pub const getIterator = Super.getIterator;
    const fromObject = Super.fromObject;
    const getIndex = Super.getIndex;
};
