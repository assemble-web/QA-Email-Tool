import React, { useState } from "react";

export default function FileUpload({ onFileUploaded }) {
  const [file, setFile] = useState(null);

  const handleChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("http://localhost:5000/api/upload", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      onFileUploaded(data.filename);
    } else {
      alert("Error al subir archivo");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="file" accept=".html" onChange={handleChange} />
      <button type="submit">Subir y analizar</button>
    </form>
  );
}
