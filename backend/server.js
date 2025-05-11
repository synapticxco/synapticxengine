import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises'; // Using promises version of fs
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'fs'; // For some sync operations if needed
import { v4 as uuidv4 } from 'uuid';
import AdmZip from 'adm-zip';
import xml2js from 'xml2js';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import axios from 'axios';
import { JSDOM } from 'jsdom'; // For robust HTML parsing

// Load environment variables from .env file in the project root
config();

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies

// --- File Upload Configuration (using multer) ---
const TEMP_UPLOADS_DIR = path.join(__dirname, 'temp_uploads');

// Ensure temp_uploads directory exists
if (!existsSync(TEMP_UPLOADS_DIR)) {
  mkdirSync(TEMP_UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, TEMP_UPLOADS_DIR); // Save uploaded files to temp_uploads
  },
  filename: function (req, file, cb) {
    // Use a unique name to avoid conflicts, but keep original extension
    cb(null, `${uuidv4()}_${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'application/zip' || file.originalname.toLowerCase().endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type, please upload a .zip file for SCORM packages.'), false);
    }
  }
});

// --- Helper Functions ---

async function parseScormManifest(extractDirPath) {
  const manifestPath = path.join(extractDirPath, 'imsmanifest.xml');
  try {
    if (!existsSync(manifestPath)) {
      return { error: 'Manifest file (imsmanifest.xml) not found in the package.' };
    }

    const xmlContent = await fs.readFile(manifestPath, 'utf-8');
    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false, mergeAttrs: true }); // mergeAttrs to handle attributes easily
    const result = await parser.parseStringPromise(xmlContent);

    if (!result || !result.manifest) {
      return { error: 'Invalid manifest structure: <manifest> root element not found.' };
    }
    const manifest = result.manifest;

    let courseTitle = 'Untitled Course';
    // Try to find title in organizations -> organization -> title
    if (manifest.organizations && manifest.organizations.organization) {
      const org = Array.isArray(manifest.organizations.organization) ? manifest.organizations.organization[0] : manifest.organizations.organization;
      if (org && org.title && typeof org.title === 'string') {
        courseTitle = org.title;
      } else if (org && org.title && org.title._) { // Handle if title is an object with text content like { _: "Title Text" }
        courseTitle = org.title._;
      }
    }

    const scos = [];
    const resources = manifest.resources && manifest.resources.resource ?
                      (Array.isArray(manifest.resources.resource) ? manifest.resources.resource : [manifest.resources.resource])
                      : [];

    const items = [];
    if (manifest.organizations && manifest.organizations.organization) {
        const org = Array.isArray(manifest.organizations.organization) ? manifest.organizations.organization[0] : manifest.organizations.organization;
        if (org && org.item) {
            const collectItems = (itemArray) => {
                (Array.isArray(itemArray) ? itemArray : [itemArray]).forEach(it => {
                    if (it) { // Ensure item itself is not null/undefined
                        items.push(it);
                        if (it.item) { // Recursively collect sub-items
                            collectItems(it.item);
                        }
                    }
                });
            };
            collectItems(org.item);
        }
    }
    
    const resourceMap = new Map();
    resources.forEach(res => {
        if (res.identifier && res.href) {
            resourceMap.set(res.identifier, res.href);
        }
    });

    items.forEach(item => {
        if (item.identifierref && resourceMap.has(item.identifierref)) {
            // Check for SCORM type 'sco'
            const resourceDetails = resources.find(r => r.identifier === item.identifierref);
            if (resourceDetails && resourceDetails['adlcp:scormtype'] === 'sco') {
                let scoTitle = 'Untitled SCO';
                if (item.title && typeof item.title === 'string') {
                    scoTitle = item.title;
                } else if (item.title && item.title._) {
                     scoTitle = item.title._;
                } else if (item.identifier) {
                    scoTitle = item.identifier;
                }

                scos.push({
                    title: scoTitle,
                    href: resourceMap.get(item.identifierref),
                    identifier: item.identifier // Item identifier
                });
            }
        }
    });

    return {
      course_title: courseTitle,
      scos: scos
    };

  } catch (error) {
    console.error('Error parsing SCORM manifest:', error);
    return { error: `Error processing manifest: ${error.message}` };
  }
}

async function extractTextFromHtml(htmlFilePath) {
  try {
    if (!existsSync(htmlFilePath)) {
      console.warn(`extractTextFromHtml: HTML file not found at path: ${htmlFilePath}`);
      return { error: `HTML file not found at path: ${htmlFilePath}` };
    }
    
    const htmlContent = await fs.readFile(htmlFilePath, 'utf-8');
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    // Remove script and style elements
    document.querySelectorAll('script, style, noscript, iframe, head').forEach(el => el.remove());

    // Get text content from the body, try to be a bit more selective
    let text = '';
    if (document.body) {
        text = document.body.textContent || "";
    }
    
    // Replace multiple whitespace characters (including newlines, tabs) with a single space and trim
    const cleanedText = text.replace(/\s+/g, ' ').trim();
    
    console.log(`extractTextFromHtml: Extracted ${cleanedText.length} characters from ${htmlFilePath}`);
    return cleanedText; // Return text string directly on success

  } catch (error) {
    console.error(`Error extracting text from HTML file ${htmlFilePath}:`, error);
    return { error: `Error extracting text from HTML: ${error.message}` };
  }
}

async function getGeminiMetadata(textContent, apiKey) {
  if (!textContent || typeof textContent !== 'string' || !textContent.trim()) {
    console.log('getGeminiMetadata: Text content is empty or invalid, skipping Gemini API call.');
    return { error: 'Text content is empty or invalid, skipping Gemini API call.' };
  }
  if (!apiKey) {
    console.log('getGeminiMetadata: Gemini API key is missing.');
    return { error: 'Gemini API key is missing.' };
  }

  const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
  
  const prompt = `Analyze the following educational content. Based *only* on this text, provide the following in valid JSON format with the specified keys:
"title": (A concise and engaging title for this content)
"summary": (A comprehensive 4-5 sentence summary explaining the key concepts)
"keywords": (A list of 7-10 relevant keywords and topics as strings)
"learning_objectives": (A list of 2-4 learning objectives that a student should be able to achieve after studying this content. Each objective should start with an action verb like "Describe", "Identify", "Explain".)
"language": (The primary language of the text e.g., "English", "Spanish")

Content:
${textContent}

Respond *only* with the JSON object, without any leading or trailing text or markdown backticks. Just the raw JSON object.`;

  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      response_mime_type: "application/json"
    }
  };

  const headers = {
    'Content-Type': 'application/json'
  };

  console.log('getGeminiMetadata: Calling Gemini API...');
  try {
    const apiResponse = await axios.post(endpointUrl, payload, { headers, timeout: 45000 }); // 45s timeout

    if (apiResponse.status === 200) {
      const data = apiResponse.data;
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) {
        const jsonTextResponse = data.candidates[0].content.parts[0].text;
        console.log('getGeminiMetadata: Received text from Gemini, attempting to parse as JSON.');
        try {
          return JSON.parse(jsonTextResponse);
        } catch (parseError) {
          console.error('getGeminiMetadata: Error parsing JSON from Gemini response:', parseError);
          console.error('getGeminiMetadata: Gemini raw text response was:', jsonTextResponse);
          return { error: 'Failed to parse JSON from Gemini API response text', details: jsonTextResponse };
        }
      } else {
        console.error('getGeminiMetadata: Unexpected Gemini API response structure:', data);
        return { error: 'Failed to extract JSON text from Gemini API response structure', details: data };
      }
    } else if (apiResponse.status === 429) {
      console.warn('getGeminiMetadata: Gemini API rate limit exceeded.');
      return { error: 'Gemini API rate limit exceeded', status_code: 429 };
    } else {
      console.error(`getGeminiMetadata: Gemini API request failed with status ${apiResponse.status}:`, apiResponse.data);
      return { error: 'Gemini API request failed', status_code: apiResponse.status, details: apiResponse.data };
    }
  } catch (error) {
    console.error('getGeminiMetadata: Gemini API request exception:', error.message);
    if (error.response) {
      console.error('getGeminiMetadata: Error response data:', error.response.data);
      console.error('getGeminiMetadata: Error response status:', error.response.status);
      return { error: 'Gemini API request exception', details: error.message, status: error.response.status, data: error.response.data };
    }
    return { error: 'Gemini API request exception', details: error.message };
  }
}

// --- Main SCORM Upload Route ---
app.post('/api/upload-scorm', upload.single('file'), async (req, res) => {
  console.log('Received /api/upload-scorm request');
  if (!req.file) {
    console.log('No file uploaded with the request.');
    return res.status(400).json({ error: "No file uploaded with the request." });
  }

  const uploadedFilePath = req.file.path; // Path where multer saved the file
  const originalFileName = req.file.originalname;
  console.log(`Uploaded file saved to: ${uploadedFilePath}, original name: ${originalFileName}`);

  const baseName = path.parse(originalFileName).name;
  const uniqueId = uuidv4();
  const extractDir = path.join(TEMP_UPLOADS_DIR, `${baseName}_${uniqueId}`);

  try {
    if (!existsSync(extractDir)) {
      await fs.mkdir(extractDir, { recursive: true });
      console.log(`Created extraction directory: ${extractDir}`);
    }

    console.log(`Extracting ZIP file from ${uploadedFilePath} to ${extractDir}`);
    const zip = new AdmZip(uploadedFilePath);
    zip.extractAllTo(extractDir, /*overwrite*/ true);
    console.log('ZIP file extracted successfully.');

    // Clean up the uploaded zip file from temp_uploads (multer's storage)
    try {
      await fs.unlink(uploadedFilePath);
      console.log(`Successfully deleted temporary zip file: ${uploadedFilePath}`);
    } catch (unlinkErr) {
      console.error(`Error deleting temporary zip file ${uploadedFilePath}:`, unlinkErr);
      // Non-fatal, continue processing
    }
    
    console.log('Parsing SCORM manifest...');
    const manifestData = await parseScormManifest(extractDir);

    const apiResponse = {
      message: "File uploaded and processed.",
      extracted_content_path: extractDir,
      manifest_parsing_status: manifestData.error ? "error" : "success",
    };

    if (manifestData.error) {
      console.error('Manifest parsing error:', manifestData.error);
      apiResponse.manifest_error_details = manifestData.error;
      apiResponse.processed_sco_ai_metadata = { status: "AI processing skipped due to manifest error" };
    } else {
      apiResponse.manifest_data = manifestData;
      console.log('Manifest parsed successfully:', manifestData);

      if (manifestData.scos && manifestData.scos.length > 0) {
        const firstScoToProcess = manifestData.scos[0]; // Process the first SCO
        console.log(`Attempting to process first SCO: ${JSON.stringify(firstScoToProcess)}`);

        apiResponse.processed_sco_title = firstScoToProcess.title || firstScoToProcess.identifier || 'Unknown SCO';
        apiResponse.processed_sco_href = firstScoToProcess.href;

        // Check if the SCO href points to an HTML file, ignoring query parameters
        if (firstScoToProcess.href && firstScoToProcess.href.split('?')[0].toLowerCase().endsWith('.html')) {
          const htmlFilePath = path.join(extractDir, firstScoToProcess.href.split('?')[0]);
          console.log(`Full path to HTML SCO: ${htmlFilePath}`);

          if (existsSync(htmlFilePath)) {
            const textExtractionResult = await extractTextFromHtml(htmlFilePath);

            if (typeof textExtractionResult === 'string') { // Success from extractTextFromHtml
              apiResponse.processed_sco_text_content = textExtractionResult.length > 500
                ? textExtractionResult.substring(0, 500) + "..."
                : textExtractionResult;
              
              if (textExtractionResult.trim()) {
                const geminiApiKey = process.env.GEMINI_API_KEY;
                if (geminiApiKey) {
                  console.log('GEMINI_API_KEY found, calling getGeminiMetadata...');
                  const metadata = await getGeminiMetadata(textExtractionResult, geminiApiKey);
                  apiResponse.processed_sco_ai_metadata = metadata;
                } else {
                  console.warn('GEMINI_API_KEY not found in environment variables.');
                  apiResponse.processed_sco_ai_metadata = { error: 'GEMINI_API_KEY not found in environment variables' };
                }
              } else {
                console.log('Extracted text content was empty, skipping AI metadata.');
                apiResponse.processed_sco_ai_metadata = { status: 'AI processing skipped due to empty text content' };
              }
            } else { // Error object from extractTextFromHtml
              console.error('Error extracting text from HTML:', textExtractionResult.error);
              apiResponse.processed_sco_text_error = textExtractionResult.error;
              apiResponse.processed_sco_ai_metadata = { status: 'AI processing skipped due to text extraction error' };
            }
          } else {
            console.warn(`HTML SCO file not found: ${htmlFilePath}`);
            apiResponse.processed_sco_text_error = `HTML file not found at path: ${htmlFilePath}`;
            apiResponse.processed_sco_ai_metadata = { status: 'AI processing skipped due to HTML file not found' };
          }
        } else {
          console.log('First SCO is not an HTML file or href is missing.');
          apiResponse.processed_sco_note = "First SCO is not an HTML file or href is missing.";
          apiResponse.processed_sco_ai_metadata = { status: 'AI processing skipped, first SCO not HTML or href missing' };
        }
      } else {
        console.log('No SCOs found in manifest to process.');
        apiResponse.processed_sco_note = "No processable SCOs found in manifest.";
        apiResponse.processed_sco_ai_metadata = { status: 'AI processing skipped due to no SCOs in manifest' };
      }
    }
    console.log('Sending final API response.');
    return res.status(200).json(apiResponse);

  } catch (error) {
    console.error('Critical error in /api/upload-scorm route:', error);
    // Ensure multer temporary file is cleaned up if it exists and an error occurs before manual deletion
    if (req.file && req.file.path && existsSync(req.file.path)) {
        try {
            await fs.unlink(req.file.path);
            console.log(`Cleaned up multer temp file due to error: ${req.file.path}`);
        } catch (cleanupErr) {
            console.error(`Error cleaning up multer temp file ${req.file.path}:`, cleanupErr);
        }
    }
    return res.status(500).json({ error: 'An unexpected server error occurred.', details: error.message });
  }
});


// --- Placeholder for other API routes (e.g., todos) ---
// You would typically move these to a separate file like backend/routes/todoRoutes.js
// For now, keeping the mock todos here for simplicity if not using apiRoutes import.
let todos = [
  { id: 1, title: "Learn Express", completed: false },
  { id: 2, title: "Learn React", completed: false },
  { id: 3, title: "Build Full-Stack App", completed: false }
];

app.get('/api/todos', (req, res) => {
  res.json(todos);
});

// (Add other todo routes: GET /api/todos/:id, POST /api/todos, PUT /api/todos/:id, DELETE /api/todos/:id if needed for PoC)


// --- Serve React Frontend (for production builds) ---
// This section should serve your 'dist' folder from the frontend build
const FRONTEND_DIST_DIR = path.join(__dirname, '../../src/dist'); // Adjust path if frontend is in 'src' and builds to 'src/dist'
                                                              // Or more commonly: path.join(__dirname, '../frontend/dist') if you have a separate frontend folder
                                                              // Or path.join(__dirname, '../dist') if your root package.json builds frontend to root 'dist'

if (existsSync(FRONTEND_DIST_DIR)) {
    app.use(express.static(FRONTEND_DIST_DIR));
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(FRONTEND_DIST_DIR, 'index.html'));
    });
    console.log(`Serving static files from: ${FRONTEND_DIST_DIR}`);
} else {
    console.warn(`Frontend build directory not found at: ${FRONTEND_DIST_DIR}. Ensure your frontend is built and the path is correct.`);
    // Fallback root route if frontend isn't built/served
    app.get('/', (req, res) => {
      res.send('SynapticX API Server is running. Frontend not found or not built.');
    });
}


// --- Error Handlers (Generic) ---
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large. Maximum file size is 200MB. Details: ${err.message}` });
  } else if (err) {
    console.error("Unhandled error caught by generic error handler:", err.stack);
    return res.status(500).json({ error: "An unexpected server error occurred.", details: err.message });
  }
  next();
});


// --- Start Server ---
app.listen(PORT, () => {
  console.log(`SynapticX Backend Server is running on port ${PORT}`);
  console.log(`Expecting GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'Found' : 'NOT FOUND (check .env file in project root)'}`);
});
