import express, { Request, Response, Application } from 'express';
import http from 'http';
import got from 'got';
import * as csv from 'fast-csv';

import { IFilterOptions, ISpeach, ISpeaker } from './ts/interfaces';
import { ColumnDefinitions } from './ts/enums';
import { filteredSpeakerType, RequestQueryTypes } from './ts/types';

const app: Application = express();
const server: http.Server = http.createServer(app);
const port: number = 3000;

/**
 * How to use
 *
 * Step 1: Run Server:
 * 	- npm run server (main server, where everything runs)
 *  - npm run dataServerA (only for local testing: server provide necessary csv file)
 *  - npm run dataServerB (only for local testing: server provide necessary csv file)
 *
 * Step 2: Make request:
 *	- GET /evaluation?url=url1&url=url2
 * 	- use your own paths or the ones below
 * 		invalid: https://raw.githubusercontent.com/rfordatascience/tidytuesday/master/data/2022/2022-01-11/colony.csv
 * 		valid: 	 http://localhost:3000/evaluation?url=http://localhost:4000/public/data.csv
 * 		multi:   http://localhost:3000/evaluation?url=http://localhost:4000/public/data.csv&url=http://localhost:5000/public/data2.csv&url=https://raw.githubusercontent.com/rfordatascience/tidytuesday/master/data/2022/2022-01-11/colony.csv
 *
 * Step 3: Enjoy the result
 * 	- the evaluation result will be printed in your console
 */

/**
 * Calculate the total used words in speaches and
 * return the speakers name with least ones.
 *
 * @param speakers
 * @returns
 */
const getLeastWordySpeaker = (speakers: ISpeaker) => {
	const speakersByWords: filteredSpeakerType = {};

	for (const speaker in speakers) {
		const speakersName = speakers[speaker].name;
		const totalWords = speakers[speaker].speaches.reduce(
			(previousValue, currentValue) =>
				previousValue + parseInt(currentValue.words),
			0
		);

		speakersByWords[speakersName] = totalWords;
	}

	if (Object.entries(speakersByWords).length === 0) return null;

	const sortedSpeakerBySpeaches = Object.entries(speakersByWords).sort(
		(a, b) => a[1] - b[1]
	);

	return sortedSpeakerBySpeaches.shift()?.[0];
};

/**
 * Filter for speakers by given filter options (filter by year or filter by topic).
 *
 * @param speakers
 * @param filterOptions
 * @returns
 */
const filterForSpeakers = (
	speakers: ISpeaker,
	filterOptions: IFilterOptions
) => {
	const filteredSpeakers: filteredSpeakerType = {};

	for (const speaker in speakers) {
		const speakersName = speakers[speaker].name;
		let filteredSpeaches = [];

		if (filterOptions.option === 'filterByYear')
			filteredSpeaches = speakers[speaker].speaches.filter(
				(speach) => new Date(speach.date).getFullYear() === filterOptions.value
			);

		if (filterOptions.option === 'filterByTopic')
			filteredSpeaches = speakers[speaker].speaches.filter(
				(speach) => speach.topic === filterOptions.value
			);

		if (filteredSpeaches.length > 0)
			filteredSpeakers[speakersName] = filteredSpeaches.length;
	}

	return filteredSpeakers;
};

/**
 * Return speakers name that matches the filter option criteria,
 * otherwise return null.
 *
 * @param speakers
 * @param filterOptions
 * @returns
 */
const getFilteredSpeaker = (
	speakers: ISpeaker,
	filterOptions: IFilterOptions
) => {
	const filteredSpeakers = filterForSpeakers(speakers, filterOptions);

	if (Object.entries(filteredSpeakers).length === 0) return null;

	const sortedSpeakerBySpeaches = Object.entries(filteredSpeakers).sort(
		(a, b) => b[1] - a[1]
	);

	return sortedSpeakerBySpeaches.shift()?.[0];
};

/**
 * Validate csv header.
 * It is necessary to prevent the usage of invalid csv files.
 *
 * @param header
 * @returns
 */
const validateCsvHeader = (header: string[]) => {
	return (
		header[ColumnDefinitions.Speaker] === 'Speaker' &&
		header[ColumnDefinitions.Topic] === 'Topic' &&
		header[ColumnDefinitions.Date] === 'Date' &&
		header[ColumnDefinitions.Words] === 'Words'
	);
};

/**
 * Sort and group collected csv data by speaker.
 *
 * @param csvFilesData
 * @returns
 */
const sortAndGroupData = (csvFilesData: string[][][]) => {
	const speakers: ISpeaker = {};

	for (const csvFile in csvFilesData) {
		const isHeaderValid = validateCsvHeader(csvFilesData[csvFile][0]);

		if (!isHeaderValid) continue;

		// Remove csv header.
		csvFilesData[csvFile].shift();

		for (const row in csvFilesData[csvFile]) {
			const rowData: string[] = csvFilesData[csvFile][row];
			const speaker = rowData[ColumnDefinitions.Speaker];
			const speach: ISpeach = {
				topic: rowData[ColumnDefinitions.Topic],
				date: rowData[ColumnDefinitions.Date],
				words: rowData[ColumnDefinitions.Words],
			};

			speakers[speaker] === undefined
				? (speakers[speaker] = {
						name: speaker,
						speaches: [speach],
				  })
				: (speakers[speaker].speaches = [
						...speakers[speaker].speaches,
						speach,
				  ]);
		}
	}

	return speakers;
};

/**
 * Evaluate collected data for least wordy,
 * with most speaches on 'Interal Security' and most given speachen in 2013 speaker.
 *
 * @param csvFilesData
 * @returns
 */
const evaluate = (csvFilesData: string[][][]) => {
	const sortedAndGroupedData = sortAndGroupData(csvFilesData);
	const leastWordy = getLeastWordySpeaker(sortedAndGroupedData);
	const mostSpeaches = getFilteredSpeaker(sortedAndGroupedData, {
		option: 'filterByYear',
		value: 2013,
	});
	const mostSecurity = getFilteredSpeaker(sortedAndGroupedData, {
		option: 'filterByTopic',
		value: 'Internal Security',
	});

	return JSON.stringify({
		mostSpeaches: mostSpeaches,
		mostSecurity: mostSecurity,
		leastWordy: leastWordy,
	});
};

/**
 * Process csv-file from given url and return its' content.
 *
 * @param url
 * @returns
 */
const readCSV = (url: string) => {
	return new Promise<string[][]>((resolve, reject) => {
		try {
			const data: any = [];

			csv
				.parseStream(got.stream(url))
				.on('error', reject)
				.on('data', (row) => data.push(row))
				.on('end', () => resolve(data));
		} catch (error) {
			console.log(error);
			reject(error);
		}
	});
};

/**
 * Loop over all given urls from query and process the csv-files.
 *
 * @param urls
 * @returns
 */
const getCSVData = async (urls: string[]) => {
	const data = [];

	for (const url of urls) {
		data.push(await readCSV(url));
	}

	return data;
};

/**
 * Return an array of urls from request query.
 *
 * @param request
 * @returns
 */
const getRequestUrls = (
	request: Request<unknown, unknown, unknown, RequestQueryTypes>
) => {
	let urls: string[] = [];
	if (Array.isArray(request.query.url)) urls = request.query.url;
	if (typeof request.query.url === 'string') urls = [request.query.url];

	return urls;
};

// Run server and listen to HTTP requests.
server.listen(port, () => {
	console.log(`Server Running here 👉 https://localhost:${port}`);

	app.get(
		'/evaluation',
		async (
			req: Request<unknown, unknown, unknown, RequestQueryTypes>,
			res: Response
		) => {
			const urls = getRequestUrls(req);
			const csvData: string[][][] = await getCSVData(urls);

			const result = evaluate(csvData);
			// Now do something with the result.

			console.log('');
			console.log(`🌱 Enjoy the evaluation: ${result} 🌱`);
			console.log('');
		}
	);
});
