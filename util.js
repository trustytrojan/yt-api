// node
import { spawn } from 'child_process';

// npm
import ytdl from '@distube/ytdl-core';

/** @type {Record<string, {formats: ytdl.videoFormat[], details: ytdl.MoreVideoDetails}>} */
const infoCache = {};

/**
 * A wrapper over `ytdl.getInfo`, with a cache containing only relevant data.
 * Info objects expire once their format URLs expire.
 * @param {string} idOrUrl 
 */
export const getInfo = async (idOrUrl) => {
	const id = ytdl.getVideoID(idOrUrl);
	if (infoCache[id])
		return infoCache[id];
	const { player_response: { streamingData: { expiresInSeconds } }, formats, videoDetails: details } = await ytdl.getInfo(id);
	setTimeout(() => delete infoCache[id], expiresInSeconds * 1e3);
	return infoCache[id] = { formats, details };
};

/**
 * @param {string[]} urls 
 * @param {ytdl.MoreVideoDetails} details 
 */
export const spawnFfmpeg = (urls, details) => {
	const inputs = [];
	for (const url of urls)
		inputs.push('-reconnect', '1', '-i', url);
	return spawn('ffmpeg', [
		'-hide_banner',
		...inputs,
		'-metadata', `title=${details.title}`,
		'-metadata', `artist=${details.ownerChannelName}`,
		'-metadata', `date=${details.publishDate.substring(0, 10)}`,
		'-metadata', `duration=${details.lengthSeconds}`,
		'-c', 'copy',
		'-f', 'matroska',
		'-'
	], {
		// timeout may have to be lengthened, some videos may take too long to mux
		// we can also deny the request if that happens
		timeout: Number.parseInt(details.lengthSeconds) * 1e3,
		
		stdio: ['ignore', 'pipe', 'inherit'],

		// SIGKILL prevents zombie ffmpeg processes
		killSignal: 'SIGKILL'
	});
};
