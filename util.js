/**
 * Mimics Python's `min`.
 * @template T
 * @param {T[]} arr 
 * @param {((_: T) => string | number) | undefined} key 
 */
export const min = (arr, key) =>
	arr.reduce(key
		? (prev, curr) => (key(curr) < key(prev)) ? curr : prev
		: (prev, curr) => (curr < prev) ? curr : prev);

/**
 * @param {import('express').Response} res 
 * @param {string} errorType 
 * @returns An error handler that logs the error and sends status 500 to the client.
 */
export const internalServerErrorHandler = (res, errorType) =>
	error => {
		console.error(`${errorType} error: ${error}`);
		res.sendStatus(500);
	};
