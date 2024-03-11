// node
import { argv, exit } from 'process';
import { spawn } from 'child_process';

// npm
import express from 'express';
import ytdl from '@distube/ytdl-core';
import cors from 'cors';

// yt-api
import * as yts from './search.js';
import * as validate from './validate.js';

if (!argv[2]?.length) {
	console.error('Required args: <port>');
	exit(1);
}

const port = Number.parseInt(argv[2]);
const app = express();
app.use(cors());

/** @type {Record<string, {formats: ytdl.videoFormat[], details: ytdl.MoreVideoDetails}>} */
const infoCache = {};

/**
 * @param {string} idOrUrl 
 */
const getInfo = async (idOrUrl) => {
	const id = ytdl.getVideoID(idOrUrl);
	if (infoCache[id])
		return infoCache[id];
	const { player_response: { streamingData: { expiresInSeconds } }, formats, videoDetails: details } = await ytdl.getInfo(id);
	setTimeout(() => delete infoCache[id], expiresInSeconds * 1e3);
	return infoCache[id] = { formats, details };
};

/**
 * Guarantees to return either one format, or two formats in the order `[audio, video]`.
 * @param {ytdl.videoFormat[]} formats 
 * @param {string[]} [itags] 
 */
const itagsToFormats = (formats, itags) => {
	if (!itags)
		return [
			ytdl.chooseFormat(formats, { filter: 'audioonly', quality: 'highestaudio' }),
			ytdl.chooseFormat(formats, { filter: 'videoonly', quality: 'highestvideo' })
		];
	formats = formats.filter(f => itags.includes(String(f.itag)));
	if (formats.length === 1)
		return formats;
	return [
		formats.find(f => f.hasAudio && !f.hasVideo),
		formats.find(f => !f.hasAudio && f.hasVideo)
	];
};

/**
 * @param {string[]} inputs 
 * @param {ytdl.MoreVideoDetails} details 
 */
const spawnFfmpeg = (inputs, details) => {
	const _inputs = [];
	for (const input of inputs)
		_inputs.push('-reconnect', '1', '-i', input);
	return spawn('ffmpeg',
		[
			'-hide_banner',
			..._inputs,
			'-metadata', `title=${details.title}`,
			'-metadata', `artist=${details.ownerChannelName}`,
			'-metadata', `date=${details.publishDate.substring(0, 10)}`,
			'-metadata', `duration=${details.lengthSeconds}`,
			'-c', 'copy',
			'-f', 'matroska',
			'-'
		],
		{
			// timeout may have to be lengthened, some videos may take too long to mux
			// we can also deny the request if that happens
			timeout: Number.parseInt(details.lengthSeconds) * 1e3,
			stdio: ['ignore', 'pipe', 'inherit'],
			// SIGKILL prevents zombie ffmpeg processes
			killSignal: 'SIGKILL'
		}
	);
}

app.get('/yt/dl/:idOrUrl',
	validate.itags,
	validate.checkForErrors,
	async ({ params: { idOrUrl }, query: { itags } }, res) => {
		const { formats, details } = await getInfo(idOrUrl);
		const urls = itagsToFormats(formats, itags).map(f => f.url);
		const ffmpeg = spawnFfmpeg(urls, details);
		res.setHeader('Content-Type', 'video/mkv');
		res.setHeader('Content-Disposition', `attachment; filename="${details.title}.mkv"`);
		ffmpeg.stdout.pipe(res);
	}
);

app.get('/yt/info/:idOrUrl', ({ params: { idOrUrl } }, res) =>
	getInfo(idOrUrl)
		.then(res.json.bind(res))
		.catch(err => {
			console.error(err);
			if (err.statusCode)
				res.sendStatus(err.statusCode);
		})
);

app.get('/yt/search',
	validate.q,
	validate.type,
	validate.checkForErrors,
	({ query: { type, q } }, res) =>
		yts.search(q, type)
			.then(res.json.bind(res))
			.catch(err => {
				console.error(err);
				res.sendStatus(500);
			})
);

app.post('/yt/search/nextpage',
	// NOTE: the request MUST have 'Content-Type: application/json', otherwise express gives you an empty object.
	// i know this behavior is documented, but come on, at least return 400 by default or something?
	express.json(),
	...validate.nextPageCtx,
	validate.checkForErrors,
	({ body }, res) =>
		yts.nextPage(body)
			.then(res.json.bind(res))
			.catch(err => {
				if (typeof err === 'string')
					res.status(400).send(err);
				else {
					console.error(err);
					res.sendStatus(500);
				}
			})
);

app.listen(port, () => console.log(`Listening on ${port}`));
