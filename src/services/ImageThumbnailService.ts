/**
 * Serial thumbnail downsampler inspired by Bases cards. SVG and GIF resources
 * stay untouched; oversized bitmaps are resized to the rendered card size and
 * held in a bounded object-URL cache.
 */
export class ImageThumbnailService {
	private readonly cache = new Map<string, string>();
	private queue = Promise.resolve();
	private disposed = false;

	constructor(private readonly maximumEntries = 128) { }

	load(image: HTMLImageElement, source: string, extension: string): void {
		if (this.disposed) return;
		const cached = this.cache.get(source);
		image.dataset.afmThumbnailSource = source;
		if (cached) {
			this.touch(source, cached);
			image.src = cached;
			return;
		}
		image.src = source;
		if (extension === "svg" || extension === "gif") return;
		this.queue = this.queue.then(
			() => this.createThumbnail(image, source, extension),
			() => this.createThumbnail(image, source, extension),
		);
	}

	destroy(): void {
		this.disposed = true;
		for (const url of this.cache.values()) URL.revokeObjectURL(url);
		this.cache.clear();
	}

	private async createThumbnail(
		image: HTMLImageElement,
		source: string,
		extension: string,
	): Promise<void> {
		if (this.disposed || image.dataset.afmThumbnailSource !== source) return;
		await waitForImage(image);
		if (
			this.disposed ||
			image.dataset.afmThumbnailSource !== source ||
			image.naturalWidth <= 0 || image.naturalHeight <= 0 ||
			image.offsetWidth <= 0 || image.offsetHeight <= 0
		) return;
		const ownerWindow = image.ownerDocument.defaultView;
		const pixelRatio = ownerWindow?.devicePixelRatio ?? 1;
		const scale = Math.max(
			image.offsetWidth / image.naturalWidth,
			image.offsetHeight / image.naturalHeight,
		) * pixelRatio;
		if (scale <= 0 || scale > 0.5) return;
		const width = Math.max(1, Math.ceil(image.naturalWidth * scale));
		const height = Math.max(1, Math.ceil(image.naturalHeight * scale));
		const canvas = image.ownerDocument.win.createEl("canvas");
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext("2d");
		if (!context) return;
		context.imageSmoothingEnabled = true;
		context.imageSmoothingQuality = "high";
		context.drawImage(image, 0, 0, width, height);
		const blob = await new Promise<Blob | null>((resolve) => {
			canvas.toBlob(resolve, extension === "png" ? "image/png" : "image/jpeg", 0.86);
		});
		if (!blob || this.disposed) return;
		const url = URL.createObjectURL(blob);
		this.cache.set(source, url);
		this.trimCache();
		if (image.dataset.afmThumbnailSource === source) image.src = url;
	}

	private touch(source: string, url: string): void {
		this.cache.delete(source);
		this.cache.set(source, url);
	}

	private trimCache(): void {
		while (this.cache.size > this.maximumEntries) {
			const oldest = this.cache.entries().next().value as [string, string] | undefined;
			if (!oldest) return;
			this.cache.delete(oldest[0]);
			URL.revokeObjectURL(oldest[1]);
		}
	}
}

function waitForImage(image: HTMLImageElement): Promise<void> {
	if (image.complete) return Promise.resolve();
	return new Promise((resolve) => {
		const finish = (): void => {
			image.removeEventListener("load", finish);
			image.removeEventListener("error", finish);
			resolve();
		};
		image.addEventListener("load", finish, { once: true });
		image.addEventListener("error", finish, { once: true });
		image.ownerDocument.defaultView?.setTimeout(finish, 10_000);
	});
}
