import ev from 'express-validator';
import express from 'express';

const nextPageNote = '; must be from /yt/search';
const itagsNote = '; you can get itags from formats from the /yt/info endpoint';

export const // dl
	itags = ev
		.query('itags', 'must be a comma-separated list of 0 to 2 itags' + itagsNote)
		.optional()
		.isString()
		.customSanitizer(itags => itags.split(','))
		.custom(
			itags => [0, 1, 2].includes(itags.length) && itags.every((n: string) => parseInt(n))
		),
	only = ev.query('only', "must be one of: 'audio', 'video'").optional().isIn(['audio', 'video']),
	// search
	q = ev.query('q', 'search query is required').exists().isString(),
	type = ev
		.query('type', "must be one of: 'video', 'channel', 'playlist', 'movie'")
		.optional()
		.isIn(['video', 'channel', 'playlist', 'movie']),
	// nextpage
	nextPageCtx = [
		ev
			.body('key', 'must be a string' + nextPageNote)
			.exists()
			.isString(),
		ev
			.body('body', 'must be an object' + nextPageNote)
			.exists()
			.isObject(),
		ev
			.body('body.context', 'must be an object' + nextPageNote)
			.exists()
			.isObject(),
		ev
			.body('body.continuation', 'must be a string' + nextPageNote)
			.exists()
			.isString()
	],
	errorCheck: express.RequestHandler = (req, res, next) => {
		const errors = {} as Record<ev.Location, Record<string, unknown>>;

		for (const { location, path, msg } of ev
			.validationResult(req)
			.array() as ev.FieldValidationError[]) {
			if (!errors[location]) errors[location] = {};
			errors[location][path] = msg;
		}

		for (const _ in errors) {
			res.status(400).json({ errors });
			return;
		}

		next();
	};
