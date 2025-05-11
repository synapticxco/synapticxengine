import React, { useState, useCallback } from 'react';
import { uploadScormPackage } from '../services/scormService';
import { FileUp, CheckCircle, AlertCircle, Loader, ChevronDown, ChevronUp, FileText } from 'lucide-react';

const ScormUploadTest = () => {
  const [file, setFile] = useState<File | null>(null);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showFullResponse, setShowFullResponse] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      validateAndSetFile(selectedFile);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    if (selectedFile.type === 'application/zip' || selectedFile.name.endsWith('.zip')) {
      if (selectedFile.size > 200 * 1024 * 1024) {
        setError('File is too large. Maximum file size is 200MB.');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResponse(null);
    } else {
      setError('Please upload a valid SCORM package (.zip file)');
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const response = await uploadScormPackage(file);
      setResponse(response);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'An error occurred');
      console.error('Upload error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">SCORM Package Uploader</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div 
          className={`border-2 border-dashed rounded-lg p-8 text-center mb-6 transition-all duration-200
            ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}
            ${error ? 'border-red-300' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center">
            <FileUp className="h-12 w-12 text-blue-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              {file ? file.name : 'Drag & Drop your SCORM package here'}
            </h3>
            <p className="text-gray-500 mb-4">
              {file 
                ? `${formatFileSize(file.size)} - ${file.type || 'application/zip'}`
                : 'or click to browse (max 200MB)'}
            </p>
            
            <input
              type="file"
              id="scorm-file"
              accept=".zip"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="scorm-file"
              className="px-4 py-2 bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700 transition-colors"
            >
              Select File
            </label>
          </div>
        </div>
        
        <button
          onClick={handleSubmit}
          disabled={!file || isLoading}
          className={`w-full py-3 px-4 rounded-md font-medium text-white flex items-center justify-center
            ${!file || isLoading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isLoading ? (
            <>
              <Loader className="animate-spin h-5 w-5 mr-2" />
              Uploading...
            </>
          ) : (
            'Upload SCORM Package'
          )}
        </button>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-md flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold text-red-800 mb-1">Error</h2>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      )}

      {response && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
            <h2 className="text-xl font-semibold text-gray-800">Upload Successful</h2>
          </div>
          
          {response.manifest_data && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Course: {response.manifest_data.course_title}
              </h3>
              
              {response.manifest_data.scos && response.manifest_data.scos.length > 0 ? (
                <div>
                  <h4 className="text-md font-medium text-gray-700 mb-2">SCOs ({response.manifest_data.scos.length}):</h4>
                  <div className="bg-gray-50 p-4 rounded-md max-h-60 overflow-y-auto">
                    <ul className="space-y-2">
                      {response.manifest_data.scos.map((sco: any, index: number) => (
                        <li key={index} className="p-2 hover:bg-gray-100 rounded flex items-start">
                          <FileText className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="font-medium">{sco.identifier}</div>
                            <div className="text-sm text-gray-500">{sco.href}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No SCOs found in the package</p>
              )}
            </div>
          )}
          
          {response.processed_sco_text_content && (
            <div className="mt-4">
              <h4 className="text-md font-medium text-gray-700 mb-2">Content Preview:</h4>
              <div className="bg-gray-50 p-4 rounded-md max-h-40 overflow-y-auto">
                <p className="text-sm text-gray-600">{response.processed_sco_text_content}</p>
              </div>
            </div>
          )}
          
          <div className="mt-6 pt-4 border-t border-gray-200">
            <button 
              onClick={() => setShowFullResponse(!showFullResponse)}
              className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
            >
              {showFullResponse ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Hide Full Response
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  View Full Response
                </>
              )}
            </button>
            
            {showFullResponse && (
              <pre className="mt-2 bg-gray-50 p-4 rounded-md overflow-x-auto text-xs">
                {JSON.stringify(response, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScormUploadTest;