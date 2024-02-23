import { validationResult } from 'express-validator';

export const containerFileExt = {
	webm: 'webm',
	matroska: 'mkv'
};

/**
 * Mimics Python's `min`.
 * @template T 
 * @param {T[]} arr 
 * @param {((_: T) => string | number)} key 
 */
export const min = (arr, key = null) =>
	arr.reduce(key
		? (prev, curr) => (key(curr) < key(prev)) ? curr : prev
		: (prev, curr) => (curr < prev) ? curr : prev);

/** @type {import('express').RequestHandler} */
export const validateInputs = (req, res, next) => {
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
