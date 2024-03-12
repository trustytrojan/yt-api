import { query, body, validationResult } from 'express-validator';

const nextPageNote = '; must be from /yt/search';
const itagsNote = '; you can get itags from formats from the /yt/info endpoint';

export const
	// dl
	itags = query('itags', 'must be a comma-separated list of 0 to 2 itags' + itagsNote).optional().isString()
		.customSanitizer(itags => itags.split(','))
		.custom(itags => [0, 1, 2].includes(itags.length) && itags.every(n => parseInt(n))),
	only = query('only', "must be one of: 'audio', 'video'").optional().isIn(['audio', 'video']),

	// search
	q = query('q', 'search query is required').exists().isString(),
	type = query('type', "must be one of: 'video', 'channel', 'playlist', 'movie'")
		.optional().isIn(['video', 'channel', 'playlist', 'movie']),
	
	// nextpage
	nextPageCtx = [
		body('key', 'must be a string' + nextPageNote).exists().isString(),
		body('body', 'must be an object' + nextPageNote).exists().isObject(),
		body('body.context', 'must be an object' + nextPageNote).exists().isObject(),
		body('body.continuation', 'must be a string' + nextPageNote).exists().isString()
	],

	/** @type {import('express').RequestHandler} */
	checkForErrors = (req, res, next) => {
		const errors = {};

		for (const { location, path, msg } of validationResult(req).array()) {
			if (!errors[location])
				errors[location] = {};
			errors[location][path] = msg;
		}

		for (const _ in errors)
			// if errors is empty this won't run
			return res.status(400).json({ errors });

		next();
	};
