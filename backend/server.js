import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises'; // Using promises version of fs for async operations
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'fs'; // For some sync operations
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
  console.log(`Created temporary uploads directory: ${TEMP_UPLOADS_DIR}`);
}

// Configure multer storage to save files temporarily
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, TEMP_UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    // Use a unique name to avoid conflicts, but keep original extension for inspection
    cb(null, `${uuidv4()}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'application/zip' || file.originalname.toLowerCase().endsWith('.zip')) {
      cb(null, true); // Accept the file
    } else {
      console.log(`File rejected: Invalid type - ${file.originalname}, mimetype: ${file.mimetype}`);
      cb(new Error('Invalid file type, please upload a .zip file for SCORM packages.'), false); // Reject the file
    }
  }
});

// --- Helper Functions ---

async function parseScormManifest(extractDirPath) {
  const manifestPath = path.join(extractDirPath, 'imsmanifest.xml');
  console.log(`Attempting to parse manifest at: ${manifestPath}`);
  try {
    if (!existsSync(manifestPath)) {
      console.error(`Manifest file not found at: ${manifestPath}`);
      return { error: 'Manifest file (imsmanifest.xml) not found in the package.' };
    }

    const xmlContent = await fs.readFile(manifestPath, 'utf-8');
    // explicitRoot: true ensures the root tag 'manifest' is part of the result object
    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false, mergeAttrs: true, explicitRoot: true });
    const result = await parser.parseStringPromise(xmlContent);

    if (!result || !result.manifest) {
      console.error('Invalid manifest structure: <manifest> root element not found.');
      return { error: 'Invalid manifest structure: <manifest> root element not found.' };
    }
    const manifest = result.manifest;

    let courseTitle = 'Untitled Course';
    // Try to find title in organizations -> organization -> title
    if (manifest.organizations && manifest.organizations.organization) {
      const org = Array.isArray(manifest.organizations.organization) ? manifest.organizations.organization[0] : manifest.organizations.organization;
      if (org && org.title) {
        // xml2js with explicitArray: false often makes single text nodes direct properties
        // If title is an object like { _: "Title Text" } due to attributes on title, access with ._
        courseTitle = typeof org.title === 'string' ? org.title : (org.title._ || 'Untitled Organization');
      }
    }

    const scos = [];
    const resources = manifest.resources && manifest.resources.resource ?
                      (Array.isArray(manifest.resources.resource) ? manifest.resources.resource : [manifest.resources.resource])
                      : [];

    const items = [];
    // Helper function to recursively collect all items
    const collectAllItems = (itemElement) => {
        if (!itemElement) return;
        const currentItems = Array.isArray(itemElement) ? itemElement : [itemElement];
        currentItems.forEach(it => {
            if (it) { // Ensure item itself is not null/undefined
                items.push(it);
                if (it.item) { // Recursively collect sub-items
                    collectAllItems(it.item);
                }
            }
        });
    };
    
    if (manifest.organizations && manifest.organizations.organization) {
        const org = Array.isArray(manifest.organizations.organization) ? manifest.organizations.organization[0] : manifest.organizations.organization;
        if (org && org.item) {
            collectAllItems(org.item);
        }
    }
    
    const resourceMap = new Map();
    resources.forEach(res => {
        // Attributes are typically under '$' when mergeAttrs is false, or directly if mergeAttrs is true
        // With mergeAttrs: true, res.identifier should work if identifier is an attribute
        if (res.identifier && res.href) {
            resourceMap.set(res.identifier, res.href);
        }
    });

    items.forEach(item => {
        // item.identifierref should be directly accessible if mergeAttrs: true
        if (item.identifierref && resourceMap.has(item.identifierref)) {
            const resourceDetails = resources.find(r => r.identifier === item.identifierref);
            // Check for SCORM type 'sco', often namespaced with adlcp or similar
            // With mergeAttrs: true, attributes like 'adlcp:scormtype' become object keys
            const scormType = resourceDetails ? (resourceDetails['adlcp:scormtype'] || resourceDetails.scormtype) : null;

            if (scormType === 'sco') {
                let scoTitle = 'Untitled SCO';
                if (item.title && typeof item.title === 'string') {
                    scoTitle = item.title;
                } else if (item.title && item.title._) { // Handle cases where title is an object like {"_": "Title text"}
                     scoTitle = item.title._;
                } else if (item.identifier) { // Fallback to item identifier if available
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
    console.log(`Manifest parsed. Course Title: "${courseTitle}", SCOs found: ${scos.length}`);
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
  console.log(`Attempting to extract text from HTML: ${htmlFilePath}`);
  try {
    if (!existsSync(htmlFilePath)) {
      console.warn(`extractTextFromHtml: HTML file not found at path: ${htmlFilePath}`);
      return { error: `HTML file not found at path: ${htmlFilePath}` };
    }
    
    const htmlContent = await fs.readFile(htmlFilePath, 'utf-8');
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    // Remove script, style, and other non-visible elements
    document.querySelectorAll('script, style, noscript, iframe, head, link, meta').forEach(el => el.remove());

    let text = '';
    if (document.body) {
        text = document.body.textContent || "";
    }
    
    // Replace multiple whitespace characters (including newlines, tabs) with a single space and trim
    const cleanedText = text.replace(/\s\s+/g, ' ').trim();
    
    console.log(`extractTextFromHtml: Extracted ${cleanedText.length} characters from ${htmlFilePath}. Preview: "${cleanedText.substring(0,100)}..."`);
    return cleanedText; // Return text string directly on success

  } catch (error) {
    console.error(`Error extracting text from HTML file ${htmlFilePath}:`, error);
    return { error: `Error extracting text from HTML: ${error.message}` };
  }
}

async function getGeminiMetadata(textContent, apiKey) {
  if (!textContent || typeof textContent !== 'string' || !textContent.trim()) {
    console.warn('getGeminiMetadata: Text content is empty or invalid, skipping Gemini API call.');
    return { error: 'Text content is empty or invalid, skipping Gemini API call.' };
  }
  if (!apiKey) {
    console.error('getGeminiMetadata: Gemini API key is missing. Cannot make API call.');
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
      // Robustly try to get to the text part that contains our JSON
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) {
        const jsonTextResponse = data.candidates[0].content.parts[0].text;
        console.log('getGeminiMetadata: Received text from Gemini, attempting to parse as JSON.');
        try {
          const parsedJson = JSON.parse(jsonTextResponse);
          console.log('getGeminiMetadata: Successfully parsed JSON from Gemini.');
          return parsedJson;
        } catch (parseError) {
          console.error('getGeminiMetadata: Error parsing JSON from Gemini response text:', parseError);
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
    if (error.response) { // Axios wraps HTTP errors in error.response
      console.error('getGeminiMetadata: Error response data:', error.response.data);
      console.error('getGeminiMetadata: Error response status:', error.response.status);
      return { error: 'Gemini API request exception', details: error.message, status: error.response.status, data: error.response.data };
    }
    return { error: 'Gemini API request exception', details: error.message };
  }
}

// --- Main SCORM Upload Route ---
// This route should be defined under /api/ as per your apiRoutes import,
// or if apiRoutes.js doesn't exist or define it, it should be app.post('/api/upload-scorm', ...)
// For now, assuming it's directly on app for simplicity if apiRoutes is not yet set up.
app.post('/api/upload-scorm', upload.single('file'), async (req, res) => {
  console.log(`Received request for /api/upload-scorm. File: ${req.file ? req.file.originalname : 'No file'}`);
  if (!req.file) {
    console.log('No file uploaded with the request.');
    return res.status(400).json({ error: "No file uploaded with the request." });
  }

  const uploadedFilePath = req.file.path; // Path where multer saved the file
  const originalFileName = req.file.originalname;
  console.log(`Uploaded file saved to: ${uploadedFilePath}, original name: ${originalFileName}`);

  const baseName = path.parse(originalFileName).name;
  const uniqueId = uuidv4();
  // Ensure extractDir is within TEMP_UPLOADS_DIR which is already joined with __dirname
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
    
    console.log('Parsing SCORM manifest...');
    const manifestData = await parseScormManifest(extractDir);

    const apiResponse = {
      message: "File uploaded and processed.",
      extracted_content_path: extractDir, // For debugging, can be removed in production
      manifest_parsing_status: manifestData.error ? "error" : "success",
    };

    if (manifestData.error) {
      console.error('Manifest parsing error:', manifestData.error);
      apiResponse.manifest_error_details = manifestData.error;
      apiResponse.processed_sco_ai_metadata = { status: "AI processing skipped due to manifest error" };
    } else {
      apiResponse.manifest_data = manifestData;
      console.log('Manifest parsed successfully.');

      if (manifestData.scos && manifestData.scos.length > 0) {
        const firstScoToProcess = manifestData.scos[0]; // Process the first SCO
        console.log(`Attempting to process first SCO: Title: "${firstScoToProcess.title}", Href: "${firstScoToProcess.href}"`);

        apiResponse.processed_sco_title = firstScoToProcess.title || firstScoToProcess.identifier || 'Unknown SCO';
        apiResponse.processed_sco_href = firstScoToProcess.href;

        // Check if the SCO href points to an HTML file, ignoring query parameters
        if (firstScoToProcess.href && typeof firstScoToProcess.href === 'string' && firstScoToProcess.href.split('?')[0].toLowerCase().endsWith('.html')) {
          const htmlFileRelativePath = firstScoToProcess.href.split('?')[0]; // Path relative to SCORM root
          const htmlFilePath = path.join(extractDir, htmlFileRelativePath);
          console.log(`Full path to HTML SCO for text extraction: ${htmlFilePath}`);

          if (existsSync(htmlFilePath)) {
            const textExtractionResult = await extractTextFromHtml(htmlFilePath);

            // extractTextFromHtml returns a string on success, or an object with an error key on failure
            if (typeof textExtractionResult === 'string') { 
              apiResponse.processed_sco_text_content = textExtractionResult.length > 500
                ? textExtractionResult.substring(0, 500) + "..."
                : textExtractionResult;
              
              if (textExtractionResult.trim()) { // Only call Gemini if there's actual text
                const geminiApiKey = process.env.GEMINI_API_KEY;
                if (geminiApiKey) {
                  console.log('GEMINI_API_KEY found, calling getGeminiMetadata with extracted text...');
                  const metadata = await getGeminiMetadata(textExtractionResult, geminiApiKey);
                  apiResponse.processed_sco_ai_metadata = metadata;
                } else {
                  console.warn('GEMINI_API_KEY not found in environment variables.');
                  apiResponse.processed_sco_ai_metadata = { error: 'GEMINI_API_KEY not found in environment variables' };
                }
              } else {
                console.log('Extracted text content was empty, skipping AI metadata.');
                apiResponse.processed_sco_text_content = ""; // Ensure it's set even if empty
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
          console.log('First SCO is not an HTML file or href is missing/invalid.');
          apiResponse.processed_sco_note = "First SCO is not an HTML file or href is missing/invalid.";
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
            await fs.unlink(req.file.path); // Use async unlink
            console.log(`Cleaned up multer temp file due to error: ${req.file.path}`);
        } catch (cleanupErr) {
            console.error(`Error cleaning up multer temp file ${req.file.path}:`, cleanupErr);
        }
    }
    return res.status(500).json({ error: 'An unexpected server error occurred.', details: error.message });
  } finally {
    // Clean up the uploaded zip file from multer's temp storage if it still exists
    // This is a fallback, as it should be deleted after successful extraction or in the catch block for the main try
    if (req.file && req.file.path && existsSync(req.file.path)) {
        try {
            await fs.unlink(req.file.path);
            console.log(`Ensured cleanup of multer temp file: ${req.file.path}`);
        } catch (finalCleanupErr) {
            console.error(`Error in final cleanup of multer temp file ${req.file.path}:`, finalCleanupErr);
        }
    }
  }
});


// --- Example API routes (e.g., for todos) ---
// These would typically be in backend/routes/todoRoutes.js and imported
let todos = [
  { id: 1, title: "Learn Express", completed: false },
  { id: 2, title: "Learn React", completed: false },
  { id: 3, title: "Build Full-Stack App", completed: false }
];

app.get('/api/todos', (req, res) => {
  res.json(todos);
});

// Add other todo routes (GET /api/todos/:id, POST /api/todos, PUT /api/todos/:id, DELETE /api/todos/:id)
// if you plan to use them for the PoC.


// --- Serve React Frontend (for production builds) ---
// Adjust this path based on your actual frontend build output structure
// If your root package.json builds the frontend into a 'dist' folder at the project root:
const FRONTEND_DIST_DIR = path.join(__dirname, '../dist'); 
// If your frontend is in 'src' and builds into 'src/dist' (relative to project root):
// const FRONTEND_DIST_DIR = path.join(__dirname, '../src/dist'); // More likely if src is frontend root

if (existsSync(FRONTEND_DIST_DIR)) {
    app.use(express.static(FRONTEND_DIST_DIR));
    // Serves the index.html for any routes not handled by the API, enabling client-side routing
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(FRONTEND_DIST_DIR, 'index.html'));
    });
    console.log(`Serving static files from: ${FRONTEND_DIST_DIR}`);
} else {
    console.warn(`Frontend build directory not found at: ${FRONTEND_DIST_DIR}.`);
    console.warn(`Current __dirname (for backend/server.js) is: ${__dirname}`);
    // Fallback root route if frontend isn't built/served
    app.get('/', (req, res) => {
      res.send('SynapticX API Server is running. Frontend not found or not built. Access API at /api/upload-scorm (POST).');
    });
}


// --- Error Handlers (Generic) ---
// This should be placed after all route definitions and app.use(express.static...)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    console.error('File size limit exceeded:', err.message);
    return res.status(413).json({ error: `File too large. Maximum file size is 200MB. Details: ${err.message}` });
  } else if (err) { 
    console.error("Unhandled error caught by generic error handler:", err.stack || err.message);
    // Avoid sending detailed stack in production, but helpful for PoC
    return res.status(500).json({ error: "An unexpected server error occurred.", details: err.message });
  }
  // If no error, but route not found by this point, it will be handled by the '*' route if frontend is served,
  // or will result in a 404 if not.
  next(); 
});


// --- Start Server ---
app.listen(PORT, () => {
  console.log(`SynapticX Backend Server is running on port ${PORT}`);
  console.log(`To test, POST a SCORM .zip file to /api/upload-scorm`);
  console.log(`Expecting GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'Found and loaded!' : 'NOT FOUND (check .env file in project root and ensure server was restarted after creating/modifying it!)'}`);
});
