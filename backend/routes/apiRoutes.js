const express = require("express");
const router = express.Router();

const fileUploadController = require("../controllers/fileUploadController");

// POST /upload -> ruta para subir archivos
router.post(
	"/upload",
	fileUploadController.uploadMiddleware,
	fileUploadController.handleUpload
);

// POST /analyze -> ruta para analizar archivo HTML
router.post("/analyze", fileUploadController.analyzeHTML);

module.exports = router;
