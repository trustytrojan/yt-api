import { spawn } from 'node:child_process';
import ytdl from '@distube/ytdl-core';

/**
 * A cache for storing only the necessary data from calls to `ytdl.getInfo`.
 * Info objects expire once their format URLs expire.
 */
const infoCache: Record<
	string,
	{
		formats: ytdl.videoFormat[];
		details: ytdl.MoreVideoDetails;
	}
> = {};

/**
 * A wrapper over `ytdl.getInfo`, using a cache containing only relevant data.
 */
export const getInfo = async (idOrUrl: string) => {
	const id = ytdl.getVideoID(idOrUrl);
	if (id in infoCache) return infoCache[id];
	const {
		player_response: {
			streamingData: { expiresInSeconds }
		},
		formats,
		videoDetails: details
	} = await ytdl.getInfo(id);
	setTimeout(() => delete infoCache[id], Number(expiresInSeconds) * 1e3);
	return (infoCache[id] = Object.freeze({ formats, details }));
};

/**
 * Using query parameters, decide which formats to return.
 * `itags` takes priority over `only`.
 * If neither are defined, the highest quality audio and video formats are returned.
 */
export const decideFormats = (
	formats: ytdl.videoFormat[],
	{ itags, only }: Record<string, any>
) => {
	if (itags?.length) return formats.filter(f => itags.includes(String(f.itag)));
	if (only)
		return [
			ytdl.chooseFormat(formats, {
				filter: `${only}only` as ytdl.Filter,
				quality: `highest${only}`
			})
		];
	return [
		ytdl.chooseFormat(formats, { filter: 'audioonly', quality: 'highestaudio' }),
		ytdl.chooseFormat(formats, { filter: 'videoonly', quality: 'highestvideo' })
	];
};

/**
 * Spawn `ffmpeg` as a child process to mux the audio and video, if both are provided, of a YouTube video together.
 * Inserts the video details into the output file's metadata.
 * Outputs Matroska (`.mkv`) files by default.
 */
export const spawnFfmpeg = (
	urls: string[],
	details: ytdl.MoreVideoDetails,
	container?: string | null
) => {
	const inputs = urls.flatMap(url => ['-reconnect', '1', '-i', url]);
	console.log(inputs);
	return spawn(
		'ffmpeg',
		[
			'-hide_banner',

			// insert inputs
			...inputs,

			// insert youtube metadata
			'-metadata',
			`title=${details.title}`,
			'-metadata',
			`artist=${details.ownerChannelName}`,
			'-metadata',
			`date=${details.publishDate.substring(0, 10)}`,
			'-metadata',
			`duration=${details.lengthSeconds}`,

			// unless container is specified, copy all streams, don't re-encode
			...(container ? [] : ['-c', 'copy']),

			// output container/format
			'-f',
			container || 'matroska',

			// output file
			'-'
		],
		{
			// kill ffmpeg after the length of the media has passed.
			// ffmpeg will finish at least twice as fast as the length of the media,
			// so it will most likely have enough time to finish.
			timeout: Number(details.lengthSeconds) * 1e3,

			// ignore stdin, read stdout, inherit stderr
			stdio: ['ignore', 'pipe', 'inherit'],

			// make sure we can kill zombie ffmpeg processes
			killSignal: 'SIGKILL'
		}
	);
};
