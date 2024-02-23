import express from 'express';
import { argv, exit } from 'process';
import ytdl from '@distube/ytdl-core';

import * as ytsa from './ytsa.js';
import { validateInputs } from './util.js';
import * as chooseFormat from './chooseFormat.js';
import * as ffmpegUtils from './ffmpeg.js';
import { validate } from './ev.js';

if (argv.length !== 3) {
	console.error('Required args: <port>');
	exit(1);
}

const port = Number.parseInt(argv[2]);
const app = express();

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('./chooseFormat.js').ChooseFormatFunction} chooseFormatFunc
 */
const ytStream = async ({ params: { idOrUrl, av }, query }, res, chooseFormatFunc) => {
	if (!query.container)
		query.container = 'matroska';
	const { formats, videoDetails } = await ytdl.getInfo(idOrUrl);
	const chosenFormats = chooseFormatFunc(formats, query, av);
	const urls = chosenFormats.map(f => f.url);
	const ffmpeg = ffmpegUtils.spawn(
		ffmpegUtils.makeArgs(urls, videoDetails, query.container),
		ffmpegUtils.makeSpawnOptions(videoDetails, 0)
	);
	if (!ffmpeg.stdout)
		throw new Error('ffmpeg.stdout is null');
	// if the client disconnects, kill ffmpeg
	res.on('close', () => ffmpeg.kill('SIGKILL'));
	return ffmpeg.stdout;
};

app.get('/yt/stream/:idOrUrl',
	validate.dl,
	validate.container,
	validate.lowestQuality,
	validate.audioBitrate,
	validate.videoBitrate,
	validateInputs,
	async (req, res) => {
		let stream;
		try { stream = await ytStream(req, res, chooseFormat.audioAndVideo); }
		catch (err) {
			console.error(err);
			return res.status(500).send(err.message);
		}
		if (req.query.dl)
			res.setHeader('Content-Disposition', 'attachment');
		stream.pipe(res);
	}
);

app.get('/yt/stream/:av/:idOrUrl',
	validate.dl,
	validate.av,
	validate.container,
	validate.lowestQuality,
	validate.bitrate,
	validateInputs,
	async (req, res) => {
		let stream;
		try { stream = await ytStream(req, res, chooseFormat.audioOrVideo); }
		catch (err) {
			console.error(err);
			return res.status(500).send(err.message);
		}
		if (req.query.dl)
			res.setHeader('Content-Disposition', 'attachment');
		stream.pipe(res);
	}
);

app.get('/yt/search/:query',
	validate.type, validate.limit, validate.withPlaylists, validateInputs,
	({ query: { type, withPlaylists, limit }, params: { query } }, res) => {
		ytsa.search(query, withPlaylists, limit, type).then(res.json.bind(res));
	}
);

app.post('/yt/search/nextpage',
	express.json(), validate.limit, validate.withPlaylists, validateInputs,
	({ query: { withPlaylists, limit }, body }, res) =>
		ytsa.nextPage(body, withPlaylists, limit).then(res.json.bind(res))
);

app.listen(port, () => console.log(`Listening on ${port}`));
