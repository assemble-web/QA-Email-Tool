// netlify/functions/analyze-html.js
import { Buffer } from 'buffer';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import nspell from 'nspell';

// Utilidades (copiadas de tu htmlAnalyzer.js)
function decodeHTMLEntity(str) {
	if (!str) return "";
	return str
		.replace(/&reg;/g, "®")
		.replace(/'/g, "'")
		.replace(/&rsquo;/g, "'")
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

async function analyzeHTML(htmlContent) {
	const $ = cheerio.load(htmlContent);

	// === IMÁGENES ===
	const images = [];
	const imagesWithoutAlt = [];
	
	for (const img of $("img").toArray()) {
		const src = $(img).attr("src") || "";
		const alt = $(img).attr("alt");
		const isAltMissing = !alt || (typeof alt === "string" && alt.trim() === "");
		const name = src.split("/").pop();
		
		const imageData = { src, name, alt, size: null, sizeKB: null };
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

	// Verificar enlaces externos (limitado por timeout de serverless)
	for (const link of links.filter((l) => l.type === "external").slice(0, 10)) {
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

	$("[style*='font-family'], [style*='font-size'], [style*='font-weight']").each((_, el) => {
		let style = ($(el).attr("style") || "").toLowerCase().replace(/\s+/g, "");
		const fontFamilyMatch = style.match(/font-family:([^;]+)/i);
		const fontSizeMatch = style.match(/font-size:([^;]+)/i);
		if (fontFamilyMatch) fontFamilies.add(fontFamilyMatch[1].trim());
		if (fontSizeMatch) fontSizes.add(fontSizeMatch[1].trim());
	});

	$("b, strong, [style*='font-weight:bold'], [style*='font-weight: 700']").each((_, el) => {
		const text = $(el).text().trim();
		if (text) boldTexts.push(text);
	});

	$("i, em, [style*='font-style:italic']").each((_, el) => {
		const text = $(el).text().trim();
		if (text) italicTexts.push(text);
	});

	// === TDs SIN PUNTO FINAL ===
	const tdsWithoutPeriod = [];
	const omitEndings = ["•", "†", "*", "™", "◦", "☐", "—", "‐", ":", ",", ";", '"', """, """, "¿", "?", "!", "¡", "@"];
	
	for (let i = 0; i <= 9; i++) {
		omitEndings.push(i.toString());
	}
	
	$("td").each((_, td) => {
		let text = $(td).html() || "";
		text = text.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
		if (!text) return;
		let decoded = decodeHTMLEntity(text).trim();
		if (decoded.endsWith(".")) return;
		
		const shouldOmit = omitEndings.some(symbol => 
			decoded === symbol || decoded.replace(/\s+$/, "").endsWith(symbol)
		);
		
		if (!shouldOmit) {
			tdsWithoutPeriod.push(decoded);
		}
	});

	// === ORTOGRAFÍA ===
	let spellingErrorsArray = [];
	let spellingErrorsWithContext = [];
	
	try {
		const imported = await import("dictionary-en");
		const dictData = imported.default;
		if (dictData && dictData.aff && dictData.dic) {
			const spell = nspell(dictData);
			const allText = $("body").text();
			const words = allText.toLowerCase().match(/\b[a-záéíóúüñ]{2,}(?:-[a-záéíóúüñ]{2,})*\b/gi) || [];
			const splitWords = words.flatMap((w) => w.split("-"));
			spellingErrorsArray = Array.from(new Set(splitWords.filter((word) => !spell.correct(word))));
			
			spellingErrorsWithContext = spellingErrorsArray.map((word) => {
				const regex = new RegExp(`(?:\\b(?:\\w+\\b\\W*){0,3})\\b${word}\\b(?:\\W*\\b\\w+){0,3}`, "i");
				const contextMatch = allText.match(regex);
				return {
					word,
					context: contextMatch ? contextMatch[0].trim() : null,
				};
			});
		}
	} catch (error) {
		console.warn("No se pudo cargar el diccionario:", error.message);
	}

	// === Palabras repetidas ===
	const allText = $("body").text();
	const repeatedWords = [];
	const repeatedRegex = /\b(\w+)(\s+)?\1\b/gi;
	let match;
	while ((match = repeatedRegex.exec(allText.toLowerCase())) !== null) {
		repeatedWords.push(match[0]);
	}

	// === Espacios dobles ===
	const doubleSpaces = allText.match(/ {2,}/g) || [];

	// === Caracteres invisibles ===
	const invisibleChars = allText.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g) || [];

	// === Veeva tokens ===
	const veevaTokenRegex = /\{\{\s*([\s\S]*?)\s*\}\}/g;
	const veevaTokens = [];
	const customTextBlocks = [];
	const customTextPreheaders = [];

	let tokenMatch;
	while ((tokenMatch = veevaTokenRegex.exec(htmlContent)) !== null) {
		const token = tokenMatch[1].trim();
		veevaTokens.push(token);

		const contextHTML = htmlContent.slice(
			Math.max(0, tokenMatch.index - 500),
			tokenMatch.index + 500
		);
		const isInsidePreheader = /<span[^>]*\bclass\s*=\s*["'][^"']*\bpreheader\b[^"']*["'][^>]*>/i.test(contextHTML);

		const customTextMatch = token.match(/^customText\[(.*)\]$/i);
		if (customTextMatch) {
			const phrases = customTextMatch[1].split("|").map((p) => p.trim()).filter(Boolean);
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

export async function handler(event, context) {
	// Habilitar CORS
	const headers = {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Content-Type': 'application/json'
	};

	// Manejar preflight OPTIONS request
	if (event.httpMethod === 'OPTIONS') {
		return {
			statusCode: 200,
			headers,
			body: ''
		};
	}

	if (event.httpMethod !== 'POST') {
		return {
			statusCode: 405,
			headers,
			body: JSON.stringify({ error: 'Método no permitido' })
		};
	}

	try {
		// Parsear el body que viene en base64 (multipart/form-data)
		const body = event.isBase64Encoded 
			? Buffer.from(event.body, 'base64').toString() 
			: event.body;

		// Para simplificar, esperamos que el HTML venga como JSON
		const { htmlContent } = JSON.parse(body);
		
		if (!htmlContent) {
			return {
				statusCode: 400,
				headers,
				body: JSON.stringify({ error: 'No se proporcionó contenido HTML' })
			};
		}

		const analysis = await analyzeHTML(htmlContent);

		return {
			statusCode: 200,
			headers,
			body: JSON.stringify({
				success: true,
				message: 'Análisis de HTML completado',
				analysis
			})
		};

	} catch (error) {
		console.error('Error en análisis:', error);
		return {
			statusCode: 500,
			headers,
			body: JSON.stringify({
				error: 'Error en análisis de HTML',
				details: error.message
			})
		};
	}
}