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
      console.log("🔵 Starting analysis process...");
      console.log("🔵 API_BASE:", API_BASE);
      console.log("🔵 import.meta.env.PROD:", import.meta.env.PROD);
      
      // Leer el archivo HTML como texto
      const htmlContent = await readFileAsText(htmlFile);
      console.log("🔵 HTML content length:", htmlContent.length);
      console.log("🔵 HTML preview:", htmlContent.substring(0, 100) + "...");

      const url = `${API_BASE}/analyze-html`;
      console.log("🔵 Request URL:", url);
      
      const requestBody = JSON.stringify({ htmlContent });
      console.log("🔵 Request body length:", requestBody.length);

      console.log("🔵 Making fetch request...");

      // Enviar el contenido como JSON a la función serverless
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestBody,
      });

      console.log("🔵 Response status:", res.status);
      console.log("🔵 Response OK:", res.ok);
      console.log("🔵 Response headers:", [...res.headers.entries()]);

      if (!res.ok) {
        console.log("🔴 Response not OK, trying to parse error...");
        let errorText;
        try {
          const errorData = await res.json();
          errorText = errorData.error || "Error desconocido al analizar";
          console.log("🔴 Error data:", errorData);
        } catch (parseError) {
          console.log("🔴 Could not parse error response as JSON");
          errorText = await res.text();
          console.log("🔴 Error text:", errorText);
        }
        setError(errorText);
        setLoading(false);
        return;
      }

      console.log("🔵 Parsing successful response...");
      const data = await res.json();
      console.log("🔵 Response data:", data);
      setAnalysisResult(data);
      console.log("🔵 Analysis completed successfully!");
      
    } catch (err) {
      console.error("🔴 Fetch error:", err);
      console.error("🔴 Error name:", err.name);
      console.error("🔴 Error message:", err.message);
      console.error("🔴 Error stack:", err.stack);
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