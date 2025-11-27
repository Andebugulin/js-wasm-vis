export class JSProcessor {
	// simple inversion
	static invertColors(imageData) {
		const data = imageData.data;

		for (let i = 0; i < data.length; i += 4) {
			data[i] = 255 - data[i]; // Red
			data[i + 1] = 255 - data[i + 1]; // Green
			data[i + 2] = 255 - data[i + 2]; // Blue
			// altha left as it is
		}

		return imageData;
	}
}
