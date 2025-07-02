import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";
import multer from "multer";
import express from "express";
import { fileURLToPath } from "url";
import { analyzeHTMLFile } from "../services/htmlAnalyzer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const uploadsDir = path.join(path.resolve(), "uploads");
if (!fs.existsSync(uploadsDir)) {
	fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, uploadsDir),
	filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });

router.post("/upload", upload.single("file"), (req, res) => {
	if (!req.file) {
		return res.status(400).json({ error: "No se subió ningún archivo" });
	}
	res.json({ filename: req.file.filename });
});

router.post("/compare", upload.single("htmlFile"), async (req, res) => {
	try {
		const htmlFile = req.file;
		if (!htmlFile) {
			return res
				.status(400)
				.json({ error: "Falta el archivo HTML para analizar" });
		}
		const htmlPath = path.join(uploadsDir, htmlFile.filename);
		const analysisData = await analyzeHTMLFile(htmlPath);
		res.json({
			success: true,
			message: "Análisis de HTML completado",
			analysis: analysisData,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({
			error: "Error en análisis de HTML",
			details: error.message,
		});
	}
});

export default router;
