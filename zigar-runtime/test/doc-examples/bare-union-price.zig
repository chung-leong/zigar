// bare-union-price.zig
const Currency = enum { usd, eur, pln, mop };
const Price = union {
    usd: i32,
    eur: i32,
    pln: i32,
    mop: i32,
};

pub fn getPrice(currency: Currency, amount: i32) Price {
    return switch (currency) {
        .usd => .{ .usd = amount },
        .eur => .{ .eur = amount },
        .pln => .{ .pln = amount },
        .mop => .{ .mop = amount },
    };
}
