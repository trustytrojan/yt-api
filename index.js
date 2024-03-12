// node
import { argv, exit } from 'process';

// npm
import express from 'express';
import cors from 'cors';

// yt-api
import * as yts from './search.js';
import * as validate from './validate.js';
import * as util from './util.js';
import ytdl from '@distube/ytdl-core';

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
	async ({ params: { idOrUrl }, query: { itags } }, res) => {
		// get video info
		const { formats, details } = await util.getInfo(idOrUrl);

		// get stream urls
		const urls = (itags.length
			? formats.filter(f => itags.includes(String(f.itag)))
			: [
				ytdl.chooseFormat(formats, { filter: 'audioonly', quality: 'highestaudio' }),
				ytdl.chooseFormat(formats, { filter: 'videoonly', quality: 'highestvideo' })
			]
		).map(f => f.url);

		if (!urls.length)
			return res.status(400).send('no formats were found with the provided itags!\r\n');

		// set proper headers
		res.setHeader('Content-Type', 'video/mkv');
		res.setHeader('Content-Disposition', `attachment; filename="${details.title}.mkv"`);

		// start ffmpeg and begin streaming
		const ffmpeg = util.spawnFfmpeg(urls, details);
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
