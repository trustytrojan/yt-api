// node
import { spawn } from 'child_process';

// npm
import ytdl from '@distube/ytdl-core';

/**
 * A cache for storing only the necessary data from calls to `ytdl.getInfo`.
 * Info objects expire once their format URLs expire.
 * @type {Record<string, {formats: ytdl.videoFormat[], details: ytdl.MoreVideoDetails}>}
 */
const infoCache = {};

/**
 * A wrapper over `ytdl.getInfo`, using a cache containing only relevant data.
 * @param {string} idOrUrl 
 */
export const getInfo = async (idOrUrl) => {
	const id = ytdl.getVideoID(idOrUrl);
	if (infoCache[id])
		return infoCache[id];
	const { player_response: { streamingData: { expiresInSeconds } }, formats, videoDetails: details } = await ytdl.getInfo(id);
	setTimeout(() => delete infoCache[id], expiresInSeconds * 1e3);
	return infoCache[id] = Object.freeze({ formats, details });
};

/**
 * Using query parameters, decide which formats to return.
 * `itags` takes priority over `only`.
 * If neither are defined, the highest quality audio and video formats are returned.
 * @param {ytdl.videoFormat[]} formats 
 * @param {import('qs').ParsedQs} 
 */
export const decideFormats = (formats, { itags, only }) => {
	if (itags?.length) return formats.filter(f => itags.includes(String(f.itag)));
	if (only) return [ytdl.chooseFormat(formats, { filter: `${only}only`, quality: `highest${only}` })];
	return [
		ytdl.chooseFormat(formats, { filter: 'audioonly', quality: 'highestaudio' }),
		ytdl.chooseFormat(formats, { filter: 'videoonly', quality: 'highestvideo' })
	];
};

/**
 * Spawn `ffmpeg` as a child process to mux the audio and video, if both are provided, of a YouTube video together.
 * Inserts the video details into the output file's metadata.
 * Always outputs Matroska (`.mkv`) files.
 * @param {string[]} urls 
 * @param {ytdl.MoreVideoDetails} details 
 * @param {string} [container]
 */
export const spawnFfmpeg = (urls, details, container) => {
	const inputs = [];
	for (const url of urls)
		inputs.push('-reconnect', '1', '-i', url);
	return spawn('ffmpeg', [
		'-hide_banner',

		// insert inputs
		...inputs,

		// insert youtube metadata
		'-metadata', `title=${details.title}`,
		'-metadata', `artist=${details.ownerChannelName}`,
		'-metadata', `date=${details.publishDate.substring(0, 10)}`,
		'-metadata', `duration=${details.lengthSeconds}`,

		// unless container is specified, copy all streams, don't re-encode
		...(container ? [] : ['-c', 'copy']),

		// output container/format
		'-f', (container || 'matroska'),

		// output file
		'-'
	], {
		// kill ffmpeg after the length of the media has passed.
		// ffmpeg will finish at least twice as fast as the length of the media,
		// so only rarely will this be used. better safe than sorry, though.
		timeout: parseInt(details.lengthSeconds) * 1e3,

		// ignore stdin, read stdout, inherit stderr
		stdio: ['ignore', 'pipe', 'inherit'],

		// make sure we can kill zombie ffmpeg processes
		killSignal: 'SIGKILL'
	});
};
