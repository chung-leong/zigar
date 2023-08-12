const Animal = union {
    dog: i32,
    cat: i32,
    pig: f64,
    monkey: i64,
};
pub var animal: Animal = .{ .dog = 123 };

pub fn useDog() void {
    animal = .{ .dog = 777 };
}

pub fn useCat() void {
    animal = .{ .cat = 777 };
}

pub fn usePig() void {
    animal = .{ .pig = 777 };
}

pub fn useMonkey() void {
    animal = .{ .monkey = 777 };
}
