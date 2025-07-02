const fs = require("fs");
const cheerio = require("cheerio");
const path = require("path");
const multer = require("multer");

// Definir carpeta uploads
const uploadDir = path.join(__dirname, "../uploads");

// Crear carpeta uploads si no existe
if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir);
}

// Configuración Multer para guardar archivos
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, uploadDir);
	},
	filename: function (req, file, cb) {
		cb(null, file.originalname);
	},
});
const upload = multer({ storage });

// Middleware para manejar subida de un solo archivo (campo "file")
exports.uploadMiddleware = upload.single("file");

// Handler para responder luego de subir archivo
exports.handleUpload = (req, res) => {
	if (!req.file) {
		return res.status(400).json({ message: "No se subió ningún archivo" });
	}
	res.json({
		message: "Archivo subido correctamente",
		filename: req.file.originalname,
	});
};

// Handler para analizar archivo HTML con lógica real
exports.analyzeHTML = async (req, res) => {
	try {
		const fileName = req.body.filename;
		if (!fileName) {
			return res
				.status(400)
				.json({ message: "Falta el nombre del archivo (filename)" });
		}

		const filePath = path.join(uploadDir, fileName);

		// Leer el archivo HTML
		const htmlContent = fs.readFileSync(filePath, "utf8");

		// Cargar HTML en Cheerio
		const $ = cheerio.load(htmlContent);

		// --- Análisis de imágenes <img> ---
		const imgElements = $("img");
		const totalImgs = imgElements.length;

		const imgsInfo = [];
		imgElements.each((i, el) => {
			const src = $(el).attr("src") || "sin-src";
			const alt = $(el).attr("alt") || "sin alt";
			const nombre = path.basename(src);
			imgsInfo.push({ nombre, alt });
		});

		// --- Análisis de enlaces <a> ---
		const linkElements = $("a");
		const totalLinks = linkElements.length;

		const linksInfo = [];
		linkElements.each((i, el) => {
			const href = $(el).attr("href") || "sin href";
			const target = $(el).attr("target") || "sin target";

			// Intentar obtener texto visible o descripción
			let nombreLink = $(el).text().trim();

			// Si no hay texto, buscar si contiene imagen
			if (!nombreLink) {
				const img = $(el).find("img");
				if (img.length > 0) {
					nombreLink =
						img.attr("alt") || img.attr("src") || "imagen sin alt";
				} else {
					nombreLink = "sin texto";
				}
			}

			linksInfo.push({ href, target, nombreLink });
		});

		// Respuesta final
		res.json({
			success: true,
			message: `Archivo ${fileName} analizado correctamente.`,
			data: {
				totalImgs,
				imgs: imgsInfo,
				totalLinks,
				links: linksInfo,
			},
		});
	} catch (err) {
		console.error("Error analizando HTML:", err.message);
		res.status(500).json({
			message: "Error interno al analizar HTML",
			error: err.message,
		});
	}
};
