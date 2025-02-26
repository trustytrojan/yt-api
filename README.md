# yt-api

An HTTP API that provides YouTube search results and audio/video downloads.

Currently can run on both Node.js and Deno runtimes, with tests available for both.

## API Documentation

### `GET /yt/dl/:idOrUrl`

#### Route Parameters

- `:idOrUrl` - A **YouTube video ID or a URL/link** to its page. YouTube Music
  (`music.youtube.com`) URLs also work.

#### Query Parameters

- `only` - Value can be **`audio` or `video`**. When not using the `itags`
  parameter, decides whether to return only the highest-quality audio or video
  stream, rather than the default behavior of both streams.
- `itags` - A **list of numbers** corresponding to
  [YouTube video "itag" values](https://gist.github.com/sidneys/7095afe4da4ae58694d128b1034e01e2),
  or codes that uniquely identify a stream's format and quality together.

#### Return Value

If a video stream is included in the result: a Matroska media container (`video/x-matroska`). Otherwise, an MPEG-3 container (`audio/mp3`).

### `GET /yt/info/:idOrUrl`

#### Route Parameters

- `:idOrUrl` - A **YouTube video ID or a URL/link** to its page. YouTube Music
  (`music.youtube.com`) URLs also work.

#### Return Value

A JSON object of the form:
```json
{
	"formats": [...], // Array of format objects (corresponding to the "itags" described above)
	"details": {...} // Object containing video metadata (title, channel, etc)
}
```

### `GET /yt/search`

#### Query Parameters

- `q` - YouTube search query.
- `type` - Filters by a specific result type. Can be one of `video`, `channel`, `playlist`, or `movie` (doesn't seem to return anything).

#### Return Value

A JSON object of the form:
```json
{
	"results": [...], // Array of YouTube search result objects
	"nextPageCtx": {...} // object containing information for use in /yt/search/nextpage
}
```

### `POST /yt/search/nextpage`

Fetches the next set/page of search results for the same query used in `/yt/search`. The same `nextPageCtx` object can be `POST`ed to this route multiple times.

#### Request Body
The request body should be the `nextPageCtx` object returned from a `/yt/search` request encoded in JSON.

#### Return Value
A JSON array containing the next set of YouTube search result objects (same as the `results` property in the object `/yt/search` returns).
