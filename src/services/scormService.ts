import axios from 'axios';

export const uploadScormPackage = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const config = {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    timeout: 300000, // Increased timeout to 5 minutes for large files
    maxContentLength: 210 * 1024 * 1024, // 210MB max
    maxBodyLength: 210 * 1024 * 1024 // 210MB max
  };

  try {
    const response = await axios.post('/api/upload-scorm', formData, config);
    return response.data;
  } catch (error: any) {
    console.error('SCORM Upload Error:', error);

    if (error.response) {
      const statusCode = error.response.status;
      const errorMessage = error.response.data?.error || error.response.data?.message || 'Unknown server error';
      
      if (statusCode === 413) {
        throw new Error('File is too large. Maximum file size is 200MB.');
      } else if (statusCode === 415) {
        throw new Error('Invalid file type. Please upload a valid SCORM package (.zip).');
      } else if (statusCode === 401) {
        throw new Error('Unauthorized. Please log in and try again.');
      } else {
        throw new Error(`Upload failed: ${errorMessage}`);
      }
    } else if (error.request) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Upload timed out. The file might be too large or the connection is slow.');
      } else {
        throw new Error('No response from server. Please check your connection and try again.');
      }
    } else {
      throw new Error('An unexpected error occurred during upload. Please try again.');
    }
  }
};