// node
import { argv, exit } from 'process';
import { existsSync, createWriteStream } from 'fs';

// npm
import express from 'express';

// yt-api
import * as yts from './search.js';
import * as validate from './validate.js';
import * as util from './util.js';
import * as cache from './cache.js';

if (!argv[2]?.length) {
	console.error('Required args: <port>');
	exit(1);
}

const port = Number.parseInt(argv[2]);
const app = express();

app.get('/yt/dl/:idOrUrl',
	validate.itags,
	validate.checkForErrors,
	async ({ params: { idOrUrl }, query }, res) => {
		// get video info and formats
		let { formats, details } = await util.getInfo(idOrUrl);
		formats = util.decideFormats(formats, query);

		if (!formats.length)
			return res.status(400).send('no formats found!\r\n');

		// strip title of header-incompatible characters
		const strippedTitle = details.title.replaceAll(/[\x00-\x20\x7F-\xFF:]/g, '');

		const onlyOneAudio = (formats.length === 1) && formats[0].hasAudio && !formats[0].hasVideo;

		if (!onlyOneAudio && details.lengthSeconds > 3_600)
			return res.status(400).send('video too long!\r\n');

		// if formats contains only one audio format, use mp3
		res.setHeader('Content-Type', onlyOneAudio ? 'audio/mp3' : 'video/x-matroska');
		res.setHeader('Content-Disposition', `attachment; filename="${strippedTitle}.${onlyOneAudio ? 'mp3' : 'mkv'}"`);

		// asynchronously delete old files (oldness defined in cache.js)
		cache.deleteOldFiles();

		// check the cache, return if found
		const cachePath = cache.getPath(formats, details);
		if (existsSync(cachePath))
			return res.sendFile(cachePath);

		// start ffmpeg and begin streaming
		const ffmpeg = util.spawnFfmpeg(formats.map(f => f.url), details, onlyOneAudio ? 'mp3' : null);
		ffmpeg.stdout.pipe(res);
		ffmpeg.stdout.pipe(createWriteStream(cachePath));
	}
);

app.get('/yt/info/:idOrUrl', ({ params: { idOrUrl } }, res) =>
	util.getInfo(idOrUrl)
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
