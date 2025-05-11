import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import AdmZip from 'adm-zip';
import xml2js from 'xml2js';
import cors from 'cors';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tempUploadsDir = path.join(__dirname, 'temp_uploads');
    if (!fs.existsSync(tempUploadsDir)) {
      fs.mkdirSync(tempUploadsDir, { recursive: true });
    }
    cb(null, tempUploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit
  fileFilter: function (req, file, cb) {
    if (file.mimetype !== 'application/zip' && !file.originalname.endsWith('.zip')) {
      return cb(new Error('Invalid file type, please upload a .zip file'), false);
    }
    cb(null, true);
  }
});

// Function to parse SCORM manifest
function parseScormManifest(extractDir) {
  try {
    const manifestPath = path.join(extractDir, 'imsmanifest.xml');
    
    if (!fs.existsSync(manifestPath)) {
      return { error: 'Manifest file (imsmanifest.xml) not found in the package' };
    }
    
    const manifestXml = fs.readFileSync(manifestPath, 'utf8');
    let manifestData = {};
    
    // Parse XML synchronously
    const parser = new xml2js.Parser({ explicitArray: false });
    let result;
    
    parser.parseString(manifestXml, (err, parsed) => {
      if (err) {
        throw new Error(`Failed to parse manifest XML: ${err.message}`);
      }
      result = parsed;
    });
    
    if (!result) {
      throw new Error('Failed to parse manifest XML');
    }
    
    // Extract course title
    let courseTitle = 'Untitled Course';
    if (result.manifest && 
        result.manifest.organizations && 
        result.manifest.organizations.organization) {
      const org = Array.isArray(result.manifest.organizations.organization) 
        ? result.manifest.organizations.organization[0] 
        : result.manifest.organizations.organization;
      
      if (org.title) {
        courseTitle = org.title;
      }
    }
    
    // Extract SCOs
    const scos = [];
    if (result.manifest && 
        result.manifest.resources && 
        result.manifest.resources.resource) {
      const resources = Array.isArray(result.manifest.resources.resource) 
        ? result.manifest.resources.resource 
        : [result.manifest.resources.resource];
      
      resources.forEach(resource => {
        // Check if it's a SCO (has adlcp:scormType="sco")
        const scormType = resource['$'] && resource['$']['adlcp:scormType'];
        if (scormType === 'sco') {
          scos.push({
            identifier: resource['$'].identifier,
            href: resource['$'].href
          });
        }
      });
    }
    
    return {
      course_title: courseTitle,
      scos: scos
    };
  } catch (error) {
    return { error: `Error processing manifest: ${error.message}` };
  }
}

// Function to extract text from HTML
function extractTextFromHtml(htmlPath) {
  try {
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    // Simple regex to extract text (a more robust solution would use a proper HTML parser)
    const text = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text;
  } catch (error) {
    console.error(`Error extracting text from HTML: ${error.message}`);
    return null;
  }
}

// Root route handler
app.get('/', (req, res) => {
  res.send('SCORM API Server is running. Use /api/upload-scorm to upload SCORM packages.');
});

// Import API routes
import apiRoutes from './api/routes.js';

// Use API routes
app.use('/api', apiRoutes);

// SCORM upload endpoint
app.post('/api/upload-scorm', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file part in the request" });
    }
    
    const zipPath = req.file.path;
    const uniqueId = uuidv4();
    const extractDir = path.join(__dirname, 'temp_uploads', `${path.parse(req.file.originalname).name}_${uniqueId}`);
    
    // Create extraction directory
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }
    
    // Extract the zip file
    try {
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractDir, true);
    } catch (error) {
      fs.unlinkSync(zipPath); // Clean up the zip file
      return res.status(400).json({ error: "Invalid or corrupted zip file" });
    }
    
    // Clean up the zip file
    fs.unlinkSync(zipPath);
    
    // Parse the manifest
    const manifestData = parseScormManifest(extractDir);
    
    // Prepare response
    const response = {
      message: "File uploaded and extracted successfully",
      extracted_content_path: extractDir,
      manifest_parsing_status: manifestData.error ? "error" : "success",
      manifest_data: manifestData.error ? null : manifestData
    };
    
    // Process the first SCO if available
    if (!manifestData.error && manifestData.scos && manifestData.scos.length > 0) {
      const firstScoToProcess = manifestData.scos[0];
      console.log(`Processing first SCO: ${JSON.stringify(firstScoToProcess)}`);
      
      // Check if the SCO href is an HTML file (handling query parameters)
      if (firstScoToProcess.href.split('?')[0].toLowerCase().endsWith('.html')) {
        const htmlPath = path.join(extractDir, firstScoToProcess.href.split('?')[0]);
        console.log(`HTML path: ${htmlPath}`);
        
        // Check if the file exists
        if (fs.existsSync(htmlPath)) {
          try {
            // Extract text from HTML
            const textContent = extractTextFromHtml(htmlPath);
            
            if (textContent) {
              response.processed_sco_title = firstScoToProcess.identifier || 'Unknown';
              response.processed_sco_href = firstScoToProcess.href;
              response.processed_sco_text_content = textContent.length > 500 
                ? textContent.substring(0, 500) + "..." 
                : textContent;
            }
          } catch (error) {
            console.error(`Error processing HTML content: ${error.message}`);
            response.processing_error = `Error processing HTML content: ${error.message}`;
          }
        } else {
          response.processing_error = `HTML file not found at path: ${htmlPath}`;
        }
      } else {
        response.processing_note = "First SCO is not an HTML file";
      }
    } else {
      response.processing_note = "No processable SCOs found";
    }
    
    return res.status(200).json(response);
  } catch (error) {
    console.error(`An unexpected error occurred in /upload-scorm: ${error.message}`);
    return res.status(500).json({ error: `An unexpected server error occurred: ${error.message}` });
  }
});

// Error handler for file size limit
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: "File too large. Maximum file size is 200MB" });
  }
  next(err);
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});