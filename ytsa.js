import { GetListByKeyword, NextPage } from 'youtube-search-api';

const minifyVideoItem = (item) => {
	item.thumbnails = item.thumbnail.thumbnails;
	delete item.thumbnail;
	item.length = {
		text: item.length.simpleText,
		descriptiveText: item.length.accessibility?.accessibilityData.label
	};
	delete item.shortBylineText;
};

const minifyResultItems = (result) => {
	for (const item of result.items)
		if (item.type === 'video')
			minifyVideoItem(item);
	return result;
};

/**
 * @param {string} query 
 * @param {boolean} withPlaylists
 * @param {number} limit
 * @param {'video' | 'channel' | 'playlist' | 'movie'} type
 */
export const search = (query, withPlaylists, limit, type) =>
	GetListByKeyword(query, withPlaylists, limit, [{ type }])
		.then(minifyResultItems);

/**
 * @param nextPageObject 
 * @param {boolean} withPlaylists
 * @param {number} limit
 */
export const nextPage = (nextPageObject, withPlaylists, limit) =>
	NextPage(nextPageObject, withPlaylists, limit)
		.then(minifyResultItems);
