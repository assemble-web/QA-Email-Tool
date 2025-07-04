// netlify/functions/analyze-html.js
const { Buffer } = require('buffer');
const cheerio = require('cheerio');
const fetch = require('node-fetch');

console.log("🟢 Function analyze-html loaded");

// Basic English words list for spell checking (simplified approach)
const commonWords = new Set([
	'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'as', 'you', 'do', 'at', 'this',
	'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
	'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just',
	'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now',
	'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well',
	'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'is', 'was', 'are', 'been', 'has', 'had',
	'were', 'said', 'each', 'which', 'their', 'time', 'will', 'about', 'if', 'up', 'out', 'many', 'then', 'them', 'these', 'so',
	'some', 'her', 'would', 'make', 'like', 'into', 'him', 'has', 'two', 'more', 'very', 'what', 'know', 'just', 'first', 'get',
	'over', 'think', 'also', 'your', 'work', 'life', 'only', 'can', 'still', 'should', 'after', 'being', 'now', 'made', 'before',
	'here', 'through', 'when', 'where', 'much', 'go', 'me', 'back', 'with', 'well', 'were', 'been', 'have', 'there', 'who', 'oil',
	'its', 'sit', 'but', 'not'
]);

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

function isLikelyMisspelled(word) {
	// Simple spell checking logic
	const lowercaseWord = word.toLowerCase();
	
	// Skip if it's a common word
	if (commonWords.has(lowercaseWord)) return false;
	
	// Skip very short words
	if (word.length < 3) return false;
	
	// Skip if it looks like a proper noun (starts with capital)
	if (/^[A-Z]/.test(word)) return false;
	
	// Skip if it contains numbers
	if (/\d/.test(word)) return false;
	
	// Skip if it's all caps (likely acronym)
	if (word === word.toUpperCase()) return false;
	
	// Basic patterns that suggest misspelling
	const suspiciousPatterns = [
		/(.)\1{2,}/, // Triple letters (e.g., "thhhe")
		/[aeiou]{4,}/, // Too many vowels in a row
		/[bcdfghjklmnpqrstvwxyz]{5,}/, // Too many consonants in a row
		/^.{15,}$/, // Very long words are often typos
	];
	
	return suspiciousPatterns.some(pattern => pattern.test(lowercaseWord));
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

	// Simplified spelling check
	let spellingErrorsArray = [];
	let spellingErrorsWithContext = [];
	
	try {
		console.log("🔵 Running simplified spell check...");
		const allText = $("body").text();
		const words = allText.match(/\b[a-zA-Z]{3,}\b/g) || [];
		const uniqueWords = Array.from(new Set(words));
		
		spellingErrorsArray = uniqueWords
			.filter(word => isLikelyMisspelled(word))
			.slice(0, 10); // Limit to 10 potential misspellings
		
		spellingErrorsWithContext = spellingErrorsArray.map((word) => {
			// Find context for the word
			const wordIndex = allText.indexOf(word);
			const start = Math.max(0, wordIndex - 20);
			const end = Math.min(allText.length, wordIndex + word.length + 20);
			const context = allText.substring(start, end).trim();
			
			return {
				word,
				context: context || `Context for ${word}`,
			};
		});
		
		console.log(`🔵 Potential spelling errors: ${spellingErrorsArray.length}`);
	} catch (error) {
		console.warn("🟡 Could not perform spell check:", error.message);
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

exports.handler = async function(event, context) {
	console.log("🟢 ===== FUNCTION INVOKED =====");
	console.log("🟢 Method:", event.httpMethod);
	console.log("🟢 Path:", event.path);

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
		const body = event.isBase64Encoded 
			? Buffer.from(event.body, 'base64').toString() 
			: event.body;

		const { htmlContent } = JSON.parse(body);
		
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
		
		return {
			statusCode: 500,
			headers,
			body: JSON.stringify({
				error: 'Error in HTML analysis',
				details: error.message
			})
		};
	}
};