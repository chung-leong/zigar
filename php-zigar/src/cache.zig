const std = @import("std");

const accessor = @import("accessor.zig");
const php = @import("php.zig");
const String = php.String;
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;

pub fn IdFromTags(comptime tags: anytype) type {
    var fields: [tags.len]std.builtin.Type.EnumField = undefined;
    inline for (tags, 0..) |tag, i| {
        fields[i] = .{
            .name = @tagName(tag),
            .value = i,
        };
    }
    return @Type(.{
        .@"enum" = .{
            .fields = &fields,
            .decls = &.{},
            .is_exhaustive = true,
            .tag_type = std.math.IntFittingRange(0, tags.len),
        },
    });
}

pub fn IdCache(comptime tags: anytype, comptime prefix: []const u8, comptime aliases: anytype) type {
    return struct {
        mask: usize = 0,

        pub const Id = IdFromTags(tags);

        const Data = struct {
            id_address: usize,
            value: Id,
        };
        const id = std.fmt.comptimePrint("{}", .{tags});

        pub inline fn find(self: @This(), cache_slot: ?[*]?*anyopaque) !?Id {
            const data: *Data = if (cache_slot) |ptr| @ptrCast(ptr) else return null;
            return if (data.id_address == @intFromPtr(id) ^ self.mask)
                data.value
            else if (data.id_address != 0)
                error.ForAnotherCache
            else
                null;
        }

        pub inline fn set(self: @This(), cache_slot: ?[*]?*anyopaque, value: Id) void {
            const data: *Data = if (cache_slot) |ptr| @ptrCast(ptr) else return;
            data.* = .{ .id_address = @intFromPtr(id) & self.mask, .value = value };
        }

        pub fn idFromString(self: @This(), name: *String, cache_slot: ?[*]?*anyopaque) ?Id {
            if (self.find(cache_slot) catch return null) |value| return value;
            return inline for (tags) |tag| {
                if (php.matchString(name, prefix ++ @tagName(tag))) {
                    self.set(cache_slot, tag);
                    return tag;
                }
            } else inline for (comptime std.meta.fields(@TypeOf(aliases))) |field| {
                if (php.matchString(name, field.name)) {
                    const tag = @field(aliases, field.name);
                    self.set(cache_slot, tag);
                    return tag;
                }
            } else null;
        }
    };
}

pub const TransformCache = struct {
    mask: usize,

    const Data = struct {
        id_address: usize,
        value: accessor.Transform,
    };
    const id = "Transform";

    pub inline fn find(self: @This(), cache_slot: ?[*]?*anyopaque) !?accessor.Transform {
        const data: *Data = if (cache_slot) |ptr| @ptrCast(ptr) else return null;
        return if (data.id_address == @intFromPtr(id) ^ self.mask)
            data.value
        else if (data.id_address != 0)
            error.ForAnotherCache
        else
            null;
    }

    pub inline fn set(self: @This(), cache_slot: ?[*]?*anyopaque, value: accessor.Transform) void {
        const data: *Data = if (cache_slot) |ptr| @ptrCast(ptr) else return;
        data.* = .{ .id_address = @intFromPtr(id) & self.mask, .value = value };
    }

    pub fn idFromString(self: @This(), name: *String, cache_slot: ?[*]?*anyopaque) ?accessor.Transform {
        if (self.find(cache_slot) catch return null) |value| return value;
        const transforms = .{
            .__value = .none,
            .__plain = .plain,
            .__string = .string,
            .__int = .integer,
            .__bytes = .bytes,
            .__base64 = .base64,
            .__typed_array = .typed_array,
            .__clamped_array = .clamped_array,
            .@"$" = .plain,
        };
        return inline for (std.meta.fields(@TypeOf(transforms))) |field| {
            if (php.matchString(name, field.name)) {
                const transform = @field(transforms, field.name);
                self.set(cache_slot, transform);
                break transform;
            }
        } else null;
    }
};

pub const MemberCache = struct {
    mask: usize,

    const Data = struct {
        class_address: usize,
        member: *const ZigClassEntry.Member,
        extra: ?*anyopaque = null,
    };

    pub inline fn find(self: @This(), cache_slot: ?[*]?*anyopaque, class: *ZigClassEntry) !?*const ZigClassEntry.Member {
        const data: *Data = if (cache_slot) |ptr| @ptrCast(ptr) else return null;
        return if (data.class_address == @intFromPtr(class) ^ self.mask)
            data.member
        else if (data.class_address != 0)
            error.ForAnotherCache
        else
            null;
    }

    pub inline fn findData(self: @This(), cache_slot: ?[*]?*anyopaque, class: *ZigClassEntry) ?*Data {
        const data: *Data = if (cache_slot) |ptr| @ptrCast(ptr) else return null;
        return if (data.class_address == @intFromPtr(class) ^ self.mask)
            data
        else
            null;
    }

    pub inline fn set(self: @This(), cache_slot: ?[*]?*anyopaque, class: *ZigClassEntry, member: *const ZigClassEntry.Member) void {
        const data: *Data = if (cache_slot) |ptr| @ptrCast(ptr) else return;
        data.* = .{ .class_address = @intFromPtr(class) ^ self.mask, .member = member };
    }
};
