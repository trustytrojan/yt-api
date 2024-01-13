import { spawn } from 'child_process';

/**
 * Mimics Python's `min`.
 * @template T
 * @param {T[]} arr 
 * @param {((_: T) => string | number) | undefined} key 
 */
export const min = (arr, key) =>
	arr.reduce(key
		? (prev, curr) => (key(curr) < key(prev)) ? curr : prev
		: (prev, curr) => (curr < prev) ? curr : prev);

/**
 * @param {import('express').Response} res 
 * @param {string} errorType 
 * @returns An error handler that logs the error and sends status 500 to the client.
 */
export const internalServerErrorHandler = (res, errorType) =>
	error => {
		console.error(`${errorType} error: ${error}`);
		res.sendStatus(500);
	};

/**
 * @param {NodeJS.ReadableStream} audio An audio stream with a Matroska-compatible codec
 * @param {NodeJS.ReadableStream} video A video stream with a Matroska-compatible codec
 * @param {NodeJS.WritableStream} destination Destination stream
 * @returns The `ffmpeg` child process object
 */
export const combineStreams = (audio, video, destination) => {
	const ffmpeg = spawn('ffmpeg', [
		'-i', 'pipe:3',
		'-i', 'pipe:4',
		'-c:v', 'copy',
		'-c:a', 'copy',
		'-f', 'matroska', 'pipe:5'
	], {
		windowsHide: true,
		stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe', 'pipe'],
	});
	audio.pipe(ffmpeg.stdio[3]);
	video.pipe(ffmpeg.stdio[4]);
	ffmpeg.stdio[5].pipe(destination);
	return ffmpeg;
};
