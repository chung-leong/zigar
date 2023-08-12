// Adopted from https://github.com/tiehuis/zig-benchmarks-game/blob/master/src/fannkuch-redux.zig

const std = @import("std");

const PfannkuchenResult = struct {
    checksum: isize,
    max_flips_count: usize,
};

pub fn Pfannkuchen(allocator: std.mem.Allocator, n: usize) !PfannkuchenResult {
    var perm = try allocator.alloc(usize, n);
    var perm1 = try allocator.alloc(usize, n);
    var count = try allocator.alloc(usize, n);

    var max_flips_count: usize = 0;
    var perm_count: usize = 0;
    var checksum: isize = 0;

    for (perm1, 0..) |*e, i| {
        e.* = i;
    }

    var r = n;
    loop: {
        while (true) {
            while (r != 1) : (r -= 1) {
                count[r - 1] = r;
            }

            for (perm, 0..) |_, i| {
                perm[i] = perm1[i];
            }

            var flips_count: usize = 0;

            while (true) {
                const k = perm[0];
                if (k == 0) {
                    break;
                }

                const k2 = (k + 1) >> 1;
                var i: usize = 0;
                while (i < k2) : (i += 1) {
                    std.mem.swap(usize, &perm[i], &perm[k - i]);
                }
                flips_count += 1;
            }

            max_flips_count = @max(max_flips_count, flips_count);
            if (perm_count % 2 == 0) {
                checksum += @intCast(flips_count);
            } else {
                checksum -= @intCast(flips_count);
            }

            while (true) : (r += 1) {
                if (r == n) {
                    break :loop;
                }

                const perm0 = perm1[0];
                var i: usize = 0;
                while (i < r) {
                    const j = i + 1;
                    perm1[i] = perm1[j];
                    i = j;
                }

                perm1[r] = perm0;
                count[r] -= 1;

                if (count[r] > 0) {
                    break;
                }
            }

            perm_count += 1;
        }
    }

    return .{
        .checksum = checksum,
        .max_flips_count = max_flips_count,
    };
}
