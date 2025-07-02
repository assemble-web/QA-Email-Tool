import React, { useState } from "react";
import FileUpload from "./FileUpload";
import AnalysisResult from "./AnalysisResult";
import CompareForm from "./CompareForm";

export default function App() {
  const [analysisResult, setAnalysisResult] = useState(null);

  const handleFileUploaded = async (filename) => {
    try {
      const res = await fetch("http://localhost:5000/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      if (!res.ok) throw new Error("Error al analizar el archivo");
      const data = await res.json();
      setAnalysisResult(data);
    } catch (error) {
      setAnalysisResult({ error: error.message });
    }
  };

  return (
    <div>
      <CompareForm />
    </div>
  );
}
