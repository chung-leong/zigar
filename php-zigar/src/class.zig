const std = @import("std");

const accessor = @import("accessor.zig");
const ByteBuffer = @import("buffer.zig").ByteBuffer;
const enums = @import("enums.zig");
const MemberFlags = enums.MemberFlags;
const MemberType = enums.MemberType;
const StructureFlags = enums.StructureFlags;
const StructurePurpose = enums.StructurePurpose;
const StructureType = enums.StructureType;
const Host = @import("host.zig").ModuleHost;
const invokeHandler = @import("object.zig").invokeHandler;
const php = @import("php.zig");
const ClassEntry = php.ClassEntry;
const ExecuteData = php.ExecuteData;
const Function = php.Function;
const HashTable = php.HashTable;
const HashTableIterator = php.HashTableIterator;
const HashTableObjectIterator = php.HashTableObjectIterator;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("structure.zig");
const ZigObject = @import("object.zig").ZigObject;

pub const ZigClass = struct {
    host: *Host,
    type: StructureType,
    purpose: StructurePurpose,
    flags: StructureFlags,
    alignment: usize,
    signature: u64,
    length: ?usize,
    byte_size: ?usize,
    instance: Scope = .{},
    static: Scope = .{},
    status: packed struct {
        finalized: bool = false,
        activated: bool = false,
    } = .{},
    static_data: StaticData = undefined,
    php_portion: ClassEntry = undefined,
    methods: Methods,

    pub const ScopeType = enum { instance, static };

    const Methods = struct {
        toString: Function,
    };
    const Scope = struct {
        members: HashTable = undefined,
        template: Template = undefined,
        slot_count: usize = 0,

        fn release(self: *@This()) void {
            php.destroyHashTable(&self.members);
            self.template.release();
        }
    };
    pub const Member = struct {
        type: MemberType,
        flags: MemberFlags,
        bit_offset: ?usize,
        bit_size: usize,
        byte_size: ?usize,
        slot: ?usize,
        class: ?*ZigClass = null,
        accessors: accessor.Any = undefined,

        pub fn destructor(value: [*c]Value) callconv(.c) void {
            const member = php.getValuePointer(*Member, value) catch unreachable;
            if (!member.flags.is_self_referencing) {
                if (member.class) |c| c.release();
            }
            php.allocator.destroy(member);
        }
    };
    pub const Template = struct {
        bytes: ?*ByteBuffer = null,
        slots: ?*Value = null,

        fn release(self: *@This()) void {
            if (self.bytes) |b| b.release();
            if (self.slots) |s| php.release(s);
        }
    };
    const StaticData = define: {
        const fields = std.meta.fields(@TypeOf(structure.by_enum));
        var new_fields: [fields.len]std.builtin.Type.UnionField = undefined;
        for (fields, 0..) |field, i| {
            const Structure = @field(structure.by_enum, field.name);
            const StructureStatic = if (@hasDecl(Structure, "Static")) Structure.Static else void;
            new_fields[i] = .{
                .name = field.name,
                .type = StructureStatic,
                .alignment = @alignOf(StructureStatic),
            };
        }
        break :define @Type(.{
            .@"union" = .{
                .layout = .auto,
                .decls = &.{},
                .fields = &new_fields,
                .tag_type = null,
            },
        });
    };

    pub fn entry(self: *@This()) *ClassEntry {
        return &self.php_portion;
    }

    pub fn fromEntry(ce: *ClassEntry) *@This() {
        return @fieldParentPtr("php_portion", ce);
    }

    pub fn fromObject(obj: *Object) *@This() {
        return fromEntry(obj.ce);
    }

    pub fn fromStructure(s: anytype) *@This() {
        const S = @TypeOf(s.*);
        const zig_obj = ZigObject(S).fromStructure(s);
        return fromEntry(zig_obj.php_portion.ce);
    }

    pub fn fromStatic(s: anytype) *@This() {
        const S = @TypeOf(s.*);
        const field_name = inline for (std.meta.fields(StaticData)) |field| {
            if (field.type == S) break field.name;
        } else @compileError("Not part of static data union " ++ @typeName(S));
        const sd_ptr: *StaticData = @fieldParentPtr(field_name, s);
        return @fieldParentPtr("static_data", sd_ptr);
    }

    pub fn hasInterface(self: *@This(), interface_ce: *const php.ClassEntry) bool {
        return php.instanceOf(self.entry(), interface_ce);
    }

    pub fn addRef(self: *@This()) void {
        self.php_portion.refcount += 1;
    }

    pub fn release(self: *@This()) void {
        self.php_portion.refcount -= 1;
        if (self.php_portion.refcount == 0) {
            // std.debug.print("freeing class\n", .{});
            if (self.status.activated) {
                self.host.release();
            }
            if (self.status.finalized) {
                self.static.release();
                self.instance.release();
                // free static data
                switch (self.type) {
                    inline else => |t| {
                        const name = @tagName(t);
                        if (@FieldType(StaticData, name) != void) {
                            const data = &@field(self.static_data, name);
                            const Data = @TypeOf(data.*);
                            if (Data != void and @hasDecl(Data, "deinit")) data.deinit();
                        }
                    },
                }
            }
            freeEntry(self.entry());
            php.allocator.destroy(self);
        }
    }

    fn freeEntry(ce: *ClassEntry) void {
        if (ce.name) |n| php.release(n);
        if (ce.info.user.filename) |f| php.release(f);
        if (ce.unnamed_2.interfaces) |ptr| {
            const list = ptr[0..@as(usize, ce.num_interfaces)];
            php.allocator.free(list);
        }
    }

    pub fn define(host: *Host, info: *Value) !*Object {
        errdefer |err| std.debug.print("define => {}\n", .{err});
        var self: *@This() = try php.allocator.create(@This());
        errdefer php.allocator.destroy(self);
        self.* = .{
            .host = host,
            .type = try php.getPropertyWithType(StructureType, info, "type"),
            .purpose = try php.getPropertyWithType(StructurePurpose, info, "purpose"),
            .flags = try php.getPropertyWithType(?StructureFlags, info, "flags") orelse @bitCast(@as(u32, 0)),
            .alignment = try php.getPropertyWithType(usize, info, "align"),
            .length = try php.getPropertyWithType(?usize, info, "length"),
            .byte_size = try php.getPropertyWithType(?usize, info, "byteSize"),
            .signature = get: {
                const sig = try php.getProperty(info, "signature");
                if (php.getValueDouble(sig)) |d|
                    break :get @intFromFloat(d)
                else |_| if (php.getValueLong(sig)) |l|
                    break :get @intCast(l)
                else |_|
                    return error.InvalidSignature;
            },
            .methods = .{
                .toString = php.createFunction(toString, "__toString", null),
            },
        };
        const interfaces = try self.createInterfaceList();
        const ce = &self.php_portion;
        ce.* = .{
            .type = php.USER_CLASS,
            .refcount = 1,
            .name = php.createString(""), // use an empty string for now
            .ce_flags = php.LINKED | php.RESOLVED_INTERFACES,
            .properties_info = php.createHashTable(null),
            .constants_table = php.createHashTable(null),
            .function_table = php.createHashTable(php.destructor.function),
            .num_interfaces = @intCast(interfaces.len),
            .unnamed_0 = .{
                .parent = self.getParentClass(),
            },
            .unnamed_1 = .{
                .create_object = php.transform(createObject),
            },
            .unnamed_2 = .{
                .interfaces = if (interfaces.len > 0) @ptrCast(interfaces.ptr) else null,
            },
            .info = .{
                .user = .{
                    .filename = php.createString("filename"),
                },
            },
            .__tostring = &self.methods.toString,
        };
        errdefer freeEntry(ce);
        return try createRef(ce);
    }

    pub fn finalize(obj: *Object, info: *Value) !void {
        errdefer |err| std.debug.print("finalize => {}\n", .{err});
        const self = fromEntry(obj.ce);
        self.instance = try self.extractScope(info, "instance");
        errdefer self.instance.release();
        self.static = try self.extractScope(info, "static");
        errdefer self.static.release();
        inline for (.{ .static, .instance }) |scope_type| {
            const scope = &@field(self, @tagName(scope_type));
            // attach count the number of slots used
            var iter = self.getMemberIterator(scope_type);
            while (iter.next()) |member| {
                switch (member.type) {
                    .object, .type, .literal => scope.slot_count += 1,
                    else => {},
                }
            }
            // attach accessors to members
            iter.reset();
            while (iter.next()) |member| {
                member.accessors = try getAccessors(scope, member);
            }
        }
        // set the class name
        self.php_portion.name = get: {
            if (php.getProperty(info, "name")) |value| {
                const str = try php.getValueString(value);
                php.addRef(str);
                break :get str;
            } else |_| {
                break :get try self.inferName();
            }
        };
        // set slots of ref object
        const static = structure.Static.fromObject(obj);
        const slots = try self.createSlots(.static, null);
        defer php.release(&slots);
        try static.setStorage(undefined, &slots);
        // initialize static data
        switch (self.type) {
            inline else => |t| {
                const name = @tagName(t);
                if (@FieldType(StaticData, name) != void) {
                    errdefer std.debug.print("Unable to initialize: {}\n", .{@FieldType(StaticData, name)});
                    self.static_data = @unionInit(StaticData, name, .{});
                    const data = &@field(self.static_data, name);
                    try data.init(self);
                }
            },
        }
        self.status.finalized = true;
    }

    pub fn activate(obj: *Object) void {
        // this method is called when the host is about to release the structure map
        const self = fromEntry(obj.ce);
        self.host.addRef();
        self.status.activated = true;
    }

    pub fn getFlags(self: *@This(), comptime S: type) @FieldType(StructureFlags, structure.enumName(S)) {
        return @field(self.flags, structure.enumName(S));
    }

    pub fn getStaticData(self: *@This(), comptime S: type) *@FieldType(StaticData, structure.enumName(S)) {
        return &@field(self.static_data, structure.enumName(S));
    }

    pub fn getStructureName(self: *@This()) []const u8 {
        return switch (self.type) {
            .error_union => "error union",
            .error_set => "error set",
            inline else => |e| @tagName(e),
        };
    }

    pub fn getName(self: *@This()) []const u8 {
        return php.getStringContent(self.php_portion.name);
    }

    pub fn getSlotCount(self: *@This(), comptime scope: ScopeType) usize {
        return switch (scope) {
            inline else => |s| @field(self, @tagName(s)).slot_count,
        };
    }

    pub fn getMember(self: *@This(), comptime scope: ScopeType, key: anytype) !*Member {
        switch (scope) {
            inline else => |s| {
                const container = &@field(self, @tagName(s));
                const value = try php.getHashEntry(&container.members, key);
                return php.getValuePointer(*Member, value) catch unreachable;
            },
        }
    }

    pub fn getMemberIterator(self: *@This(), comptime scope: ScopeType) HashTableObjectIterator(*Member) {
        switch (scope) {
            inline else => |s| {
                const container = &@field(self, @tagName(s));
                return .init(&container.members, .{});
            },
        }
    }

    pub fn createInterfaceList(self: *@This()) ![]*ClassEntry {
        var buffer: [16]*ClassEntry = undefined;
        var count: usize = 0;
        switch (self.type) {
            .array, .vector, .slice => {
                buffer[count] = php.getInterface(.array_access);
                count += 1;
            },
            .error_set => {
                buffer[count] = php.getInterface(.throwable);
                count += 1;
            },
            else => {},
        }
        if (count == 0) return &.{};
        const interfaces = try php.allocator.alloc(*ClassEntry, count);
        @memcpy(interfaces, buffer[0..count]);
        return interfaces;
    }

    fn extractScope(self: *@This(), info: *Value, name: []const u8) !Scope {
        const scope_info = try php.getProperty(info, name);
        var members = try self.extractMembers(scope_info);
        errdefer php.destroyHashTable(&members);
        const template = try self.extractTemplate(scope_info);
        return .{ .members = members, .template = template };
    }

    fn extractMembers(self: *@This(), scope_info: *Value) !HashTable {
        var result = php.createHashTable(Member.destructor);
        const member_list = php.getProperty(scope_info, "members") catch return result;
        const member_list_ht = try php.getValueHashTable(member_list);
        var iter: HashTableIterator = .init(member_list_ht, .{});
        while (iter.next()) |member_info| {
            const member_ht = try php.getValueHashTable(member_info);
            const name = php.getHashEntry(member_ht, "name") catch null;
            const member = try php.allocator.create(Member);
            errdefer php.allocator.destroy(member);
            member.* = .{
                .type = try php.getHashEntryWithType(MemberType, member_ht, "type"),
                .flags = try php.getHashEntryWithType(?MemberFlags, member_ht, "flags") orelse .{},
                .bit_offset = try php.getHashEntryWithType(?usize, member_ht, "bitOffset"),
                .bit_size = try php.getHashEntryWithType(?usize, member_ht, "bitSize") orelse 0,
                .byte_size = try php.getHashEntryWithType(?usize, member_ht, "byteSize"),
                .slot = try php.getHashEntryWithType(?usize, member_ht, "slot"),
            };
            if (php.getHashEntry(member_ht, "structure")) |struct_info| {
                const ref = try php.getProperty(struct_info, "class");
                const obj = try php.getValueObject(ref);
                const class = fromEntry(obj.ce);
                member.class = class;
                member.flags.is_self_referencing = class == self;
                if (class != self) class.addRef();
            } else |_| {}
            var member_ptr = php.createValuePointer(member);
            if (name) |n| {
                const key = try php.getValueString(n);
                php.setHashEntry(&result, key, &member_ptr);
            } else {
                php.setHashEntry(&result, iter.currentIndex().?, &member_ptr);
            }
        }
        return result;
    }

    fn extractTemplate(_: *@This(), scope_info: *Value) !Template {
        if (php.getProperty(scope_info, "template")) |template_info| {
            const bytes = if (php.getProperty(template_info, "memory")) |value| use: {
                const buf = try php.getValuePointer(*ByteBuffer, value);
                buf.addRef();
                break :use buf;
            } else |_| null;
            const slots = if (php.getProperty(template_info, "slots")) |value| use: {
                php.addRef(value);
                break :use value;
            } else |_| null;
            return .{ .bytes = bytes, .slots = slots };
        } else |_| {
            return .{ .bytes = null, .slots = null };
        }
    }

    fn createRef(ce: *ClassEntry) !*Object {
        const self = fromEntry(ce);
        const zig_obj = try ZigObject(structure.Static).create(self);
        self.release(); // remove initial refcount now that the ref object exists
        return zig_obj.object();
    }

    pub fn createObject(ce: *ClassEntry) !*Object {
        const self = fromEntry(ce);
        switch (self.type) {
            inline else => |t| {
                const S = @field(structure.by_enum, @tagName(t));
                const bytes = switch (self.type) {
                    // argument struct for variadic function will allocate its own memory
                    // based on the arguments given
                    .variadic_struct => null,
                    else => try self.createBuffer(),
                };
                defer if (bytes) |b| b.release();
                const slots = try self.createSlots(.instance, null);
                defer php.release(&slots);
                const zig_obj = try ZigObject(S).create(self);
                try zig_obj.setStorage(bytes orelse undefined, &slots);
                return zig_obj.object();
            },
        }
    }

    fn createBuffer(self: *const @This()) !*ByteBuffer {
        const len = self.byte_size orelse return error.MissingLength;
        return if (self.instance.template.bytes) |def|
            try ByteBuffer.createCopy(def.bytes, self.alignment)
        else
            try ByteBuffer.createNew(len, self.alignment);
    }

    fn createSlots(self: *const @This(), comptime scope_type: ScopeType, prefilled_slots: ?*const Value) !Value {
        const scope = &@field(self, @tagName(scope_type));
        var new_slots: Value = switch (scope.slot_count) {
            // if type only uses one slot, we don't need a hash table--a zval will do
            0, 1 => php.createValueNull(),
            else => php.createValueArray(null),
        };
        if (scope.slot_count > 0) {
            const sources: [2]?*const Value = .{ scope.template.slots, prefilled_slots };
            const new_ht = switch (scope.slot_count) {
                1 => undefined,
                else => php.getValueHashTable(&new_slots) catch unreachable,
            };
            for (sources) |src| {
                const src_slots = src orelse continue;
                const src_ht = try php.getValueHashTable(src_slots);
                var iter: HashTableIterator = .init(src_ht, .{});
                while (iter.next()) |value| {
                    if (scope.slot_count == 1) {
                        new_slots = value.*;
                        php.addRef(value);
                        break;
                    } else {
                        php.setHashEntryRef(new_ht, iter.currentIndex().?, value);
                    }
                }
            }
        }
        return new_slots;
    }

    pub fn createObjectWith(ce: *ClassEntry, bytes: *ByteBuffer, prefilled_slots: ?*const Value) !*Object {
        const self = fromEntry(ce);
        switch (self.type) {
            inline else => |t| {
                const S = @field(structure.by_enum, @tagName(t));
                const zig_obj = try ZigObject(S).create(self);
                const slots = try self.createSlots(.instance, prefilled_slots);
                defer php.release(&slots);
                try zig_obj.setStorage(bytes, &slots);
                return zig_obj.object();
            },
        }
    }

    pub fn toString(ed: *ExecuteData, return_value: *Value) !void {
        const obj = try php.getValueObject(&ed.This);
        return_value.* = try invokeHandler(obj, "stringify", .{});
    }

    fn getAccessors(scope: *Scope, member: *Member) !accessor.Any {
        @setEvalBranchQuota(2000000);
        // array accessors don't have an offset
        const for_scalar = member.bit_offset != null;
        const byte_offset: usize = if (member.bit_offset) |bit_offset| bit_offset / 8 else 0;
        const bit_offset_mod8: ?u3 = if (member.bit_offset) |bit_offset|
            // when byte size is given the field is byte-aligned; there's no need to adjust for
            // use a bit-shifting accrossor
            if (member.byte_size != null) null else @intCast(bit_offset % 8)
        else
            null;
        switch (member.type) {
            .bool => {
                if (for_scalar) {
                    // iterate through all possible bit offsets
                    inline for (.{ null, 0, 1, 2, 3, 4, 5, 6, 7 }) |offset| {
                        if (bit_offset_mod8 == offset) {
                            const primitive = accessor.boolean.get(.{
                                .bit_offset = offset,
                            }, .{
                                .byte_offset = byte_offset,
                            });
                            return .{ .primitive = primitive };
                        }
                    }
                } else {
                    // TODO: deal with vectors inside packed struct
                    const vector = accessor.vector.get(.{ .child = bool, .is_packed = false }, .{});
                    return .{ .vector = vector };
                }
            },
            .int, .uint => inline for (0..65) |bits| {
                if (member.bit_size == bits) {
                    inline for (.{ .signed, .unsigned }) |signedness| {
                        if ((member.type == .int) == (signedness == .signed)) {
                            if (for_scalar) {
                                inline for (.{ null, 0, 1, 2, 3, 4, 5, 6, 7 }) |offset| {
                                    if (bit_offset_mod8 == offset) {
                                        const primitive = accessor.int.get(.{
                                            .signedness = signedness,
                                            .bit_size = bits,
                                            .bit_offset = offset,
                                        }, .{
                                            .byte_offset = byte_offset,
                                        });
                                        return .{ .primitive = primitive };
                                    }
                                }
                            } else {
                                const T = @Type(.{
                                    .int = .{ .signedness = signedness, .bits = bits },
                                });
                                const vector = accessor.vector.get(.{ .child = T, .is_packed = false }, .{});
                                return .{ .vector = vector };
                            }
                        }
                    }
                    break;
                }
            },
            .float => inline for (.{ 16, 32, 64, 80, 128 }) |bits| {
                if (member.bit_size == bits) {
                    if (for_scalar) {
                        inline for (.{ null, 0, 1, 2, 3, 4, 5, 6, 7 }) |offset| {
                            if (bit_offset_mod8 == offset) {
                                const primitive = accessor.float.get(.{
                                    .bit_size = bits,
                                    .bit_offset = offset,
                                }, .{
                                    .byte_offset = byte_offset,
                                });
                                return .{ .primitive = primitive };
                            }
                        }
                    } else {
                        const T = @Type(.{
                            .float = .{ .bits = bits },
                        });
                        const vector = accessor.vector.get(.{ .child = T, .is_packed = false }, .{});
                        return .{ .vector = vector };
                    }
                }
            },
            .void => {
                return .{ .primitive = accessor.void.get(.{}, .{}) };
            },
            .object, .literal => |t| if (member.slot) |slot| {
                // the lack of a slot means the member isn't meant to be accessed directly
                // only applicable to functions, I think
                const transform: ?accessor.Transform = get: {
                    if (member.flags.is_string or t == .literal) {
                        break :get .to_string;
                    } else if (member.flags.is_plain) {
                        break :get .to_plain;
                    } else if (member.class) |class| {
                        if (class.flags.common.has_value or class.flags.common.has_proxy)
                            break :get .to_value;
                    }
                    break :get null;
                };
                if (member.byte_size) |byte_size| {
                    // compound types like structs and unions are represented by objects
                    // these are stored in slots of their parent objects and are created lazily
                    const class = member.class orelse return error.MissingClass;
                    return if (scope.slot_count > 1) .{
                        .multi_slot = accessor.slot.get(.{
                            .type = .multi_slot,
                        }, .{
                            .class_entry = class.entry(),
                            .byte_offset = byte_offset,
                            .byte_size = byte_size,
                            .slot = slot,
                            .transform = transform,
                        }),
                    } else .{
                        .single_slot = accessor.slot.get(.{
                            .type = .single_slot,
                        }, .{
                            .class_entry = class.entry(),
                            .byte_offset = byte_offset,
                            .byte_size = byte_size,
                            .transform = transform,
                        }),
                    };
                } else {
                    // static members don't have a size since they're ready-made objects
                    // that sit in the template slots; this is applicable to comptime field as well
                    return if (scope.slot_count > 1) .{
                        .multi_slot_prebaked = accessor.slot.get(.{
                            .type = .multi_slot_prebaked,
                        }, .{
                            .slot = slot,
                            .transform = transform,
                        }),
                    } else .{
                        .single_slot_prebaked = accessor.slot.get(.{
                            .type = .single_slot_prebaked,
                        }, .{
                            .transform = transform,
                        }),
                    };
                }
            },
            .type => if (member.slot) |slot| {
                return if (scope.slot_count > 1) .{
                    .multi_slot_prebaked = accessor.slot.get(.{
                        .type = .multi_slot_prebaked,
                    }, .{
                        .slot = slot,
                    }),
                } else .{
                    .single_slot_prebaked = accessor.slot.get(.{
                        .type = .single_slot_prebaked,
                    }, .{}),
                };
            },
            .null, .undefined => {
                return .{ .null = accessor.null.get(.{}, .{}) };
            },
            else => {},
        }
        // std.debug.print("No accessor for {}\n", .{member.type});
        return .{ .missing = {} };
    }

    fn inferName(self: *@This()) !*String {
        errdefer |err| std.debug.print("inferName => {}\n", .{err});
        var sfb = std.heap.stackFallback(10240, php.allocator);
        const allocator = sfb.get();
        const counters = &self.host.importer.counters;
        const type_name: []const u8 = switch (self.type) {
            .primitive, .@"comptime" => get: {
                const member_value = try php.getHashEntry(&self.instance.members, 0);
                const member = try php.getValuePointer(*Member, member_value);
                break :get switch (member.type) {
                    .bool => "bool",
                    .int => switch (self.flags.primitive.is_size) {
                        true => "isize",
                        false => try std.fmt.allocPrint(allocator, "i{d}", .{member.bit_size}),
                    },
                    .uint => switch (self.flags.primitive.is_size) {
                        true => "isize",
                        false => try std.fmt.allocPrint(allocator, "u{d}", .{member.bit_size}),
                    },
                    .float => try std.fmt.allocPrint(allocator, "u{d}", .{member.bit_size}),
                    .void => "void",
                    .literal => "enum_literal",
                    .null => "null",
                    .undefined => "undefined",
                    .type => "type",
                    else => "unknown",
                };
            },
            .array => get: {
                const member_value = try php.getHashEntry(&self.instance.members, 0);
                const member = try php.getValuePointer(*Member, member_value);
                const class = member.class orelse return error.MissingClass;
                const len = self.length orelse return error.MissingLength;
                break :get try std.fmt.allocPrint(allocator, "[{d}]{s}", .{ len, class.getName() });
            },
            .@"struct" => switch (self.purpose) {
                .promise => "Promise",
                .generator => "Generator",
                .abort_signal => "AbortSignal",
                .allocator => "Allocator",
                .iterator => "Iterator",
                .file => "File",
                .directory => "Directory",
                else => get: {
                    defer counters.@"struct" += 1;
                    break :get try std.fmt.allocPrint(allocator, "S{d}", .{counters.@"struct"});
                },
            },
            .@"union" => try std.fmt.allocPrint(allocator, "U{d}", .{counters.@"union"}),
            .error_union => get: {
                const member0_value = try php.getHashEntry(&self.instance.members, 0);
                const member0 = try php.getValuePointer(*Member, member0_value);
                const member1_value = try php.getHashEntry(&self.instance.members, 1);
                const member1 = try php.getValuePointer(*Member, member1_value);
                const payload_class = member0.class orelse return error.MissingClass;
                const err_class = member1.class orelse return error.MissingClass;
                break :get try std.fmt.allocPrint(allocator, "{s}!{s}", .{
                    err_class.getName(),
                    payload_class.getName(),
                });
            },
            .error_set => switch (self.flags.error_set.is_global) {
                false => get: {
                    defer counters.error_set += 1;
                    break :get try std.fmt.allocPrint(allocator, "ES{d}", .{counters.@"union"});
                },
                true => "anyerror",
            },
            .@"enum" => get: {
                defer counters.@"enum" += 1;
                break :get try std.fmt.allocPrint(allocator, "EN{d}", .{counters.@"enum"});
            },
            .optional => get: {
                const member_value = try php.getHashEntry(&self.instance.members, 0);
                const member = try php.getValuePointer(*Member, member_value);
                const class = member.class orelse return error.MissingClass;
                break :get try std.fmt.allocPrint(allocator, "?{s}", .{class.getName()});
            },
            .pointer => get: {
                const member_value = try php.getHashEntry(&self.instance.members, 0);
                const member = try php.getValuePointer(*Member, member_value);
                const class = member.class orelse return error.MissingClass;
                var prefix: []const u8 = switch (self.flags.pointer.is_multiple) {
                    false => "*",
                    true => if (self.flags.pointer.has_length)
                        "[]"
                    else if (self.flags.pointer.is_single)
                        "[*c]"
                    else
                        "[*]",
                };
                // TODO: deal with sentinel
                if (self.flags.pointer.is_const)
                    prefix = try std.fmt.allocPrint(allocator, "{s}const ", .{prefix});
                break :get try std.fmt.allocPrint(allocator, "{s}{s}", .{ prefix, class.getName() });
            },
            .slice => get: {
                const member_value = try php.getHashEntry(&self.instance.members, 0);
                const member = try php.getValuePointer(*Member, member_value);
                const class = member.class orelse return error.MissingClass;
                break :get switch (self.flags.slice.is_opaque) {
                    false => try std.fmt.allocPrint(allocator, "[_]{s}", .{class.getName()}),
                    true => "anyopaque",
                };
            },
            .vector => get: {
                const member_value = try php.getHashEntry(&self.instance.members, 0);
                const member = try php.getValuePointer(*Member, member_value);
                const class = member.class orelse return error.MissingClass;
                const len = self.length orelse return error.MissingLength;
                break :get try std.fmt.allocPrint(allocator, "@Vector({d}, {s})", .{ len, class.getName() });
            },
            .@"opaque" => get: {
                defer counters.@"opaque" += 1;
                break :get try std.fmt.allocPrint(allocator, "O{d}", .{counters.@"opaque"});
            },
            .arg_struct, .variadic_struct => |t| get: {
                var index: usize = 0;
                var iter = self.getMemberIterator(.instance);
                if (iter.len == 0) return error.InvalidType;
                const names = try allocator.alloc([]const u8, iter.len);
                defer allocator.free(names);
                while (iter.next()) |member| {
                    const class = member.class orelse return error.MissingClass;
                    names[index] = class.getName();
                    index += 1;
                }
                break :get try std.fmt.allocPrint(allocator, "Arg(fn ({s}{s}) {s})", .{
                    try std.mem.join(allocator, ", ", names[1..]),
                    if (t == .variadic_struct) ", ..." else "",
                    names[0],
                });
            },
            .function => get: {
                const member_value = try php.getHashEntry(&self.instance.members, 0);
                const member = try php.getValuePointer(*Member, member_value);
                const class = member.class orelse return error.MissingClass;
                const arg_name = class.getName();
                break :get arg_name[4 .. arg_name.len - 1];
            },
        };
        return php.createString(type_name);
    }

    pub var global_class: *ClassEntry = undefined;
    pub var global_error_class: *ClassEntry = undefined;

    pub fn registerGlobalClasses() !void {
        var ce: ClassEntry = .{
            .name = php.createPersistentString("ZigObject"),
        };
        const parent_ce = php.getClassEntry(.standard);
        global_class = php.registerInternalClass(&ce, parent_ce) orelse
            return error.ClassRegistrationFailure;
        var error_ce: ClassEntry = .{
            .name = php.createPersistentString("ZigError"),
        };
        const error_parent_ce = php.getClassEntry(.exception);
        global_error_class = php.registerInternalClass(&error_ce, error_parent_ce) orelse
            return error.ClassRegistrationFailure;
    }

    pub fn isZig(ce: *ClassEntry) bool {
        return ce.*.unnamed_0.parent == global_class;
    }

    pub fn isZigError(ce: *ClassEntry) bool {
        return ce.*.unnamed_0.parent == global_error_class;
    }

    pub fn getParentClass(self: *@This()) *ClassEntry {
        return switch (self.type) {
            .error_set => global_error_class,
            else => global_class,
        };
    }
};
