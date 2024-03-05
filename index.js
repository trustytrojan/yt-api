// node
import { argv, exit } from 'process';

// npm
import express from 'express';
import ytdl from '@distube/ytdl-core';
import cors from 'cors';

// yt-api
import * as yts from './search.js';
import { validateInputs } from './util.js';
import { audioAndVideo, audioOrVideo } from './chooseFormat.js';
import * as ffmpegUtils from './ffmpeg.js';
import { validate } from './ev.js';

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
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const ytStream = async ({ params: { idOrUrl, av }, query }, res) => {
	if (!query.container) query.container = 'matroska';
	if (query.dl) res.setHeader('Content-Disposition', 'attachment');
	const { formats, details } = await getInfo(idOrUrl);
	const chosenFormats = (av ? audioOrVideo : audioAndVideo)(formats, query, av);
	const urls = chosenFormats.map(f => f.url);
	const ffmpeg = ffmpegUtils.spawn(
		ffmpegUtils.makeArgs(urls, details, query.container),
		ffmpegUtils.makeSpawnOptions(details, 0)
	);
	if (!ffmpeg.stdout)
		return res.sendStatus(500);
	res.on('close', () => ffmpeg.kill('SIGKILL'));
	ffmpeg.stdout.pipe(res);
};

app.get('/yt/stream/:idOrUrl',
	validate.dl,
	validate.container,
	validate.lowestQuality,
	validate.audioBitrate,
	validate.videoBitrate,
	validateInputs,
	ytStream
);

app.get('/yt/stream/:av/:idOrUrl',
	validate.dl,
	validate.av,
	validate.container,
	validate.lowestQuality,
	validate.bitrate,
	validateInputs,
	ytStream
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

app.get('/yt/search/:query',
	validate.type,
	validateInputs,
	({ query: { type }, params: { query } }, res) =>
		yts.search(query, type)
			.then(res.json.bind(res))
			.catch(err => {
				console.error(err);
				res.sendStatus(500);
			})
);

app.post('/yt/search/nextpage',
	express.json(),
	validateInputs,
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
