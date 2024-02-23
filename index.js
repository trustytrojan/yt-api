import express from 'express';
import { argv, exit } from 'process';
import { query } from 'express-validator';

import * as ytsa from './ytsa.js';
import { validateInputs, getHighestQualityAVStream, getAudioOnlyOrVideoOnlyStream, containerMap } from './util.js';

if (argv.length !== 3) {
	console.error('Required args: <port>');
	exit(1);
}

const port = Number.parseInt(argv[2]);
const app = express();

// Express middleware functions that validate query parameters
const validate = Object.freeze({
	container: query(['c', 'container'], "must be one of ('matroska', 'webm')").optional().isIn(['matroska', 'webm']),
	lowestQuality: query(['lq', 'lowestQuality'], 'must be a boolean').optional().isBoolean(),
	bitrate: query(['br', 'bitrate'], 'must be an integer').optional().isInt(),
	limit: query(['l', 'limit'], 'must be an integer').isInt(),
	withPlaylists: query(['wp', 'withPlaylists'], 'must be a boolean').isBoolean()
});

app.get('/yt/stream/:idOrUrl',
	validate.container, validateInputs,
	(req, res) => getHighestQualityAVStream(req).then(({ stream }) => stream.pipe(res))
);

app.get('/yt/dl/:idOrUrl',
	validate.container, validateInputs,
	(req, res) =>
		getHighestQualityAVStream(req).then(({ videoDetails: { ownerChannelName, title }, stream, container }) => {
			res.setHeader('Content-Disposition', `attachment; filename=${ownerChannelName} - ${title}.${containerMap[container]}`);
			stream.pipe(res);
		})
);

app.get('/yt/stream/audio/:idOrUrl',
	validate.lowestQuality, validate.bitrate, validateInputs,
	(req, res) => getAudioOnlyOrVideoOnlyStream('audio', req).then(({ stream }) => stream.pipe(res))
);

app.get('/yt/dl/audio/:idOrUrl',
	validate.lowestQuality, validate.bitrate, validateInputs,
	(req, res) =>
		getAudioOnlyOrVideoOnlyStream('audio', req).then(({ videoDetails: { ownerChannelName, title }, stream, container }) => {
			res.setHeader('Content-Disposition', `attachment; filename=${ownerChannelName} - ${title}.${containerMap[container]}`);
			stream.pipe(res);
		})
);

app.get('/yt/stream/video/:idOrUrl',
	validate.lowestQuality, validate.bitrate, validateInputs,
	(req, res) => getAudioOnlyOrVideoOnlyStream('video', req).then(({ stream }) => stream.pipe(res))
);

app.get('/yt/dl/video/:idOrUrl',
	validate.lowestQuality, validate.bitrate, validateInputs,
	(req, res) =>
		getAudioOnlyOrVideoOnlyStream('video', req).then(({ videoDetails: { ownerChannelName, title }, stream, container }) => {
			res.setHeader('Content-Disposition', `attachment; filename=${ownerChannelName} - ${title}.${containerMap[container]}`);
			stream.pipe(res);
		})
);

app.get('/yt/search/:query',
	query(['t', 'type'], "must be one of: 'video', 'channel', 'playlist', 'movie'").optional(),
	validate.limit, validate.withPlaylists, validateInputs,
	({ query, params }, res) => {
		const type = query.t ?? query.type;
		const withPlaylists = query.wp ?? query.withPlaylists;
		const limit = Number.parseInt(query.l ?? query.limit);
		ytsa.search(params.query, withPlaylists, limit, type).then(res.json.bind(res));
	}
);

app.post('/yt/search/nextpage',
	express.json(), validate.limit, validate.withPlaylists, validateInputs,
	({ query, body }, res) => {
		const limit = Number.parseInt(query.l ?? query.limit);
		const withPlaylists = Boolean(query.wp ?? query.withPlaylists);
		ytsa.nextPage(body, withPlaylists, limit).then(res.json.bind(res));
	}
);

app.listen(port, () => console.log(`Listening on ${port}`));
