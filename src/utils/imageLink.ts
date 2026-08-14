import { MetadataCache, TFile } from "obsidian";

export type ImagePosition = "center" | "align-left" | "align-right" | "left" | "right" | "inline";
const IMAGE_POSITIONS: readonly ImagePosition[] = [
	"center",
	"align-left",
	"align-right",
	"left",
	"right",
	"inline",
];
const SIZE_PATTERN = /^\d+(?:x\d+)?$/;

interface ParsedImageLink {
	file: string;
	position: ImagePosition;
	dark: boolean;
	caption: string;
	size: string;
	extra: string[];
}

export function parseImageLink(link: string): ParsedImageLink | null {
	if (!link.startsWith("![[") || !link.endsWith("]]")) return null;
	const parts = link.slice(3, -2).split("|");
	const pathParts = parts.shift()?.split("#") ?? [];
	const file = pathParts.shift() ?? "";
	const hashParameters = pathParts.map((part) => part.trim()).filter(Boolean);
	const pipeParameters = parts.map((part) => part.trim());
	const allParameters = [...hashParameters, ...pipeParameters];
	const position = (allParameters.find((part): part is ImagePosition => IMAGE_POSITIONS.includes(part as ImagePosition)) ?? "center");
	const dark = allParameters.includes("dark");
	const usesCaptionSyntax = hashParameters.some(
		(part) => part === "dark" || IMAGE_POSITIONS.includes(part as ImagePosition),
	);
	// In this plugin's caption syntax the first pipe field is always the
	// caption, even when the caption itself is numeric (for example "2026").
	const caption = usesCaptionSyntax
		? (pipeParameters[0] ?? "")
		: (pipeParameters.find((part) => part && part !== "dark" && !IMAGE_POSITIONS.includes(part as ImagePosition) && !SIZE_PATTERN.test(part)) ?? "");
	const sizeCandidates = usesCaptionSyntax ? pipeParameters.slice(1) : pipeParameters;
	const size = sizeCandidates.find((part) => SIZE_PATTERN.test(part)) ?? "";
	const extra = allParameters.filter((part) => part && part !== "dark" && !IMAGE_POSITIONS.includes(part as ImagePosition) && !SIZE_PATTERN.test(part) && part !== caption);
	return { file, position, dark, caption, size, extra };
}

function formatImageLink(parsed: ParsedImageLink): string {
	const safeCaption = parsed.caption.replace(/[\r\n|]/g, " ").replace(/\]\]/g, "] ]").trim();
	const extras = parsed.extra.filter(Boolean);
	if (safeCaption) {
		const hashes = [parsed.file, parsed.position, ...(parsed.dark ? ["dark"] : []), ...extras];
		return `![[${hashes.join("#")}|${safeCaption}${parsed.size ? `|${parsed.size}` : ""}]]`;
	}
	const pipes = [parsed.file, ...(parsed.dark ? ["dark"] : []), parsed.position, ...extras, ...(parsed.size ? [parsed.size] : [])];
	return `![[${pipes.join("|")}]]`;
}

export function buildImageLink(
	metadataCache: MetadataCache,
	file: TFile,
	sourcePath: string,
	options: { position?: ImagePosition; dark?: boolean; caption?: string; } = {}
): string {
	return formatImageLink({
		file: metadataCache.fileToLinktext(file, sourcePath),
		position: options.position ?? "center",
		dark: options.dark ?? false,
		caption: options.caption ?? "",
		size: "",
		extra: [],
	});
}

export function updateImageLink(link: string, updates: Partial<Pick<ParsedImageLink, "position" | "dark" | "caption">>): string {
	const parsed = parseImageLink(link);
	return parsed ? formatImageLink({ ...parsed, ...updates }) : link;
}

export function updateImageLinkSize(link: string, size: string): string {
	if (!link.startsWith("![[") || !link.endsWith("]]")) return link;
	const fields = link.slice(3, -2).split("|");
	const path = fields.shift() ?? "";
	const hashParameters = path.split("#").slice(1);
	const usesCaptionSyntax = hashParameters.some(
		(part) => part === "dark" || IMAGE_POSITIONS.includes(part as ImagePosition),
	);
	const preserved = fields.filter(
		(part, index) => index < (usesCaptionSyntax ? 1 : 0) || !SIZE_PATTERN.test(part.trim()),
	);
	if (size) preserved.push(size);
	return `![[${[path, ...preserved].join("|")}]]`;
}
