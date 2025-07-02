import React, { useState } from "react";
import AnalysisResult from "./AnalysisResult";
import "./CompareForm.css"; //

const BACKEND_URL = "http://localhost:5000";

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!htmlFile) {
      setError("Por favor selecciona un archivo HTML.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("htmlFile", htmlFile);

    try {
      const res = await fetch(`${BACKEND_URL}/api/compare`, {
        method: "POST",
        body: formData,
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
      setError("Error en la comunicación con el servidor");
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