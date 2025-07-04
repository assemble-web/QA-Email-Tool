# QA Email Tool - Serverless Mode

This version of the QA Email Tool has been adapted to run on **Netlify with Serverless Functions**, eliminating the need for a separate backend server.

## 🏗️ Architecture

- **Frontend**: React + Vite (hosted on Netlify CDN)
- **Backend**: Netlify Functions (serverless)
- **Analysis Engine**: Moved to `netlify/functions/analyze-html.js`

## 🚀 Quick Start

### Development
```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Install frontend dependencies
cd frontend
npm install

# Install function dependencies  
cd ../netlify/functions
npm install

# Start development server (from project root)
cd ../..
netlify dev
```

This will start:
- Frontend at `http://localhost:8888`
- Functions at `http://localhost:8888/.netlify/functions/`

### Production Deployment

1. **Connect to Netlify**:
   - Push this branch to your GitHub repo
   - Connect the repo to Netlify
   - Netlify will auto-detect the `netlify.toml` configuration

2. **Configuration** (auto-detected from `netlify.toml`):
   ```
   Base directory: frontend
   Build command: npm run build  
   Publish directory: frontend/dist
   Functions directory: netlify/functions
   ```

3. **Deploy**: Netlify will automatically deploy both the frontend and functions

## 📁 New File Structure

```
QA-Email-Tool/
├── netlify.toml                    # Netlify configuration
├── netlify/
│   └── functions/
│       ├── package.json            # Function dependencies
│       └── analyze-html.js         # Main analysis function
├── frontend/                       # React frontend
│   ├── src/
│   │   └── CompareForm.jsx         # Updated to use serverless functions
│   └── ...
└── backend/                        # Legacy - not used in production
```

## 🔧 How It Works

1. **File Upload**: User selects HTML file in browser
2. **File Reading**: Frontend reads file content using FileReader API
3. **API Call**: Content sent as JSON to `/.netlify/functions/analyze-html`
4. **Analysis**: Serverless function processes HTML using cheerio, nspell, etc.
5. **Response**: Analysis results returned to frontend

## ✅ Benefits

- ✅ **No server management** - fully serverless
- ✅ **Auto-scaling** - handles traffic spikes automatically  
- ✅ **Global CDN** - fast worldwide delivery
- ✅ **HTTPS included** - secure by default
- ✅ **Cost-effective** - pay only for usage

## 🔄 Migration Notes

### What Changed:
- **Backend**: Express server → Netlify Functions
- **File handling**: Multer uploads → Browser FileReader API
- **API calls**: `/api/compare` → `/.netlify/functions/analyze-html`
- **Dependencies**: Moved to `netlify/functions/package.json`

### What Stayed the Same:
- **Analysis logic**: Core HTML analysis unchanged
- **Frontend UI**: Same React components and styling
- **Features**: All QA features preserved

## 🛠️ Development Commands

```bash
# Development
netlify dev                         # Start dev server with functions

# Build
cd frontend && npm run build        # Build frontend only

# Function testing
netlify functions:invoke analyze-html --payload '{"htmlContent":"<html>test</html>"}'
```

## 🌐 Environment Detection

The app automatically detects the environment:
- **Development**: Uses `http://localhost:8888/.netlify/functions/`
- **Production**: Uses `/.netlify/functions/`

## 📝 Function Details

The `analyze-html.js` function:
- Accepts HTML content as JSON payload
- Performs all QA analysis (images, links, spelling, etc.)
- Returns structured analysis results
- Includes CORS headers for browser compatibility
- Handles errors gracefully with proper HTTP status codes