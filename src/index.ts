import fs from 'node:fs';
import { argv, exit } from 'node:process';

import express from 'express';
import * as yts from '@trustytrojan/yt-search';

import * as validate from './validate.ts';
import * as util from './util.ts';
import * as cache from './cache.ts';

if (argv.length < 3) {
	console.error('port required');
	exit(1);
}

const port = parseInt(argv[2]);
const app = express();

app.get('/yt/dl/:idOrUrl', validate.itags, validate.errorCheck, async (req, res) => {
	if (!req.query || !req.params) {
		res.status(500).send('query/params object is undefined?????');
		return;
	}

	// get video info and formats
	let formats, details;

	try {
		({ formats, details } = await util.getInfo(req.params.idOrUrl));
	} catch {
		res.status(400).send('failed to get video info; did you mistakenly send a playlist link?');
		return;
	}

	formats = util.decideFormats(formats, req.query);

	if (!formats.length) {
		res.status(400).send('no formats found!');
		return;
	}

	// strip title of header-incompatible characters
	const strippedTitle = details.title.replaceAll(/:|[^\x20-\x7F]/g, '');

	const onlyAudio = formats.length === 1 && formats[0].hasAudio && !formats[0].hasVideo;

	if (!onlyAudio && Number(details.lengthSeconds) > 3_600) {
		// reject videos over 1 hour long
		// TODO: make an error.html page (with styles) instead of sending text
		res.status(400).send('video too long!');
		return;
	}

	// use mp3 for audio-only downloads
	res.setHeader('Content-Type', onlyAudio ? 'audio/mp3' : 'video/x-matroska');
	res.setHeader(
		'Content-Disposition',
		`attachment; filename="${strippedTitle}.${onlyAudio ? 'mp3' : 'mkv'}"`
	);

	// check the cache, return if found
	const cachePath = cache.getPath(formats, details);
	if (fs.existsSync(cachePath)) {
		res.sendFile(cachePath);
		return;
	}

	cache.deleteOldFiles();

	// start ffmpeg and begin streaming
	const ffmpeg = util.spawnFfmpeg(
		formats.map(f => f.url),
		details,
		onlyAudio ? 'mp3' : null
	);

	ffmpeg.stdout.pipe(res);
	ffmpeg.stdout.pipe(fs.createWriteStream(cachePath));
});

app.get('/yt/info/:idOrUrl', ({ params: { idOrUrl } }, res) =>
	util
		.getInfo(idOrUrl)
		.then(r => void res.json(r))
		.catch(err => {
			// this `err` object is from the ytdl module
			console.error(err);
			if (err.statusCode) res.sendStatus(err.statusCode);
		})
);

app.get('/yt/search', validate.q, validate.type, validate.errorCheck, (req, res) => {
	if (!req.query) {
		res.status(500).send('query object undefined???');
		return;
	}
	const { q, type } = req.query;
	if (typeof q !== 'string') {
		res.sendStatus(500);
		return;
	}
	return (
		yts
			// deno-lint-ignore no-explicit-any
			.search(q, type as any)
			.then(r => void res.json({ results: r[0], nextPageCtx: r[1] }))
			.catch(err => {
				// this `err` object is from the yts module
				console.error(err);
				res.sendStatus(500);
			})
	);
});

app.post(
	'/yt/search/nextpage',
	// NOTE: the request MUST have 'Content-Type: application/json', otherwise express gives you an empty object.
	// i know this behavior is documented, but come on, at least return 400 by default or something?
	express.json(),
	...validate.nextPageCtx,
	validate.errorCheck,
	({ body }, res) =>
		yts
			.nextPage(body)
			.then(r => void res.json(r))
			.catch(err => {
				if (typeof err === 'string') res.status(400).send(err);
				else {
					console.error(err);
					res.sendStatus(500);
				}
			})
);

app.listen(port, () => console.log(`Listening on ${port}`));
