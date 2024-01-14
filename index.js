import express from 'express';
import ytdl from 'ytdl-core';
import * as ytsa from './ytsa.js';
import { argv, exit } from 'process';
import { internalServerErrorHandler, min } from './util.js';
import { spawn } from 'child_process';

if (argv.length !== 3) {
	console.error('Required args: <port>');
	exit(1);
}

const port = Number.parseInt(argv[2]);

const app = express();

/** 
 * streams the highest quality video+audio back to the client
 * `idOrUrl`: the YouTube video ID or URL
 * `c`, `container`: the video container type. currently only 'webm' is accepted.
 */
app.get('/yt/stream/:idOrUrl', async (req, res) => {
	const { idOrUrl } = req.params;
	const container = req.query.c ?? req.query.container ?? 'matroska';

	const audio = ytdl(idOrUrl, { filter: 'audioonly', quality: 'highestaudio' })
		.on('error', internalServerErrorHandler(res, 'ytdl audio'))
		.on('end', () => console.log('audio download finished'));
	
	/** @type {ytdl.Filter} */
	const videoFilter = (container === 'webm')
		? format => format.videoCodec === 'vp9'
		: 'videoonly';
	
	const video = ytdl(idOrUrl, { filter: videoFilter, quality: 'highestvideo' })
		.on('error', internalServerErrorHandler(res, 'ytdl video'));

	const { videoDetails } = await ytdl.getBasicInfo(idOrUrl);

	const ffmpeg = spawn('ffmpeg', [
		//'-loglevel', '0',
		'-hide_banner',
		'-i', 'pipe:3',
		'-i', 'pipe:4',
		'-metadata', `title=${videoDetails.title}`,
		'-metadata', `artist=${videoDetails.ownerChannelName}`,
		'-metadata', `date=${videoDetails.publishDate.substring(0, 10)}`,
		'-c:v', 'copy',
		'-c:a', 'copy',
		'-f', container,
		'-'
	], {
		windowsHide: true,
		stdio: ['ignore', 'pipe', 'inherit', 'pipe', 'pipe']
	});

	audio.pipe(ffmpeg.stdio[3]);
	video.pipe(ffmpeg.stdio[4]);
	ffmpeg.stdout.pipe(res);
});

/**
 * get an audio-only stream URL, defaults to highest quality
 * `idOrUrl`: the YouTube video ID or URL
 * `lq`: if true, returns the lowest quality stream URL
 * `br`: if provided, returns a stream URL whose bitrate is closest to `br`
 */
app.get('/yt/stream/audio/:idOrUrl', async (req, res) => {
	const { idOrUrl } = req.params;

	const lowestQuality = (req.query.lq === '1');

	let bitrate = req.query.br;
	if (bitrate) {
		bitrate = Number.parseInt(req.query.br);
		if (Number.isNaN(bitrate)) {
			res.status(400).send('Parameter `br` must be an integer.\n');
			return;
		}
	}

	let { formats } = await ytdl.getInfo(idOrUrl);
	formats = ytdl.filterFormats(formats, 'audioonly');

	if (lowestQuality) {
		const format = ytdl.chooseFormat(formats, { quality: 'lowestaudio' });
		res.redirect(301, format.url);
		return;
	}

	if (bitrate) {
		const format = min(formats, format => format.audioBitrate < bitrate);
		res.redirect(301, format.url);
		return;
	}

	const format = ytdl.chooseFormat(formats, { quality: 'highestaudio' });
	res.redirect(301, format.url);
});

/**
 * get an video-only stream URL, defaults to highest quality
 * `idOrUrl`: the YouTube video ID or URL
 * `lq`: if true, returns the lowest quality stream URL
 * `br`: if provided, returns a stream URL whose bitrate is closest to `br`
 */
app.get('/yt/stream/video/:idOrUrl', async (req, res) => {
	const { idOrUrl } = req.params;

	const lowestQuality = (req.query.lq === '1');

	let bitrate = req.query.br;
	if (bitrate) {
		bitrate = Number.parseInt(req.query.br);
		if (Number.isNaN(bitrate)) {
			res.status(400).send('Parameter `br` must be an integer.\n');
			return;
		}
	}

	let { formats } = await ytdl.getInfo(idOrUrl);
	formats = ytdl.filterFormats(formats, 'videoonly');

	if (lowestQuality) {
		const format = ytdl.chooseFormat(formats, { quality: 'lowestvideo' });
		res.redirect(301, format.url);
		return;
	}

	if (bitrate) {
		const format = min(formats, format => format.bitrate < bitrate);
		res.redirect(301, format.url);
		return;
	}

	const format = ytdl.chooseFormat(formats, { quality: 'highestvideo' });
	res.redirect(301, format.url);
});

/**
 * return search results for `query`
 */
app.get('/yt/search/:query', (req, res) => {
	const { query } = req.params;

	const type = req.query.t ?? req.query.type;
	if (type && !['video', 'channel', 'playlist', 'movie'].includes(type)) {
		res.status(400).send("Parameter `type` or `t` must be one of ['video', 'channel', 'playlist', 'movie'].\n");
		return;
	}

	// switch value
	const withPlaylists = Boolean(req.query.p ?? req.query.playlists);

	// must be an integer
	let limit = req.query.l ?? req.query.limit;
	if (limit)
		try { limit = Number.parseInt(limit); }
		catch {
			res.status(400).send('Parameter `limit` or `l` must be an integer.\n');
			return;
		}

	ytsa.search(query, { withPlaylists, limit, type }).then(res.json.bind(res));
});

/**
 * return the next page of search results using the `nextPage` object returned
 * from the `/yt/search` endpoint
 */
app.post('/yt/search/nextpage', express.json(), (req, res) => {
	// switch value
	const withPlaylists = Boolean(req.query.p ?? req.query.playlists);

	// must be an integer
	let limit = req.query.l ?? req.query.limit;
	if (limit) {
		try { limit = Number.parseInt(limit); }
		catch {
			res.status(400).send('Parameter `limit` or `l` must be an integer.\n');
			return;
		}
	}

	ytsa.nextPage(req.body, { withPlaylists, limit }).then(res.json.bind(res));
});

app.listen(port, () => console.log(`Listening on ${port}`));
