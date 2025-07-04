import React, { useState } from "react";
import AnalysisResult from "./AnalysisResult";
import "./CompareForm.css";

// Para producción en Netlify, las funciones estarán en /.netlify/functions/
// Para desarrollo local, necesitarás netlify dev
const API_BASE = import.meta.env.PROD 
  ? "/.netlify/functions" 
  : "http://localhost:8888/.netlify/functions";

export default function CompareForm() {
  const [htmlFile, setHtmlFile] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleHtmlChange = (e) => {
    const file = e.target.files[0];
    setAnalysisResult(null);
    if (file && !file.name.endsWith(".html")) {
      setError("Solo se permiten archivos .html");
      setHtmlFile(null);
      return;
    }
    setError(null);
    setHtmlFile(file);
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!htmlFile) {
      setError("Por favor selecciona un archivo HTML.");
      return;
    }

    setLoading(true);

    try {
      // Leer el archivo HTML como texto
      const htmlContent = await readFileAsText(htmlFile);

      // Enviar el contenido como JSON a la función serverless
      const res = await fetch(`${API_BASE}/analyze-html`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ htmlContent }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setError(errorData.error || "Error desconocido al analizar");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setAnalysisResult(data);
    } catch (err) {
      console.error("Error:", err);
      setError("Error en la comunicación con el servidor: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="compare-root">
        <h1 className="compare-title">QA Email Tool</h1>
        <form className="compare-form" onSubmit={handleSubmit}>
          <div className="compare-field">
            <label className="compare-label">
              File HTML:
              <input
                type="file"
                name="htmlFile"
                accept=".html"
                onChange={handleHtmlChange}
                className="compare-input"
              />
            </label>
          </div>
          <button type="submit" className="compare-btn" disabled={loading}>
            {loading ? "Analizando..." : "Analizar"}
          </button>
        </form>
        {error && <p className="compare-error">{error}</p>}
      </div>

      <div className="result-root">
        <AnalysisResult analysisResult={analysisResult} />
      </div>
    </>
  );
}