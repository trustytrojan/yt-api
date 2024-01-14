/**
 * Adapted from https://github.com/fent/node-ytdl-core/blob/cc6720f9387088d6253acc71c8a49000544d4d2a/example/ffmpeg.js
 * This is a very simple YouTube downloader that always downloads the highest quality video (and audio).
 */

import ytdl from 'ytdl-core';
import { spawn } from 'child_process';
import { ArgumentParser } from 'argparse';

const argParser = new ArgumentParser({ description: 'Streams the highest quality audio and video from YouTube to VLC, using ffmpeg to combine the separate streams.' });
argParser.add_argument('idOrUrl', { help: 'YouTube video ID or URL' });
argParser.add_argument('outputFile', { help: "Desired output file; this is passed to ffmpeg, so '-' means stdout" });
argParser.add_argument('--codec', { help: 'Desired video codec; ytdl will error if unavailable. Use `ytdl` to list available formats.' });
argParser.add_argument('--container', { help: 'Desired video container; ffmpeg will error if incompatible with --codec. Use `ytdl` to list available formats.' });
argParser.add_argument('--noPipe', { action: 'store_true', help: 'Instead of piping from node to ffmpeg, let ffmpeg download the audio and video. This may be problematic since ffmpeg downloads at the same rate at which it encodes.' });
const args = argParser.parse_args();

// Get the highest quality audio and video streams
const info = await ytdl.getInfo(args.idOrUrl);

/** @type {ytdl.chooseFormatOptions} */
const audioFormatOptions = { filter: 'audioonly', quality: 'highestaudio' };

/** @type {ytdl.chooseFormatOptions} */
const videoFormatOptions = {
	filter: args.codec ? (format => format.videoCodec.includes(args.codec)) : 'videoonly',
	quality: 'highestvideo'
};

let audio, video;
if (args.noPipe) {
	// Set audio and video to their respective stream URLs
	audio = ytdl.chooseFormat(info.formats, audioFormatOptions).url;
	video = ytdl.chooseFormat(info.formats, videoFormatOptions).url;
} else {
	// Set audio and video to ReadableStreams from ytdl
	audio = ytdl(args.idOrUrl, audioFormatOptions);
	video = ytdl(args.idOrUrl, videoFormatOptions);
}

const stdio = ['ignore', ((args.outputFile === '-') ? 'inherit' : 'ignore'), 'inherit'];
if (!args.noPipe) {
	stdio.push('pipe', 'pipe');
}

const ffmpeg = spawn('ffmpeg', [
	'-hide_banner',

	// Input files
	'-i', args.noPipe ? audio : 'pipe:3',
	'-i', args.noPipe ? video : 'pipe:4',

	// "Copy" video and audio codecs; don't waste time re-encoding anything
	'-c:v', 'copy',
	'-c:a', 'copy',

	// Insert metadata from YouTube
	'-metadata', `title=${info.videoDetails.title}`,
	'-metadata', `artist=${info.videoDetails.ownerChannelName}`,
	'-metadata', `date=${info.videoDetails.publishDate.substring(0, 10)}`,

	// Output container
	'-f', args.container ?? 'matroska', // Sane default

	// Output file
	args.outputFile
], { windowsHide: true, stdio });

if (args.noPipe) {
	ffmpeg.unref();
} else {
	// Pipe audio and video to ffmpeg
	audio.pipe(ffmpeg.stdio[3]);
	video.pipe(ffmpeg.stdio[4]);
}
