export const IMAGINE_IMAGE_PICKER_EVENT = "albus-imagine:image-picker-request:v1";

export interface ImagineImagePickerRequestV1 {
	version: 1;
	multiple: boolean;
	accept: () => void;
	onSelect: (paths: string[]) => void | Promise<void>;
}

export function isImagineImagePickerRequestV1(value: unknown): value is ImagineImagePickerRequestV1 {
	if (!value || typeof value !== "object") return false;
	const request = value as Partial<ImagineImagePickerRequestV1>;
	return request.version === 1
		&& typeof request.multiple === "boolean"
		&& typeof request.accept === "function"
		&& typeof request.onSelect === "function";
}
