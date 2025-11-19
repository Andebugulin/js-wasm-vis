// utils.js
export class ImageUtils {
	/**
	 * Helper to load image from data URL or file
	 * @param {string|File} imageSource
	 * @returns {Promise<ImageData>}
	 */
	static async loadImage(imageSource) {
		return new Promise((resolve, reject) => {
			const img = new Image();

			img.onload = () => {
				const canvas = document.createElement("canvas");
				canvas.width = img.width;
				canvas.height = img.height;

				const ctx = canvas.getContext("2d", { willReadFrequently: true });
				ctx.drawImage(img, 0, 0);

				const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
				resolve(imageData);
			};

			img.onerror = reject;

			if (typeof imageSource === "string") {
				img.src = imageSource;
			} else {
				const reader = new FileReader();
				reader.onload = (e) => (img.src = e.target.result);
				reader.readAsDataURL(imageSource);
			}
		});
	}

	/**
	 * Converts ImageData back to displayable format
	 * @param {ImageData} imageData
	 * @returns {string} - Data URL
	 */
	static imageDataToDataURL(imageData) {
		const canvas = document.createElement("canvas");
		canvas.width = imageData.width;
		canvas.height = imageData.height;

		const ctx = canvas.getContext("2d");
		ctx.putImageData(imageData, 0, 0);

		return canvas.toDataURL();
	}
}
