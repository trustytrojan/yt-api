import ytdl from '@distube/ytdl-core';
import { min } from './util.js';

/**
 * @callback ChooseFormatFunction
 * @param {ytdl.videoFormat[]} formats 
 * @param {import('qs').ParsedQs} query from `req`
 * @param {'audio' | 'video'} type
 * @returns {ytdl.videoFormat[]} either 1 or 2
 */

/**
 * @param {'bitrate' | 'audioBitrate'} key 
 * @param {number} br 
 * @returns {(_: ytdl.videoFormat) => number}
 */
const distanceBetween = (key, br) => (format => Math.abs(format[key] - br));

/** @type {ChooseFormatFunction} */
export const audioAndVideo = (formats, { lq, abr, vbr, container }) => {
	if (container !== 'matroska') {
		formats = ytdl.filterFormats(formats, format => format.container === container);
		if (!formats.length)
			throw `incompatible container ${container}`;
	}

	if (lq) { // lowest quality
		return [
			ytdl.chooseFormat(formats, { filter: 'audioonly', quality: 'lowestaudio' }),
			ytdl.chooseFormat(formats, { filter: 'videoonly', quality: 'lowestvideo' })
		];
	}

	abr = parseInt(abr);
	vbr = parseInt(vbr);

	if (!isNaN(abr) && !isNaN(vbr)) {
		return [
			min(formats, distanceBetween('audioBitrate', abr)),
			min(formats, distanceBetween('bitrate', vbr))
		];
	}
	
	const highestAudioOnly = ytdl.chooseFormat(formats, { filter: 'audioonly', quality: 'highestaudio' });
	const highestVideoOnly = ytdl.chooseFormat(formats, { filter: 'videoonly', quality: 'highestvideo' });

	if (!isNaN(abr)) {
		return [
			min(formats, distanceBetween('audioBitrate', abr)),
			highestVideoOnly
		];
	}

	if (!isNaN(vbr)) {
		return [
			highestAudioOnly,
			min(formats, distanceBetween('bitrate', vbr)),
		];
	}

	return [highestAudioOnly, highestVideoOnly];
};

/**
 * @param {ytdl.videoFormat[]} formats 
 * @param {'audio' | 'video'} type 
 * @param {'highest' | 'lowest'} quality 
 */
const choose = (formats, type, quality) => ytdl.chooseFormat(formats, { filter: `${type}only`, quality: `${quality}${type}` });

/** @type {ChooseFormatFunction} */
export const audioOrVideo = (formats, { lq, br, container }, type) => {
	if (container !== 'matroska') {
		formats = ytdl.filterFormats(formats, format => format.container === container);
		if (!formats.length)
			throw `incompatible container ${container}`;
	}

	if (lq) {
		return [choose(formats, type, 'lowest')];
	}

	if (br = parseInt(br)) {
		const key = `${(type === 'video') ? 'b' : 'audioB'}itrate`;
		return [min(formats, distanceBetween(key, br))];
	}

	return [choose(formats, type, 'highest')];
};
