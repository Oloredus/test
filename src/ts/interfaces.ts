export interface ISpeach {
	topic: string;
	date: string;
	words: string;
}

export interface ISpeaker {
	[key: string]: {
		name: string;
		speaches: ISpeach[];
	};
}

export interface IFilterOptions {
	option: 'filterByYear' | 'filterByTopic';
	value: number | string;
}
