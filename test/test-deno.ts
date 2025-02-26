import { assert } from 'jsr:@std/assert';

Deno.removeSync('test/output', { recursive: true });
Deno.mkdirSync('test/output', { recursive: true });

const apiPort = '9001';

/* spawn an api for testing */ {
	const apiProcess = new Deno.Command(Deno.execPath(), {
		args: ['-A', 'src/index.ts', apiPort],
		stdout: 'piped',
		stderr: 'piped'
	}).spawn();

	const [stdout1, stdout2] = apiProcess.stdout.tee();

	// we want to see the api's output too
	const stdoutFile = Deno.openSync('test/output/api-stdout.txt', { write: true, create: true });
	const stderrFile = Deno.openSync('test/output/api-stderr.txt', { write: true, create: true });
	stdout1.pipeTo(stdoutFile.writable);
	apiProcess.stderr.pipeTo(stderrFile.writable);

	// wait for api to start
	for await (const str of stdout2.pipeThrough(new TextDecoderStream()))
		if (str.includes(`Listening on ${apiPort}`)) break;
}

const videoId = 'MvsAesQ-4zA';
const videoUrl = encodeURIComponent(`https://youtube.com/watch?v=${videoId}`);

const testDlResponse = async (resp: Response, filePrefix: string) => {
	assert(resp.ok);
	const contentDisposition = resp.headers.get('Content-Disposition');
	assert(contentDisposition);
	const matches = contentDisposition.match(/filename="(.+?)"/);
	assert(matches);
	const filename = `test/output/${filePrefix}-${matches[1]}`;
	const file = await Deno.open(filename, { create: true, write: true });
	assert(resp.body);
	await resp.body.pipeTo(file.writable);
	console.log(
		`Media successfully downloaded, so this test passed as far as mechanics go.
But please actually check its contents with a media player.`
	);
};

const testInfoResponse = async (resp: Response) => {
	assert(resp.ok);
	const { formats, details } = await resp.json();
	assert(formats instanceof Array && formats.length);
	assert(
		typeof details === 'object' &&
			typeof details.title === 'string' &&
			details.title.includes('1 Second Video')
	);
};

const apiBaseUrl = `http://localhost:${apiPort}`;

Deno.test('/yt/dl/[video_id]', async () =>
	testDlResponse(await fetch(`${apiBaseUrl}/yt/dl/${videoId}`), 'id-both')
);

Deno.test('/yt/dl/[video_url]', async () =>
	testDlResponse(await fetch(`${apiBaseUrl}/yt/dl/${videoUrl}`), 'url-both')
);

Deno.test('/yt/dl/[video_id]?only=audio', async () =>
	testDlResponse(await fetch(`${apiBaseUrl}/yt/dl/${videoId}?only=audio`), 'id-audio')
);

Deno.test('/yt/dl/[video_url]?only=audio', async () =>
	testDlResponse(await fetch(`${apiBaseUrl}/yt/dl/${videoUrl}?only=audio`), 'url-audio')
);

Deno.test('/yt/dl/[video_id]?only=video', async () =>
	testDlResponse(await fetch(`${apiBaseUrl}/yt/dl/${videoId}?only=video`), 'id-video')
);

Deno.test('/yt/dl/[video_url]?only=video', async () =>
	testDlResponse(await fetch(`${apiBaseUrl}/yt/dl/${videoUrl}?only=video`), 'url-video')
);

Deno.test('/yt/info/[video_id]', () =>
	fetch(`${apiBaseUrl}/yt/info/${videoId}`).then(testInfoResponse)
);

Deno.test('/yt/info/[video_url]', () =>
	fetch(`${apiBaseUrl}/yt/info/${videoUrl}`).then(testInfoResponse)
);

Deno.test('/yt/search', async () => {
	const resp = await fetch(`${apiBaseUrl}/yt/search?q=hello+world`);
	const { results } = await resp.json();
	assert(results instanceof Array && results.length);
	assert(
		results.find(v => {
			const lowercaseTitle = v.title.toLowerCase();
			return lowercaseTitle.includes('hello') && lowercaseTitle.includes('world');
		})
	);
});

Deno.test('/yt/search/nextpage', async () => {
	let resp = await fetch(`${apiBaseUrl}/yt/search?q=hello+world`);
	const { nextPageCtx } = await resp.json();
	resp = await fetch(`${apiBaseUrl}/yt/search/nextpage`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(nextPageCtx)
	});
	const results = await resp.json();
	assert(results instanceof Array && results.length);
	assert(
		results.find(v => {
			const lowercaseTitle = v.title.toLowerCase();
			return lowercaseTitle.includes('hello') && lowercaseTitle.includes('world');
		})
	);
});
