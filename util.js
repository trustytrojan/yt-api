import { validationResult } from 'express-validator';
import { spawn } from 'child_process';
import ytdl from 'ytdl-core';

export const containerMap = {
	webm: 'webm',
	matroska: 'mkv'
};

/**
 * Mimics Python's `min`.
 * @template T 
 * @param {T[]} arr 
 * @param {((_: T) => string | number)} key 
 */
export const min = (arr, key = null) =>
	arr.reduce(key
		? (prev, curr) => (key(curr) < key(prev)) ? curr : prev
		: (prev, curr) => (curr < prev) ? curr : prev);

/** @type {import('express').RequestHandler} */
export const validateInputs = (req, res, next) => {
	const errors = {};

	for (const { location, path, msg } of validationResult(req).array()) {
		if (!errors[location])
			errors[location] = {};
		errors[location][path] = msg;
	}

	for (const _ in errors)
		// if errors is empty this won't run
		return res.status(400).json({ errors });

	next();
};

/**
 * @param {import('express').Request} req 
 * @param 
 */
export const getHighestQualityAVStream = async ({ params: { idOrUrl }, query }) => {
	const container = query.c ?? query.container ?? 'matroska';

	/** @type {ytdl.Filter} */
	const videoFilter = (container === 'webm')
		? format => format.videoCodec === 'vp9'
		: 'videoonly';

	const { formats, videoDetails } = await ytdl.getInfo(idOrUrl);
	const audio = ytdl.chooseFormat(formats, { filter: 'audioonly', quality: 'highestaudio' }).url;
	const video = ytdl.chooseFormat(formats, { filter: videoFilter, quality: 'highestvideo' }).url;

	return {
		videoDetails,
		stream: ffmpegStream([audio, video], videoDetails, container),
		container
	};
};

/**
 * Returns the desired format based on the request's query parameters.
 * @param {ytdl.videoFormat[]} formats 
 * @param {'audio' | 'video'} type
 * @param {Record<string, string>} query 
 */
const getDesiredFormat = (formats, type, { br, bitrate, lq, lowestQuality }) => {
	formats = ytdl.filterFormats(formats, `${type}only`);

	if (lq || lowestQuality)
		return ytdl.chooseFormat(formats, { quality: `lowest${type}` });

	// Find format with closest bitrate
	bitrate = Number.parseInt(br ?? bitrate);
	if (!isNaN(bitrate)) // if bitrate was provided
		return min(formats, format => Math.abs(format[`${type === 'video' ? 'b' : 'audioB'}itrate`] - bitrate));

	return ytdl.chooseFormat(formats, { quality: `highest${type}` });
};

/**
 * Called by `/yt/stream/audio` and `/yt/stream/video`.
 * @param {'audio' | 'video'} type
 * @param {import('express').Request} req
 */
export const getAudioOnlyOrVideoOnlyStream = async (type, { params: { idOrUrl }, query }) => {
	const container = query.c ?? query.container ?? 'matroska';
	const { formats, videoDetails } = await ytdl.getInfo(idOrUrl);
	return {
		videoDetails,
		stream: ffmpegStream([getDesiredFormat(formats, type, query).url], videoDetails, container),
		container
	};
};

/**
 * @param {string[]} urls
 * @param {ytdl.MoreVideoDetails} videoDetails 
 * @param {'matroska' | 'webm'} container 
 */
export const ffmpegStream = (inputs, { title, ownerChannelName, publishDate, lengthSeconds }, container) => {
	const _inputs = [];
	for (const input of inputs)
		_inputs.push('-i', input);

	return spawn('ffmpeg', [
		// '-loglevel', '0',
		'-hide_banner',
		..._inputs,
		'-metadata', `title=${title}`,
		'-metadata', `artist=${ownerChannelName}`,
		'-metadata', `date=${publishDate.substring(0, 10)}`,
		'-metadata', `duration=${lengthSeconds}`,
		'-c:v', 'copy',
		'-c:a', 'copy',
		'-f', container,
		'-'
	], {
		timeout: Number.parseInt(lengthSeconds) * 1e3,
		stdio: ['ignore', 'pipe', 'inherit'],
		// when a client unexpectedly stops streaming, ffmpeg becomes a zombie process and no longer responds to signals.
		// sending SIGKILL when the timeout is reached handles this case.
		killSignal: 'SIGKILL'
	}).stdout;
};
