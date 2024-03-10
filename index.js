// node
import { argv, exit } from 'process';
import cp from 'child_process';
import https from 'https';

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
	if (itags.length === 1)
		return formats;
	return [
		formats.filter(f => f.hasAudio && !f.hasVideo)[0],
		formats.filter(f => !f.hasAudio && f.hasVideo)[0]
	];
};

/**
 * @param {import('express').Response} res
 * @param {import('@distube/ytdl-core').MoreVideoDetails} details 
 * @param {string} input1
 * @param {string} [input2]
 */
const streamFfmpegTo = (res, details, input1, input2) => {
	const ffmpeg = spawn('ffmpeg',
		[
			'-hide_banner',
			'-thread_queue_size', '2000',
			'-i', '-',
			...(input2 ? ['-i', 'pipe:3'] : []),
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
			stdio: ['pipe', 'pipe', 'inherit', ...(input2 ? ['pipe'] : [])],
			// SIGKILL prevents zombie ffmpeg processes
			killSignal: 'SIGKILL'
		}
	);
	https.get(input1, res => res.pipe(ffmpeg.stdin));
	if (input2) https.get(input2, res => res.pipe(ffmpeg.stdio[3]));
	ffmpeg.stdout.pipe(res);
};

app.get('/yt/stream/:idOrUrl',
	validate.itags,
	validate.checkForErrors,
	async ({ params: { idOrUrl }, query: { itags } }, res) => {
		const { formats, details } = await getInfo(idOrUrl);
		const urls = itagsToFormats(formats, itags).map(f => f.url);
		streamFfmpegTo(res, details, ...urls);
	}
);

app.get('/yt/dl/:idOrUrl',
	validate.itags,
	validate.checkForErrors,
	async ({ params: { idOrUrl }, query: { itags } }, res) => {
		const { formats, details } = await getInfo(idOrUrl);
		const urls = itagsToFormats(formats, itags).map(f => f.url);
		// res.setHeader('Content-Type', 'video/mkv');
		res.setHeader('Content-Disposition', `attachment; filename="${details.ownerChannelName} - ${details.title}.mkv"`);
		streamFfmpegTo(res, details, ...urls);
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
	// please remember: the request MUST have 'Content-Type: application/json',
	// otherwise express gives you a fucking empty object. great error indication.
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
