const std = @import("std");

const zigar = @import("zigar");

pub const database = @import("./database.zig");
pub const @"meta(zigar)" = @import("./meta.zig");

var work_queue: zigar.thread.WorkQueue(database) = .{};

pub const remote = struct {
    pub const shutdown = work_queue.promisify(.shutdown);
    pub const open = work_queue.promisify(database.open);
    pub const close = work_queue.promisify(database.close);
    pub const getPosts = work_queue.promisify(database.getPosts);
    pub const getPostsByAuthor = work_queue.promisify(database.getPostsByAuthor);
    pub const getPostsByTag = work_queue.promisify(database.getPostsByTag);
    pub const getPostsByCategory = work_queue.promisify(database.getPostsByCategory);
    pub const getPost = work_queue.promisify(database.getPost);
    pub const findPosts = work_queue.promisify(database.findPosts);
    pub const findPostCount = work_queue.promisify(database.findPostCount);
    pub const getAuthor = work_queue.promisify(database.getAuthor);
    pub const getTag = work_queue.promisify(database.getTag);
    pub const getCategories = work_queue.promisify(database.getCategories);
    pub const getCategory = work_queue.promisify(database.getCategory);
};
