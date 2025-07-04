import React from "react";
import "./AnalysisResult.css";

const BACKEND_URL = "http://localhost:5000";


// === Agrega la función aquí ===
function decodeHTMLEntity(str) {
  if (!str) return "";
  return str
    .replace(/&reg;/g, "®")
    .replace(/&rsquo;/g, "’")
    .replace(/&trade;/g, "™")
    .replace(/&bull;/g, "•")
    .replace(/&dagger;/g, "†")
    .replace(/&#8226;/g, "•")
    .replace(/&#9702;/g, "◦")
    .replace(/&#9744;/g, "☐");
}

export default function AnalysisResult({ analysisResult }) {
  
  if (!analysisResult) return null;
  if (analysisResult.error) {
    return <div className="error">Error: {analysisResult.error}</div>;
  }

  const { analysis, diffImage, mismatchPixels } = analysisResult;
  console.log("🧪 customTextPreheaders:", analysis.customTextPreheaders);


  return (
    <div className="analysis-root">

      <h2>Resultado del Análisis</h2>

      <details>
        {/* === Imágenes === */}
        <summary><b>Imágenes encontradas ({analysis.images.length})</b></summary>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Src (URL)</th>
              <th>Texto ALT</th>
              <th>Peso (kb)</th>
            </tr>
          </thead>
          <tbody>
            {analysis.images.map(({ name, src, alt, sizeKB }, i) => (
              <tr key={i}>
                <td>{name}</td>
                <td>
                  <a href={src} target="_blank" rel="noopener noreferrer">
                    {src}
                  </a>
                </td>
                <td>
                  {alt && alt.trim() !== "" ? (
                    alt
                  ) : (
                    <span className="error">(sin texto ALT)</span>
                  )}
                </td>
                <td>
                  {typeof sizeKB === "number" && !isNaN(sizeKB) ? (
                    <span className={sizeKB > 300 ? "error" : undefined}>
                      {sizeKB} kb
                    </span>
                  ) : (
                    <i>?</i>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* === Imágenes sin ALT === */}
        <h4 className="error" style={{ marginTop: "20px" }}>
          Imágenes sin texto ALT: {analysis.imagesWithoutAlt.length}
        </h4>
        {analysis.imagesWithoutAlt.length > 0 && (
          <ul>
            {analysis.imagesWithoutAlt.length === 0 ? (
              <li>Todas las imágenes tienen texto ALT.</li>
            ) : (
              analysis.imagesWithoutAlt.map(({ name, src }, i) => (
                <li key={i}>
                  {name} - <a href={src} target="_blank" rel="noopener noreferrer">{src}</a>
                </li>
              ))
            )}
          </ul>
        )}
      </details>

      <details>
        {/* === Enlaces === */}
        <summary><b>Enlaces encontrados ({analysis.links.length})</b></summary>
        <table>
          <thead>
            <tr>
              <th>Texto / Nombre</th>
              <th>Href (URL)</th>
              <th>Target</th>
              <th>Tipo</th>
            </tr>
          </thead>
          <tbody>
            {analysis.links.map(({ text, href, target, type }, i) => (
              <tr key={i}>
                <td>{text}</td>
                <td>
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {href}
                  </a>
                </td>
                <td>{target || <i>(no tiene)</i>}</td>
                <td>{type}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* === Enlaces rotos === */}
        
        {analysis.brokenLinks.length > 0 && (
        <>
          <h4 className="error" style={{ marginTop: "20px" }}>
            Enlaces rotos detectados: {analysis.brokenLinks.length}
          </h4>
          <ul>
            {analysis.brokenLinks.map(({ href, text, status }, i) => (
              <li key={i}>
                <strong>{text}</strong>:{" "}
                <a href={href} target="_blank" rel="noopener noreferrer">{href}</a> —{" "}
                <span className="error">{status}</span>
              </li>
            ))}
          </ul>
        </>
        )}
      </details>
      
      <details>
        {/* === Textos en Bold === */}
        <summary><b>Textos en <u>negrita</u></b></summary>
        {analysis.boldTexts && analysis.boldTexts.length > 0 ? (
          <ul>
            {analysis.boldTexts.map((txt, i) => (
              <li key={i}><b>{txt}</b></li>
            ))}
          </ul>
        ) : (
          <p>No se encontraron textos en negrita.</p>
        )}
      </details>

      <details>
        {/* === Textos en Italica === */}
        <summary><b>Textos en <i><u>itálica</u></i></b></summary>
        {analysis.italicTexts && analysis.italicTexts.length > 0 ? (
          <ul>
            {analysis.italicTexts.map((txt, i) => (
              <li key={i}><i>{txt}</i></li>
            ))}
          </ul>
        ) : (
          <p>No se encontraron textos en itálica.</p>
        )}
      </details>

      <details>
        {/* === Textos en Italica === */}
          <summary><b>Veeva tokens</b></summary>

          {(Array.isArray(analysis.customTextPreheaders) && analysis.customTextPreheaders.length > 0) ||
          (Array.isArray(analysis.customTextBlocks) && analysis.customTextBlocks.length > 0) ||
          (Array.isArray(analysis.veevaTokens) && analysis.veevaTokens.some(t => !/^customtext\[/i.test(t)))
          ? (
            <>
              {/* 1. customText desde preheader */}
              {analysis.customTextPreheaders?.length > 0 && (
                <>
                 <h4 style={{ marginTop: '2em', color: '#6ec1e4' }}>📩 Preheader text:</h4>
                    {analysis.customTextPreheaders.map((phrases, i) => (
                      <ul className="veeva-token-preheader" key={`preheader-${i}`}>
                      {phrases.map((phrase, j) => (
                        <li key={j}>{decodeHTMLEntity(phrase)}</li>
                      ))}
                    </ul>
                  ))}
                </>
              )}

              {/* 2. Otros customText */}
              {analysis.customTextBlocks?.length > 0 && (
                <>
                  {analysis.customTextBlocks.map((phrases, i) => (
                    <ul className="veeva-token-list" key={`customTextBlock-${i}`}>
                      {phrases.map((phrase, j) => (
                        <li key={j}>{decodeHTMLEntity(phrase)}</li>
                      ))}
                    </ul>
                  ))}
                </>
              )}

              {/* 3. Tokens que no son customText */}
              {analysis.veevaTokens?.some(token => !/^customtext\[/i.test(token)) && (
                <ul>
                  {analysis.veevaTokens
                    .filter(token => !/^customtext\[/i.test(token))
                    .map((token, i) => (
                      <li key={i}>{decodeHTMLEntity(token)}</li>
                    ))}
                </ul>
              )}
            </>
          ) : (
            <p>No se detectaron Veeva tokens.</p>
          )}
      </details>

      <details>
        {/* === Errores ortográficos === */}
        <summary>
          <b>Errores ortográficos detectados</b>
        </summary>
        <div className="tooltip-box">
          <p>¿Por qué marca palabras como error?</p>
          <ul>
            <li>El diccionario puede no incluir palabras técnicas, nombres propios, términos médicos, marcas, abreviaturas, etc.</li>
            <li>Palabras en español o de otros idiomas no están en el diccionario inglés.</li>
            <li>Palabras con mayúsculas, símbolos, o caracteres especiales pueden no ser reconocidas correctamente.</li>
            <li>Palabras compuestas o con guiones pueden dividirse y marcarse como error si una parte no está en el diccionario.</li>
          </ul>
          
        </div>
        {Array.isArray(analysis.spellingErrorsWithContext) && analysis.spellingErrorsWithContext.length > 0 ? (
          <ul>
            {analysis.spellingErrorsWithContext.map(({ word, context }, i) => (
              <li key={i}>
                <span className="error">{word}</span>
                {context && (
                  <span className="context">
                    — <i>{context}</i>
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>No se detectaron errores ortográficos.</p>
        )}
      </details>
      
      <details>
        {/* === Palabras repetidas === */}
        <summary><b>Palabras repetidas detectadas</b></summary>
        {Array.isArray(analysis.repeatedWords) && analysis.repeatedWords.length > 0 ? (
          <ul>
            {analysis.repeatedWords.map((word, i) => (
              <li key={i} className="warn">{word}</li>
            ))}
          </ul>
        ) : (
          <p>No se detectaron palabras repetidas.</p>
        )}
      </details>

      <details>
        {/* === TDs sin punto final === */}
        <summary><b>Textos en celdas (&lt;td&gt;) sin punto final</b></summary>
        {analysis.tdsWithoutPeriod && analysis.tdsWithoutPeriod.length > 0 ? (
          <ul>
            {analysis.tdsWithoutPeriod.map((txt, i) => (
              <li key={i}>{txt}</li>
            ))}
          </ul>
        ) : (
          <p>Todos los textos en &lt;td&gt; terminan en punto.</p>
        )}
      </details>

      <details>
        {/* === Detalles de fuentes y estilos === */}
        <summary><b>Fuentes encontradas</b></summary>
        {analysis.fontFamilies && analysis.fontFamilies.length > 0 ? (
          <ul>
            {analysis.fontFamilies.map((font, i) => (
              <li key={i}>{font}</li>
            ))}
          </ul>
        ) : (
          <p>No se detectaron fuentes específicas.</p>
        )}
      </details>

      <details>
        {/* === Tamaños de fuente === */}
      <summary><b>Tamaños de fuente encontrados</b></summary>
        {analysis.fontSizes && analysis.fontSizes.length > 0 ? (
          <ul>
            {analysis.fontSizes.map((size, i) => (
              <li key={i}>{size}</li>
            ))}
          </ul>
        ) : (
          <p>No se detectaron tamaños de fuente específicos.</p>
        )}
      </details>
    </div>
    
  );
}