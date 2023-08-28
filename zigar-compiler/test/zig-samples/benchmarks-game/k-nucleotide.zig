const std = @import("std");

const HashMap = std.AutoHashMap(u64, u32);

inline fn codeForNucleotide(nucleotide: u8) u8 {
    const lookup = [_]u8{ ' ', 0, ' ', 1, 3, ' ', ' ', 2 };
    return lookup[nucleotide & 0x7];
}

inline fn nucleotideForCode(code: u8) u8 {
    return "ACGT"[code & 0x3];
}

fn kvLessThan(_: void, lhs: HashMap.KV, rhs: HashMap.KV) bool {
    if (lhs.value < rhs.value) return false;
    if (lhs.value > rhs.value) return true;
    return lhs.key < rhs.key;
}

fn generateFrequenciesForLength(allocator: std.mem.Allocator, poly: []const u8, comptime desired_length: usize, output: []u8) !void {
    var hash = HashMap.init(allocator);
    defer hash.deinit();

    const mask = (@as(u64, 1) << (2 * desired_length)) - 1;

    {
        var key: u64 = 0;
        var i: usize = 0;

        while (i < desired_length - 1) : (i += 1) {
            key = ((key << 2) & mask) | poly[i];
        }

        while (i < poly.len) : (i += 1) {
            key = ((key << 2) & mask) | poly[i];
            var entry = try hash.getOrPutValue(key, 0);
            entry.value_ptr.* += 1;
        }
    }

    var list = try allocator.alloc(HashMap.KV, hash.count());
    defer allocator.free(list);

    var i: usize = 0;
    var it = hash.iterator();
    while (it.next()) |entry| {
        list[i] = HashMap.KV{ .key = entry.key_ptr.*, .value = entry.value_ptr.* };
        i += 1;
    }

    std.sort.heap(HashMap.KV, list, {}, kvLessThan);

    var position: usize = 0;
    for (list) |*entry| {
        var olig: [desired_length]u8 = undefined;

        for (&olig, 0..) |*e, j| {
            const shift = @as(u6, @intCast(2 * (olig.len - j - 1)));
            e.* = nucleotideForCode(@as(u8, @truncate(entry.key >> shift)));
        }

        const slice = try std.fmt.bufPrint(
            output[position..],
            "{s} {d:.3}\n",
            .{ olig[0..], 100.0 * @as(f64, @floatFromInt(entry.value)) / @as(f64, @floatFromInt(poly.len - desired_length + 1)) },
        );
        position += slice.len;
        output[position] = 0;
    }
}

fn generateCount(allocator: std.mem.Allocator, poly: []const u8, comptime olig: []const u8, output: []u8) !void {
    var hash = HashMap.init(allocator);
    defer hash.deinit();

    const mask = (@as(u64, 1) << (2 * olig.len)) - 1;

    {
        var key: u64 = 0;
        var i: usize = 0;

        while (i < olig.len - 1) : (i += 1) {
            key = ((key << 2) & mask) | poly[i];
        }

        while (i < poly.len) : (i += 1) {
            key = ((key << 2) & mask) | poly[i];
            var entry = try hash.getOrPutValue(key, 0);
            entry.value_ptr.* += 1;
        }
    }

    {
        var key: u64 = 0;

        for (olig, 0..) |_, i| {
            key = ((key << 2) & mask) | codeForNucleotide(olig[i]);
        }

        const count = hash.get(key) orelse 0;
        const slice = try std.fmt.bufPrint(output, "{}\t{s}", .{ count, olig });
        output[slice.len] = 0;
    }
}

pub fn kNucleotide(allocator: std.mem.Allocator, lines: [][]const u8) ![][]const u8 {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    var poly = std.ArrayList(u8).init(gpa.allocator());
    defer poly.deinit();

    for (lines) |line| {
        for (line) |c| {
            try poly.append(codeForNucleotide(c));
        }
    }

    const poly_shrunk = try poly.toOwnedSlice();

    const counts = [_]u8{ 1, 2 };
    const entries = [_][]const u8{ "GGT", "GGTA", "GGTATT", "GGTATTTTAATT", "GGTATTTTAATTTATAGT" };

    var output: [counts.len + entries.len][4096]u8 = undefined;

    inline for (counts, 0..) |count, i| {
        try generateFrequenciesForLength(allocator, poly_shrunk, count, output[i][0..]);
    }

    inline for (entries, 0..) |entry, i| {
        try generateCount(allocator, poly_shrunk, entry, output[i + counts.len][0..]);
    }

    var output_lines: [][]const u8 = try allocator.alloc([]const u8, counts.len + entries.len);
    for (output, 0..) |entry, index| {
        const entry_len = std.mem.indexOfScalarPos(u8, entry[0..], 0, 0) orelse unreachable;
        const line: []u8 = try allocator.alloc(u8, entry_len);
        @memcpy(line, entry[0..entry_len]);
        output_lines[index] = line;
    }
    return output_lines;
}
