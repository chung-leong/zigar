// Adopted from https://github.com/tiehuis/zig-benchmarks-game/blob/master/src/n-body.zig

const std = @import("std");

pub const solar_mass = 4.0 * std.math.pi * std.math.pi;
pub const year = 365.24;

pub const Planet = struct {
    x: f64,
    y: f64,
    z: f64,
    vx: f64,
    vy: f64,
    vz: f64,
    mass: f64,
};
pub const Planets = []Planet;

pub fn advance(bodies: []Planet, dt: f64, steps: usize) void {
    var i: usize = 0;
    while (i < steps) : (i += 1) {
        for (bodies, 0..) |*bi, j| {
            for (bodies[j + 1 ..]) |*bj| {
                const dx = bi.x - bj.x;
                const dy = bi.y - bj.y;
                const dz = bi.z - bj.z;

                const dsq = dx * dx + dy * dy + dz * dz;
                const dst = @sqrt(dsq);
                const mag = dt / (dsq * dst);
                const mi = bi.mass;

                bi.vx -= dx * bj.mass * mag;
                bi.vy -= dy * bj.mass * mag;
                bi.vz -= dz * bj.mass * mag;

                bj.vx += dx * mi * mag;
                bj.vy += dy * mi * mag;
                bj.vz += dz * mi * mag;
            }
        }

        for (bodies) |*bi| {
            bi.x += dt * bi.vx;
            bi.y += dt * bi.vy;
            bi.z += dt * bi.vz;
        }
    }
}

pub fn energy(bodies: []const Planet) f64 {
    var e: f64 = 0.0;

    for (bodies, 0..) |bi, i| {
        e += 0.5 * (bi.vx * bi.vx + bi.vy * bi.vy + bi.vz * bi.vz) * bi.mass;

        for (bodies[i + 1 ..]) |bj| {
            const dx = bi.x - bj.x;
            const dy = bi.y - bj.y;
            const dz = bi.z - bj.z;
            const dist = @sqrt(dx * dx + dy * dy + dz * dz);
            e -= bi.mass * bj.mass / dist;
        }
    }

    return e;
}

pub fn offset_momentum(bodies: []Planet) void {
    var px: f64 = 0.0;
    var py: f64 = 0.0;
    var pz: f64 = 0.0;

    for (bodies) |b| {
        px += b.vx * b.mass;
        py += b.vy * b.mass;
        pz += b.vz * b.mass;
    }

    var sun = &bodies[0];
    sun.vx = -px / solar_mass;
    sun.vy = -py / solar_mass;
    sun.vz = -pz / solar_mass;
}
