// this test file only uses Node APIs for everything, just for fun
// in my opinion the Node APIs are good for some things and Deno/Web APIs are good for other things
// imagine a world in which they just worked together...

import assert from 'node:assert';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import stream_consumers from 'node:stream/consumers';
import test from 'node:test';

fs.rmSync('test/output', { recursive: true, force: true });
fs.mkdirSync('test/output');

const apiPort = '9000';

// spawn an api for testing
const apiProcess = spawn('node', ['src/index.ts', apiPort], {
	stdio: ['inherit', 'pipe', 'pipe']
});
const logFileStream = fs.createWriteStream('test/output/api-output.txt');
apiProcess.stdout.pipe(logFileStream);
apiProcess.stderr.pipe(logFileStream);
for await (const str of apiProcess.stdout) if (str.includes(`Listening on ${apiPort}`)) break;

const videoId = 'MvsAesQ-4zA';
const videoUrl = encodeURIComponent(`https://youtube.com/watch?v=${videoId}`);

const testDlResponse = async (resp: http.IncomingMessage, filePrefix: string) => {
	assert(resp.statusCode && resp.statusCode < 400);
	const contentDisposition = resp.headers['content-disposition'];
	assert(contentDisposition);
	const matches = contentDisposition.match(/filename="(.+?)"/);
	assert(matches);
	const filename = `test/output/${filePrefix}-${matches[1]}`;
	assert(resp.readable);
	const fileWritable = fs.createWriteStream(filename);
	resp.pipe(fileWritable, { end: true });
	await once(fileWritable, 'close');
	console.log(
		`Media successfully downloaded, so this test passed as far as mechanics go.
But please actually check its contents with a media player.`
	);
};

const testInfoResponse = async (resp: http.IncomingMessage) => {
	assert(resp.statusCode && resp.statusCode < 400);
	const { formats, details } = (await stream_consumers.json(resp)) as any;
	assert(formats instanceof Array && formats.length);
	assert(
		typeof details === 'object' &&
			typeof details.title === 'string' &&
			details.title.includes('1 Second Video')
	);
};

const apiBaseUrl = `http://localhost:${apiPort}`;

test('/yt/dl/[video_id]', () =>
	new Promise(resolve =>
		http.get(`${apiBaseUrl}/yt/dl/${videoId}`, r => testDlResponse(r, 'id-both').then(resolve))
	));

test('/yt/dl/[video_id]?only=audio', () =>
	new Promise(resolve =>
		http.get(`${apiBaseUrl}/yt/dl/${videoId}?only=audio`, r =>
			testDlResponse(r, 'id-audio').then(resolve)
		)
	));

test('/yt/dl/[video_id]?only=video', () =>
	new Promise(resolve =>
		http.get(`${apiBaseUrl}/yt/dl/${videoId}?only=video`, r =>
			testDlResponse(r, 'id-video').then(resolve)
		)
	));

test('/yt/dl/[video_url]', () =>
	new Promise(resolve =>
		http.get(`${apiBaseUrl}/yt/dl/${videoUrl}`, r =>
			testDlResponse(r, 'url-both').then(resolve)
		)
	));

test('/yt/dl/[video_url]?only=audio', () =>
	new Promise(resolve =>
		http.get(`${apiBaseUrl}/yt/dl/${videoUrl}?only=audio`, r =>
			testDlResponse(r, 'url-audio').then(resolve)
		)
	));

test('/yt/dl/[video_url]?only=video', () =>
	new Promise(resolve =>
		http.get(`${apiBaseUrl}/yt/dl/${videoUrl}?only=video`, r =>
			testDlResponse(r, 'url-video').then(resolve)
		)
	));

test('/yt/info/[video_id]', () =>
	new Promise(resolve =>
		http.get(`${apiBaseUrl}/yt/info/${videoId}`, r => testInfoResponse(r).then(resolve))
	));

test('/yt/info/[video_url]', () =>
	new Promise(resolve =>
		http.get(`${apiBaseUrl}/yt/info/${videoUrl}`, r => testInfoResponse(r).then(resolve))
	));

test('/yt/search', async () => {
	const resp = await new Promise<http.IncomingMessage>(resolve =>
		http.get(`${apiBaseUrl}/yt/search?q=hello+world`, resolve)
	);
	const { results } = (await stream_consumers.json(resp)) as any;
	assert(results instanceof Array && results.length);
	assert(
		results.find(v => {
			const lowercaseTitle = v.title.toLowerCase();
			return lowercaseTitle.includes('hello') && lowercaseTitle.includes('world');
		})
	);
});

test('/yt/search/nextpage', async () => {
	let resp = await new Promise<http.IncomingMessage>(resolve =>
		http.get(`${apiBaseUrl}/yt/search?q=hello+world`, resolve)
	);
	const { nextPageCtx } = (await stream_consumers.json(resp)) as any;
	const req = http.request(`${apiBaseUrl}/yt/search/nextpage`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		}
	});
	req.write(JSON.stringify(nextPageCtx));
	req.end();
	resp = await new Promise<http.IncomingMessage>(resolve => req.on('response', resolve));
	const results = await stream_consumers.json(resp);
	assert(results instanceof Array && results.length);
	assert(
		results.find(v => {
			const lowercaseTitle = v.title.toLowerCase();
			return lowercaseTitle.includes('hello') && lowercaseTitle.includes('world');
		})
	);
});

test('cleanup', () => void apiProcess.kill());
