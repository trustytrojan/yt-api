/**
 * This is an adapted version of https://github.com/fent/node-ytdl-core/blob/cc6720f9387088d6253acc71c8a49000544d4d2a/example/ffmpeg.js
 * Streams the highest quality audio and video from YouTube to VLC, by combining the separate streams with ffmpeg.
 */

import { spawn } from 'child_process';
import ytdl from 'ytdl-core';

// YouTube video ID or URL
const ref = 'GDGVg3Yp8U8';

// Start audio and video streams
const audio = ytdl(ref, { filter: 'audioonly', quality: 'highestaudio' });
const video = ytdl(ref, { filter: 'videoonly', quality: 'highestvideo' });

// Start ffmpeg process
const ffmpeg = spawn('ffmpeg', [
	// Remove ffmpeg's console spamming
	'-log_level', '0', '-hide_banner',

	// Input files
	'-i', 'pipe:3',
	'-i', 'pipe:4',

	// Copy video and audio codecs, aka don't waste time re-encoding anything
	'-c:v', 'copy',
	'-c:a', 'copy',

	// Output container format
	'-f', 'matroska',

	// Output file
	'pipe:5'
], {
	windowsHide: true,
	stdio: [
		// Ignore the standard streams (0, 1, 2)
		'ignore', 'ignore', 'ignore',

		// Use pipes 3, 4, and 5
		'pipe', 'pipe', 'pipe'
	]
});

// Connect the audio and video streams to ffmpeg
audio.pipe(ffmpeg.stdio[3]);
video.pipe(ffmpeg.stdio[4]);

// Start vlc process that plays from stdin
const vlc = spawn('vlc', ['-'], { stdio: ['pipe'] });

// Connect ffmpeg to vlc
ffmpeg.stdio[5].pipe(vlc.stdin);
