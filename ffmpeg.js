import cp from 'child_process';

/**
 * @param {string[]} inputs 
 * @param {import('@distube/ytdl-core').MoreVideoDetails} videoDetails 
 * @param {string} container 
 * @returns {string[]}
 */
export const makeArgs = (inputs, videoDetails, container) => {
	const _inputs = [];
	inputs.forEach(i => _inputs.push('-i', i));
	return [
		// '-loglevel', '0',
		'-hide_banner',
		'-reconnect', '1',
		'-reconnect_streamed', '1',
		..._inputs,
		'-metadata', `title=${videoDetails.title}`,
		'-metadata', `artist=${videoDetails.ownerChannelName}`,
		'-metadata', `date=${videoDetails.publishDate.substring(0, 10)}`,
		'-metadata', `duration=${videoDetails.lengthSeconds}`,
		'-c:v', 'copy',
		'-c:a', 'copy',
		'-f', container,
		'-'
	];
};

/**
 * @param {import('@distube/ytdl-core').MoreVideoDetails} videoDetails 
 * @param {number} pipes 
 * @returns {import('child_process').SpawnOptions}
 */
export const makeSpawnOptions = (videoDetails, pipes) => {
	const _pipes = [];
	for (let i = 0; i < pipes; ++i)
		_pipes.push('pipe');
	return {
		// timeout may have to be lengthened, some videos may take too long to mux
		// we can also deny the request if that happens
		timeout: Number.parseInt(videoDetails.lengthSeconds) * 1e3,
		stdio: ['ignore', 'pipe', 'inherit', ..._pipes],
		// SIGKILL prevents zombie ffmpeg processes
		killSignal: 'SIGKILL'
	};
};

/**
 * @param {string[]} args 
 * @param {import('child_process').SpawnOptions} spawnOptions 
 */
export const spawn = (args, spawnOptions) => cp.spawn('ffmpeg', args, spawnOptions);
