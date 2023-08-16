const std = @import("std");

fn tolower(c: usize) usize {
    return if (c -% 'A' < 26) c | 32 else c;
}

fn toupper(c: usize) usize {
    return if (c -% 'a' < 26) c & 0x5f else c;
}

const pairs = "ATCGGCTAUAMKRYWWSSYRKMVBHDDHBVNN\n\n";
const table = block: {
    var t: [128]u8 = undefined;

    var i: usize = 0;
    while (i < pairs.len) : (i += 2) {
        t[toupper(pairs[i])] = pairs[i + 1];
        t[tolower(pairs[i])] = pairs[i + 1];
    }

    break :block t;
};

fn process(buf: []u8, ifrom: usize, ito: usize) void {
    var from = ifrom + std.mem.indexOfScalar(u8, buf[ifrom..], '\n').? + 1;
    var to = ito;

    const len = to - from;
    const off = 60 - (len % 61);

    if (off != 0) {
        var m = from + 60 - off;
        while (m < to) : (m += 61) {
            // memmove(m + 1, m, off);
            var i: usize = 0;
            var t = buf[m];
            while (i < off) : (i += 1) {
                std.mem.swap(u8, &buf[m + 1 + i], &t);
            }

            buf[m] = '\n';
        }
    }

    to -= 1;
    while (from <= to) : ({
        from += 1;
        to -= 1;
    }) {
        const c = table[buf[from]];
        buf[from] = table[buf[to]];
        buf[to] = c;
    }
}

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var allocator = gpa.allocator();

pub fn reverseComplement(buf: []u8) !void {
    var to = buf.len - 1;
    while (true) {
        const from = std.mem.lastIndexOfScalar(u8, buf[0..to], '>').?;
        process(buf, from, to);

        if (from == 0) {
            break;
        }

        to = from - 1;
    }
}
