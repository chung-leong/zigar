const Sound = struct {
    loud: void = {},
    thunderous: void = {},
    deafening: void = {},
};
const Fury = struct {
    angry: void = {},
    frenzied: void = {},
    tempestuous: void = {},
};
const Tale = struct {
    sound: Sound = .{},
    fury: Fury = .{},
};

pub const Idiot = struct {
    pub fn tell() Tale {
        return .{};
    }
};
