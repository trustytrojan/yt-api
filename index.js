// node
import { argv, exit } from 'process';
import fs from 'fs';

// npm
import express from 'express';
import cors from 'cors';

// yt-api
import * as yts from './search.js';
import * as validate from './validate.js';
import * as util from './util.js';

if (!argv[2]?.length) {
	console.error('Required args: <port>');
	exit(1);
}

const port = Number.parseInt(argv[2]);
const app = express();
app.use(cors());

app.get('/yt/dl/:idOrUrl',
	validate.itags,
	validate.checkForErrors,
	async ({ params: { idOrUrl }, query }, res) => {
		// get video info and formats
		let { formats, details } = await util.getInfo(idOrUrl);
		formats = util.decideFormats(formats, query);

		if (!formats.length)
			return res.status(400).send('no formats found!\r\n');

		// strip title of http-header-incompatible characters
		const notAllowedInHeaders = /[^\t\x20-\x7e\x80-\xff]/g;
		const strippedTitle = details.title.replaceAll(notAllowedInHeaders, '');

		let container;

		// if formats contains only one audio format, use mp3
		if (formats.length === 1 && formats[0].hasAudio && !formats[0].hasVideo) {
			res.setHeader('Content-Type', 'audio/mp3');
			res.setHeader('Content-Disposition', `attachment; filename="${strippedTitle}.mp3"`);
			container = 'mp3';
		} else {
			res.setHeader('Content-Type', 'video/x-matroska');
			res.setHeader('Content-Disposition', `attachment; filename="${strippedTitle}.mkv"`);
		}

		// start ffmpeg and begin streaming
		const ffmpeg = util.spawnFfmpeg(formats.map(f => f.url), details, container);
		ffmpeg.stdout.pipe(res);

		// if the client closes the connection, kill ffmpeg to save resources
		res.on('close', () => ffmpeg.kill('SIGKILL'));
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
