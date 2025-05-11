from flask import Flask, jsonify, request
from flask_cors import CORS
import os
from dotenv import load_dotenv
import uuid
import zipfile
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
import requests
import json
from werkzeug.utils import secure_filename

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configure maximum file size (200MB)
app.config['MAX_CONTENT_LENGTH'] = 200 * 1024 * 1024

# Configure upload settings
TEMP_UPLOADS = 'temp_uploads'
ALLOWED_EXTENSIONS = {'zip'}

if not os.path.exists(TEMP_UPLOADS):
    os.makedirs(TEMP_UPLOADS, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def parse_scorm_manifest(extract_dir):
    try:
        manifest_path = os.path.join(extract_dir, 'imsmanifest.xml')
        
        if not os.path.exists(manifest_path):
            return {'error': 'Manifest file (imsmanifest.xml) not found in the package'}
            
        tree = ET.parse(manifest_path)
        root = tree.getroot()
        
        # Define common SCORM namespaces
        ns = {
            'adlcp': 'http://www.adlnet.org/xsd/adlcp_rootv1p2',
            'imscp': 'http://www.imsproject.org/xsd/imscp_rootv1p1p2',
        }
        
        # Extract course title
        course_title = 'Untitled Course'
        organizations = root.find('.//imscp:organizations', ns)
        if organizations is not None:
            organization = organizations.find('imscp:organization', ns)
            if organization is not None:
                title_elem = organization.find('imscp:title', ns)
                if title_elem is not None:
                    course_title = title_elem.text

        # Extract SCOs
        scos = []
        resources = root.find('.//imscp:resources', ns)
        if resources is not None:
            for resource in resources.findall('imscp:resource', ns):
                identifier = resource.get('identifier')
                href = resource.get('href')
                if identifier and href:
                    scos.append({
                        'identifier': identifier,
                        'href': href
                    })

        return {
            'course_title': course_title,
            'scos': scos
        }
        
    except ET.ParseError as e:
        return {'error': f'Failed to parse manifest XML: {str(e)}'}
    except Exception as e:
        return {'error': f'Error processing manifest: {str(e)}'}

@app.route('/api/upload-scorm', methods=['POST'])
def upload_scorm():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part in the request"}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400
        
        if not file.filename.lower().endswith('.zip'):
            return jsonify({"error": "Invalid file type, please upload a .zip file"}), 415
        
        if file:
            filename = secure_filename(file.filename)
            base_name = os.path.splitext(filename)[0]
            unique_id = str(uuid.uuid4())
            extract_dir = os.path.join(TEMP_UPLOADS, f"{base_name}_{unique_id}")
            
            os.makedirs(extract_dir, exist_ok=True)
            
            zip_path = os.path.join(TEMP_UPLOADS, filename)
            file.save(zip_path)
            
            try:
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(extract_dir)
            except zipfile.BadZipFile:
                os.remove(zip_path)
                return jsonify({"error": "Invalid or corrupted zip file"}), 400
            
            os.remove(zip_path)
            
            manifest_data = parse_scorm_manifest(extract_dir)
            
            response_data = {
                "message": "File uploaded and extracted successfully",
                "extracted_content_path": extract_dir,
                "manifest_parsing_status": "success" if 'error' not in manifest_data else "error",
            }
            
            if 'error' in manifest_data:
                response_data["manifest_error_details"] = manifest_data['error']
            else:
                response_data["manifest_data"] = manifest_data
            
            return jsonify(response_data), 200

    except Exception as e:
        app.logger.error(f"An unexpected error occurred in /upload-scorm: {str(e)}")
        return jsonify({"error": f"An unexpected server error occurred: {str(e)}"}), 500

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({"error": "File too large. Maximum file size is 200MB"}), 413

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)