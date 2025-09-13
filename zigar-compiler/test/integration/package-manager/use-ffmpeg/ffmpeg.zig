const av = @cImport({
    @cInclude("libavcodec/avcodec.h");
    @cInclude("libavformat/avformat.h");
    @cInclude("libavfilter/buffersink.h");
    @cInclude("libavfilter/buffersrc.h");
    @cInclude("libavutil/channel_layout.h");
    @cInclude("libavutil/mem.h");
    @cInclude("libavutil/opt.h");
    @cInclude("libavutil/pixdesc.h");
});

const Transcoder = struct {
    ifmt_ctx: *av.AVFormatContext,
    dec_ctx: *av.AVCodecContext,
    enc_ctx: *av.AVCodecContext,
    dec_frame: *av.AVFrame,

    pub fn openInputFile(self: *@This(), inputPath: [*:0]const u8) !void {
        if (av.avformat_open_input(@ptrCast(&self.ifmt_ctx), inputPath, null, null) < 0) return error.CannotOpenInputFile;
        if (av.avformat_find_stream_info(self.ifmt_ctx, null) < 0) return error.CannotFindStreamInformation;
        for (0..self.ifmt_ctx.nb_streams) |i| {
            const stream: *av.AVStream = @ptrCast(self.ifmt_ctx.streams[i] orelse return error.Unexpected);
            const codecpar: *av.AVCodecParameters = @ptrCast(stream.codecpar orelse return error.Unexpected);
            const dec = av.avcodec_find_decoder(codecpar.codec_id) orelse return error.FailedToFindDecoder;
            self.dec_ctx = @ptrCast(av.avcodec_alloc_context3(dec) orelse return error.FailedToAllocateDecoderContext);
            if (av.avcodec_parameters_to_context(self.dec_ctx, codecpar) < 0) return error.FailedToCopyDecoderParameters;
            self.dec_ctx.pkt_timebase = stream.time_base;
            if (self.dec_ctx.codec_type == av.AVMEDIA_TYPE_VIDEO or self.dec_ctx.codec_type == av.AVMEDIA_TYPE_AUDIO) {
                if (self.dec_ctx.codec_type == av.AVMEDIA_TYPE_VIDEO) {
                    self.dec_ctx.framerate = av.av_guess_frame_rate(self.ifmt_ctx, stream, null);
                }
                if (av.avcodec_open2(self.dec_ctx, dec, null) < 0) return error.FailedToOpenDecoder;
            }
            self.dec_frame = av.av_frame_alloc() orelse return error.OutOfMemory;
        }
    }
};

pub fn transcode(inputPath: [*:0]const u8, outputPath: [*:0]const u8) !void {
    var transcoder: Transcoder = undefined;
    try transcoder.openInputFile(inputPath);
    _ = outputPath;
}
