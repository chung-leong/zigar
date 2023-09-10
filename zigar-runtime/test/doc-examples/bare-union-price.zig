// bare-union-price.zig
const Currency = enum { EUR, PLN, MOP, USD };
const Price = union {
    USD: i32,
    EUR: i32,
    PLN: i32,
    MOP: i32,
};

pub fn getPrice(currency: Currency, amount: i32) Price {
    return switch (currency) {
        .USD => .{ .USD = amount },
        .EUR => .{ .EUR = amount },
        .PLN => .{ .PLN = amount },
        .MOP => .{ .MOP = amount },
    };
}
