import fs from 'node:fs';
import ytdl from '@distube/ytdl-core';

const MAX_AGE = 30 * 60 * 1e3; // 30 minutes in milliseconds
const DIR = '/tmp/yt-api';

if (!fs.existsSync(DIR)) fs.mkdirSync(DIR);

export const deleteOldFiles = () => {
	const now = Date.now();
	for (const file of fs.readdirSync(DIR)) {
		const path = `${DIR}/${file}`;
		const { birthtimeMs } = fs.statSync(path);
		const fileAge = now - birthtimeMs;
		if (fileAge < MAX_AGE) continue;
		fs.rmSync(path);
	}
};

export const getPath = (formats: ytdl.videoFormat[], { videoId }: ytdl.MoreVideoDetails) => {
	if (![1, 2].includes(formats.length))
		throw TypeError('Expected an array containing 1 or 2 formats');
	return `${DIR}/${videoId}-${formats.map(f => f.itag).join('-')}`;
};
