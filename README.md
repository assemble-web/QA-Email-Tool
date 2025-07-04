# QA Email Tool
Hecho en Colombia 🇨🇴 por Victor Camayo <br> Assemble Studio | Development Team

## Descripción
Una herramienta de Quality Assurance para emails que analiza contenido HTML en busca de errores comunes, problemas de accesibilidad y elementos que pueden afectar la entregabilidad de emails.

## 🚀 Características

- **Análisis de imágenes**: Detecta imágenes sin texto alternativo
- **Verificación de enlaces**: Identifica enlaces rotos o que no responden
- **Revisión de ortografía**: Encuentra errores de ortografía en inglés
- **Detección de texto repetido**: Identifica palabras duplicadas consecutivas
- **Análisis de formato**: Revisa espacios dobles, caracteres invisibles
- **Análisis de celdas**: Detecta celdas de tabla sin puntuación final
- **Tokens de Veeva**: Identifica y analiza tokens de Veeva para emails farmacéuticos
- **Análisis de tipografía**: Revisa fuentes y tamaños utilizados

## 🏗️ Estructura del Proyecto

```
QA-Email-Tool/
├── frontend/                 # Aplicación React + Vite
│   ├── src/
│   │   ├── App.jsx           # Componente principal
│   │   ├── CompareForm.jsx   # Formulario de comparación
│   │   ├── FileUpload.jsx    # Componente de carga de archivos
│   │   ├── AnalysisResult.jsx # Resultados del análisis
│   │   └── ...
│   ├── package.json
│   ├── vite.config.js
│   └── ...
├── netlify/
│   └── functions/
│       └── analyze-html.js   # Función serverless para análisis
├── netlify.toml             # Configuración de Netlify
├── package.json             # Dependencias del backend
└── README.md
```

## 📋 Prerrequisitos

- **Node.js** (versión 18 o superior)
- **npm** o **yarn**
- Cuenta de **Netlify** (para deployment)

## 🛠️ Instalación y Configuración Local

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd QA-Email-Tool
```

### 2. Instalar dependencias del backend

```bash
# Instalar dependencias para las Netlify Functions
npm install
```

### 3. Instalar dependencias del frontend

```bash
# Navegar al directorio del frontend
cd frontend

# Instalar dependencias
npm install
```

### 4. Configurar variables de entorno (opcional)

Si necesitas configurar variables de entorno, crea un archivo `.env` en el directorio `frontend/`:

```bash
# frontend/.env
VITE_API_URL=http://localhost:8888/.netlify/functions
```

## 🏃‍♂️ Ejecutar el Proyecto Localmente

### Opción 1: Usando Netlify Dev (Recomendado)

Netlify Dev simula el entorno de producción localmente, incluyendo las funciones serverless.

```bash
# Desde el directorio raíz del proyecto
npx netlify dev
```

Esto iniciará:
- El frontend en `http://localhost:8888`
- Las Netlify Functions en `http://localhost:8888/.netlify/functions`

### Opción 2: Desarrollo separado

Si prefieres ejecutar el frontend y backend por separado:

```bash
# Terminal 1: Ejecutar el frontend
cd frontend
npm run dev

# Terminal 2: Ejecutar las Netlify Functions
# (Requiere Netlify CLI instalado globalmente)
netlify functions:serve
```

## 🚀 Deploy en Netlify

### Método 1: Deploy Automático con Git (Recomendado)

1. **Subir código a Git**:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Conectar repositorio en Netlify**:
   - Ve a [Netlify](https://app.netlify.com)
   - Haz clic en "New site from Git"
   - Conecta tu repositorio (GitHub, GitLab, Bitbucket)
   - Selecciona tu repositorio

3. **Configurar settings de build**:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   
   > **Nota**: Estos settings ya están configurados en el archivo `netlify.toml`, por lo que Netlify los detectará automáticamente.

4. **Deploy**:
   - Haz clic en "Deploy site"
   - Netlify construirá y desplegará automáticamente tu sitio

### Método 2: Deploy Manual

```bash
# Instalar Netlify CLI globalmente
npm install -g netlify-cli

# Hacer login en Netlify
netlify login

# Desde el directorio raíz del proyecto
netlify deploy

# Para deploy a producción
netlify deploy --prod
```

### Método 3: Drag & Drop

1. **Construir el proyecto localmente**:
   ```bash
   cd frontend
   npm run build
   ```

2. **Subir manualmente**:
   - Ve a [Netlify](https://app.netlify.com)
   - Arrastra y suelta la carpeta `frontend/dist` en el área de deploy

## ⚙️ Configuración de Netlify

El archivo `netlify.toml` contiene toda la configuración necesaria:

```toml
[build]
  base = "frontend"
  publish = "dist"
  command = "npm run build"

[functions]
  directory = "../netlify/functions"
  
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

### Variables de entorno en Netlify

Si necesitas configurar variables de entorno en producción:

1. Ve a tu sitio en Netlify Dashboard
2. Site settings > Environment variables
3. Agrega las variables necesarias

## 📝 Scripts Disponibles

### Frontend (`frontend/` directory)

```bash
npm run dev      # Inicia servidor de desarrollo
npm run build    # Construye para producción
npm run preview  # Vista previa de la build
npm run lint     # Ejecuta ESLint
```

### Raíz del proyecto

```bash
netlify dev      # Inicia todo el entorno local con Netlify Dev
netlify deploy   # Deploy manual a Netlify
```

## 🔧 Solución de Problemas

### Error: "Functions not working locally"

```bash
# Asegúrate de tener Netlify CLI instalado
npm install -g netlify-cli

# Ejecuta desde el directorio raíz
netlify dev
```

### Error: "Build fails on Netlify"

- Verifica que las dependencias estén correctamente listadas en `package.json`
- Revisa los logs de build en Netlify Dashboard
- Asegúrate de que el `netlify.toml` esté en el directorio raíz

### Error: "CORS issues"

Las funciones ya incluyen headers CORS. Si persisten problemas:

```javascript
// En netlify/functions/analyze-html.js
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la licencia [MIT](LICENSE).

## 🆘 Soporte

Si encuentras algún problema o necesitas ayuda:

1. Revisa la sección de [Solución de Problemas](#-solución-de-problemas)
2. Abre un [Issue](../../issues) en el repositorio
3. Contacta al equipo de desarrollo

---

**Desarrollado con ❤️ para mejorar la calidad de los emails**