import { query, body, validationResult } from 'express-validator';

const nextPageWarning = '; must be from /yt/search';

export const
	// streaming params
	itags = query('itags', 'must be a comma-separated list of 1 or 2 itags').optional().isString()
		.customSanitizer(itags => itags.split(','))
		.custom(itags => [0, 1, 2].includes(itags.length)),

	// searching params
	q = query('q', 'search query is required').exists().isString(),
	type = query('type', "must be one of: 'video', 'channel', 'playlist', 'movie'")
		.optional().isIn(['video', 'channel', 'playlist', 'movie']),
	nextPageCtx = [
		body('key', 'must be a string' + nextPageWarning).exists().isString(),
		body('body', 'must be an object' + nextPageWarning).exists().isObject(),
		body('body.context', 'must be an object' + nextPageWarning).exists().isObject(),
		body('body.continuation', 'must be a string' + nextPageWarning).exists().isString()
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
