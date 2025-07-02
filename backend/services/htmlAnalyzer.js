import fs from "fs/promises";
import * as cheerio from "cheerio";
import fetch from "node-fetch";
import nspell from "nspell";
import path from "path";

// Utilidades
function decodeHTMLEntity(str) {
	if (!str) return "";
	return str
		.replace(/&reg;/g, "®")
		.replace(/’/g, "’")
		.replace(/&rsquo;/g, "’")
		.replace(/&trade;/g, "™")
		.replace(/&bull;/g, "•")
		.replace(/&dagger;/g, "†")
		.replace(/&#8226;/g, "•")
		.replace(/&#9702;/g, "◦")
		.replace(/&#9744;/g, "☐");
}

function classifyLink(href) {
	if (href.startsWith("http")) return "external";
	if (href.startsWith("mailto:")) return "email";
	if (href.startsWith("tel:")) return "phone";
	if (href.startsWith("sms:")) return "sms";
	if (href.startsWith("#")) return "anchor";
	return "other";
}

async function checkLink(url) {
	try {
		const response = await fetch(url, { method: "HEAD", timeout: 5000 });
		return response.ok;
	} catch {
		return false;
	}
}

export async function analyzeHTMLFile(filePath) {
	const html = await fs.readFile(filePath, "utf-8");
	const $ = cheerio.load(html);

	// === IMÁGENES ===
	const images = [];
	const imagesWithoutAlt = [];
	for (const img of $("img").toArray()) {
		const src = $(img).attr("src") || "";
		const alt = $(img).attr("alt");
		const isAltMissing =
			!alt || (typeof alt === "string" && alt.trim() === "");
		const name = src.split("/").pop();
		let size = null;

		if (src) {
			if (/^https?:\/\//.test(src)) {
				try {
					const response = await fetch(src, { method: "HEAD" });
					const contentLength =
						response.headers.get("content-length");
					if (contentLength) size = parseInt(contentLength, 10);
				} catch {
					size = null;
				}
			} else {
				try {
					const imgPath = path.isAbsolute(src)
						? src
						: path.join(path.dirname(filePath), src);
					const stat = await fs.stat(imgPath);
					size = stat.size;
				} catch {
					size = null;
				}
			}
		}

		const sizeKB =
			size !== null && size !== undefined
				? Math.round((size / 1024) * 10) / 10
				: null;
		const imageData = { src, name, alt, size, sizeKB };
		images.push(imageData);
		if (isAltMissing) imagesWithoutAlt.push(imageData);
	}

	// === ENLACES ===
	const links = [];
	const brokenLinks = [];
	$("a[href]").each((_, a) => {
		const href = $(a).attr("href");
		const target = $(a).attr("target") || null;
		let text = $(a).text().trim();
		if (!text) {
			const imgAlt = $(a).find("img").attr("alt");
			if (imgAlt) text = imgAlt;
		}
		if (href) {
			links.push({
				href,
				text: text || "(sin texto)",
				target,
				type: classifyLink(href),
			});
		}
	});
	for (const link of links.filter((l) => l.type === "external")) {
		const ok = await checkLink(link.href);
		if (!ok) {
			brokenLinks.push({
				...link,
				status: "No responde o error",
			});
		}
	}

	// === TEXTOS EN BOLD, ITALIC Y FUENTES ===
	const boldTexts = [];
	const italicTexts = [];
	const fontFamilies = new Set();
	const fontSizes = new Set();

	$(
		"[style*='font-family'], [style*='font-size'], [style*='font-weight']"
	).each((_, el) => {
		let style = ($(el).attr("style") || "")
			.toLowerCase()
			.replace(/\s+/g, "");
		const fontFamilyMatch = style.match(/font-family:([^;]+)/i);
		const fontSizeMatch = style.match(/font-size:([^;]+)/i);
		if (fontFamilyMatch) fontFamilies.add(fontFamilyMatch[1].trim());
		if (fontSizeMatch) fontSizes.add(fontSizeMatch[1].trim());
	});

	$(
		"b, strong, [style*='font-weight:bold'], [style*='font-weight: 700']"
	).each((_, el) => {
		const text = $(el).text().trim();
		if (text) boldTexts.push(text);
		const style = ($(el).attr("style") || "")
			.toLowerCase()
			.replace(/\s+/g, "");
		const match = style.match(/font-family:([^;]+)/i);
		if (match) fontFamilies.add(match[1].trim());
	});

	$("i, em, [style*='font-style:italic']").each((_, el) => {
		const text = $(el).text().trim();
		if (text) italicTexts.push(text);
		const style = ($(el).attr("style") || "")
			.toLowerCase()
			.replace(/\s+/g, "");
		const match = style.match(/font-family:([^;]+)/i);
		if (match) fontFamilies.add(match[1].trim());
	});

	// === TDs SIN PUNTO FINAL ===
	const tdsWithoutPeriod = [];
	const omitEndings = [
		"•",
		"†",
		"*",
		"™",
		"◦",
		"☐",
		"—",
		"‐",
		":",
		",",
		";",
		'"',
		"“",
		"”",
		"¿",
		"?",
		"!",
		"¡",
		"@",
	];
	const omitEntities = [
		"&#8226;",
		"&bull;",
		"&dagger;",
		"&trade;",
		"&#9702;",
		"&#9744;",
		"&mdash;",
		"&dash;",
	];
	const omitOnly = [
		"—",
		"‐",
		":",
		",",
		";",
		'"',
		"“",
		"”",
		"¿",
		"?",
		"!",
		"¡",
		"@",
		"&mdash;",
		"&dash;",
	];
	for (let i = 0; i <= 9; i++) {
		omitEndings.push(i.toString());
		omitOnly.push(i.toString());
	}
	$("td").each((_, td) => {
		let text = $(td).html() || "";
		text = text
			.replace(/<[^>]+>/g, "")
			.replace(/&nbsp;/g, " ")
			.trim();
		if (!text) return;
		let decoded = decodeHTMLEntity(text).trim();
		if (decoded.endsWith(".")) return;
		if (
			omitEndings.some((s) => decoded === s) ||
			omitEntities.some(
				(e) => text === e || decoded === decodeHTMLEntity(e)
			) ||
			omitOnly.some((s) => decoded === s)
		)
			return;
		for (const symbol of omitEndings) {
			if (decoded.replace(/\s+$/, "").endsWith(symbol)) return;
		}
		for (const entity of omitEntities) {
			const entityDecoded = decodeHTMLEntity(entity);
			if (decoded.replace(/\s+$/, "").endsWith(entityDecoded)) return;
			if (text.replace(/\s+$/, "").endsWith(entity)) return;
		}
		tdsWithoutPeriod.push(decoded);
	});

	// === ORTOGRAFÍA (usando nspell) ===
	const imported = await import("dictionary-en");
	const dictData = imported.default;
	if (!dictData || !dictData.aff || !dictData.dic) {
		throw new Error("No se pudo cargar el diccionario de inglés.");
	}
	const spell = nspell(dictData);
	const allText = $("body").text();
	const words =
		allText
			.toLowerCase()
			.match(/\b[a-záéíóúüñ]{2,}(?:-[a-záéíóúüñ]{2,})*\b/gi) || [];
	const splitWords = words.flatMap((w) => w.split("-"));
	const spellingErrorsArray = Array.from(
		new Set(splitWords.filter((word) => !spell.correct(word)))
	);

	// === Contexto de errores ortográficos (3 palabras antes y después) ===
	const spellingErrorsWithContext = spellingErrorsArray.map((word) => {
		const regex = new RegExp(
			`(?:\\b(?:\\w+\\b\\W*){0,3})\\b${word}\\b(?:\\W*\\b\\w+){0,3}`,
			"i"
		);
		const contextMatch = allText.match(regex);
		return {
			word,
			context: contextMatch ? contextMatch[0].trim() : null,
		};
	});

	// === Palabras repetidas ===
	const repeatedWords = [];
	const repeatedRegex = /\b(\w+)(\s+)?\1\b/gi;
	let match;
	while ((match = repeatedRegex.exec(allText.toLowerCase())) !== null) {
		repeatedWords.push(match[0]);
	}

	// === Espacios dobles ===
	const doubleSpaces = allText.match(/ {2,}/g) || [];

	// === Caracteres invisibles ===
	const invisibleChars =
		allText.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g) || [];

	// === Veeva tokens ===
	const veevaTokenRegex = /\{\{\s*([\s\S]*?)\s*\}\}/g;
	const veevaTokens = [];
	const customTextBlocks = []; // ← customText[...] normales
	const customTextPreheaders = []; // ← los que están dentro de <span class="preheader">

	let tokenMatch;
	while ((tokenMatch = veevaTokenRegex.exec(html)) !== null) {
		const token = tokenMatch[1].trim();
		veevaTokens.push(token);

		// Detecta si el token está dentro de un <span class="preheader">
		const contextHTML = html.slice(
			Math.max(0, tokenMatch.index - 500),
			tokenMatch.index + 500
		);
		const isInsidePreheader =
			/<span[^>]*\bclass\s*=\s*["'][^"']*\bpreheader\b[^"']*["'][^>]*>/i.test(
				contextHTML
			);


		// Si es customText[...] lo dividimos en frases
		const customTextMatch = token.match(/^customText\[(.*)\]$/i);
		if (customTextMatch) {
			const phrases = customTextMatch[1]
				.split("|")
				.map((p) => p.trim())
				.filter(Boolean);
			if (phrases.length > 0) {
				if (isInsidePreheader) {
					customTextPreheaders.push(phrases);
				} else {
					customTextBlocks.push(phrases);
				}
			}
		}
	}

	return {
		images,
		imagesWithoutAlt,
		links,
		brokenLinks,
		boldTexts,
		italicTexts,
		fontFamilies: Array.from(fontFamilies),
		fontSizes: Array.from(fontSizes),
		tdsWithoutPeriod,
		spellingErrors: spellingErrorsArray,
		spellingErrorsWithContext,
		repeatedWords,
		doubleSpaces,
		invisibleChars,
		veevaTokens,
		customTextBlocks,
		customTextPreheaders,
	};
}