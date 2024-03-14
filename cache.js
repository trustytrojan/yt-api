import { readdir, stat, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';

const MAX_AGE = 30 * 60 * 1e3; // 30 minutes in milliseconds
const DIR = '/tmp/yt-api';

if (!existsSync(DIR))
	mkdir(DIR);

export const deleteOldFiles = async () => {
	const now = Date.now();
	for (const file of await readdir(DIR)) {
		const path = `${DIR}/${file}`;
		const { birthtimeMs } = await stat(path);
		const fileAge = now - birthtimeMs;
		if (fileAge < MAX_AGE)
			continue;
		rm(path);
	}
};

/**
 * @param {import('@distube/ytdl-core').videoFormat[]} formats 
 * @param {import('@distube/ytdl-core').MoreVideoDetails}
 */
export const getPath = (formats, { videoId }) => {
	if (![1, 2].includes(formats.length))
		throw TypeError('Expected an array containing 1 or 2 formats');
	return `${DIR}/${videoId}-${formats.map(f => f.itag).join('-')}`;
};
