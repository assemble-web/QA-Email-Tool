// netlify/functions/analyze-html.js
import { Buffer } from 'buffer';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import nspell from 'nspell';

console.log("🟢 Function analyze-html loaded");

// Utilities
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
	console.log("🔵 Starting HTML analysis...");
	const $ = cheerio.load(htmlContent);

	// Images
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

	console.log(`🔵 Found ${images.length} images, ${imagesWithoutAlt.length} without alt`);

	// Links
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
				text: text || "(no text)",
				target,
				type: classifyLink(href),
			});
		}
	});

	console.log(`🔵 Found ${links.length} links`);

	// Check broken links (limited for serverless timeout)
	for (const link of links.filter((l) => l.type === "external").slice(0, 5)) {
		const ok = await checkLink(link.href);
		if (!ok) {
			brokenLinks.push({
				...link,
				status: "Not responding or error",
			});
		}
	}

	// Bold and italic texts
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

	// TDs without period
	const tdsWithoutPeriod = [];
	const omitEndings = ["•", "†", "*", "™", "◦", "☐", "—", "‐", ":", ",", ";", '"', "¿", "?", "!", "¡", "@"];
	
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

	// Spelling (simplified for serverless)
	let spellingErrorsArray = [];
	let spellingErrorsWithContext = [];
	
	try {
		console.log("🔵 Loading dictionary...");
		const imported = await import("dictionary-en");
		const dictData = imported.default;
		if (dictData && dictData.aff && dictData.dic) {
			const spell = nspell(dictData);
			const allText = $("body").text();
			const words = allText.toLowerCase().match(/\b[a-z]{2,}\b/gi) || [];
			spellingErrorsArray = Array.from(new Set(words.filter((word) => !spell.correct(word)))).slice(0, 20);
			
			spellingErrorsWithContext = spellingErrorsArray.map((word) => {
				return {
					word,
					context: `Context for ${word}`,
				};
			});
		}
		console.log(`🔵 Spelling errors: ${spellingErrorsArray.length}`);
	} catch (error) {
		console.warn("🟡 Could not load dictionary:", error.message);
	}

	// Repeated words
	const allText = $("body").text();
	const repeatedWords = [];
	const repeatedRegex = /\b(\w+)(\s+)?\1\b/gi;
	let match;
	while ((match = repeatedRegex.exec(allText.toLowerCase())) !== null) {
		repeatedWords.push(match[0]);
		if (repeatedWords.length > 10) break; // Limit for performance
	}

	// Double spaces
	const doubleSpaces = allText.match(/ {2,}/g) || [];

	// Invisible chars
	const invisibleChars = allText.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g) || [];

	// Veeva tokens
	const veevaTokenRegex = /\{\{\s*([\s\S]*?)\s*\}\}/g;
	const veevaTokens = [];
	const customTextBlocks = [];
	const customTextPreheaders = [];

	let tokenMatch;
	while ((tokenMatch = veevaTokenRegex.exec(htmlContent)) !== null) {
		const token = tokenMatch[1].trim();
		veevaTokens.push(token);

		const customTextMatch = token.match(/^customText\[(.*)\]$/i);
		if (customTextMatch) {
			const phrases = customTextMatch[1].split("|").map((p) => p.trim()).filter(Boolean);
			if (phrases.length > 0) {
				customTextBlocks.push(phrases);
			}
		}
	}

	console.log("🔵 Analysis completed successfully");

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
	console.log("🟢 ===== FUNCTION INVOKED =====");
	console.log("🟢 Method:", event.httpMethod);
	console.log("🟢 Path:", event.path);
	console.log("🟢 Headers:", JSON.stringify(event.headers, null, 2));
	console.log("🟢 Query params:", JSON.stringify(event.queryStringParameters, null, 2));

	// Enable CORS
	const headers = {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Content-Type': 'application/json'
	};

	// Handle preflight OPTIONS request
	if (event.httpMethod === 'OPTIONS') {
		console.log("🟢 Responding to OPTIONS request");
		return {
			statusCode: 200,
			headers,
			body: ''
		};
	}

	if (event.httpMethod !== 'POST') {
		console.log("🔴 Method not allowed:", event.httpMethod);
		return {
			statusCode: 405,
			headers,
			body: JSON.stringify({ error: 'Method not allowed' })
		};
	}

	try {
		console.log("🔵 Processing request body...");
		console.log("🔵 Body exists:", !!event.body);
		console.log("🔵 Is base64 encoded:", event.isBase64Encoded);
		
		const body = event.isBase64Encoded 
			? Buffer.from(event.body, 'base64').toString() 
			: event.body;

		console.log("🔵 Body length:", body ? body.length : 0);
		console.log("🔵 Body preview:", body ? body.substring(0, 200) + "..." : "null");

		const { htmlContent } = JSON.parse(body);
		
		console.log("🔵 HTML content exists:", !!htmlContent);
		console.log("🔵 HTML content length:", htmlContent ? htmlContent.length : 0);
		
		if (!htmlContent) {
			console.log("🔴 No HTML content provided");
			return {
				statusCode: 400,
				headers,
				body: JSON.stringify({ error: 'No HTML content provided' })
			};
		}

		console.log("🔵 Starting analysis...");
		const analysis = await analyzeHTML(htmlContent);

		console.log("🟢 Analysis successful, sending response");
		console.log("🟢 Response data keys:", Object.keys(analysis));
		
		return {
			statusCode: 200,
			headers,
			body: JSON.stringify({
				success: true,
				message: 'HTML analysis completed',
				analysis
			})
		};

	} catch (error) {
		console.error('🔴 Error in analysis:', error);
		console.error('🔴 Error name:', error.name);
		console.error('🔴 Error message:', error.message);
		console.error('🔴 Error stack:', error.stack);
		
		return {
			statusCode: 500,
			headers,
			body: JSON.stringify({
				error: 'Error in HTML analysis',
				details: error.message
			})
		};
	}
}