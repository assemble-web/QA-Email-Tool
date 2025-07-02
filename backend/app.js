import express from "express";
import cors from "cors";
import apiRouter from "./routes/api.js";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" })); // Limite aumentado si necesitas
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Servir archivos estáticos (para poder acceder a /uploads/diff.png, etc)
app.use("/uploads", express.static(path.join(path.resolve(), "uploads")));

app.use("/api", apiRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
	console.log(`Servidor corriendo en puerto ${PORT}`);
});
