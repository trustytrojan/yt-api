import { param, query, body } from 'express-validator';

/** @type {import('express-validator').CustomValidator} */
const brMutExclWithAbrVbr = (_, { req: { query: { abr, vbr } } }) => {
	if (abr || vbr)
		throw new Error("mutually exclusive with ('abr', 'vbr')");
	return true;
};

/** @type {import('express-validator').CustomValidator} */
const abrVbrMutExclWithBr = (_, { req: { query: { br } } }) => {
	if (br)
		throw new Error("mutually exclusive with 'br'");
	return true;
};

// Express middleware functions that validate query parameters
export const validate = Object.freeze({
	// streaming
	dl: param('dl', 'must be a boolean').optional().isBoolean(),
	av: param('av', "must be one of ('audio', 'video')").optional().isIn(['audio', 'video']),
	container: query('container', "must be one of ('matroska', 'webm')").optional().isIn(['matroska', 'webm']),
	lowestQuality: query('lq', 'must be a boolean').optional().isBoolean(),
	bitrate: query('br', 'must be an integer').optional().isInt().custom(brMutExclWithAbrVbr),
	audioBitrate: query('abr', 'must be an integer').optional().isInt().custom(abrVbrMutExclWithBr),
	videoBitrate: query('vbr', 'must be an integer').optional().isInt().custom(abrVbrMutExclWithBr),

	// searching
	type: query('type', "must be one of: 'video', 'channel', 'playlist', 'movie'").optional().isIn(['video', 'channel', 'playlist', 'movie']),
	nextPageCtx: {
		key: body('key', 'must be a string; must be returned from /yt/search').exists().isString(),
		body: body('body', 'must be an object; must be returned from /yt/search').exists().isObject(),
		context: body('context', 'must exist; must be returned from /yt/search').exists(),
		continuation: body('continuation', 'must exist; must be returned from /yt/search').exists()
	}
});
