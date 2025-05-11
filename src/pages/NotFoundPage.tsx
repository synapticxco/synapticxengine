import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

const NotFoundPage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-6xl font-bold text-gray-800 mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-gray-700 mb-6">Page Not Found</h2>
      <p className="text-gray-600 mb-8 max-w-md">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link 
        to="/" 
        className="inline-flex items-center px-5 py-2 bg-blue-600 text-white font-medium rounded-md shadow-md hover:bg-blue-700 transition-colors duration-200"
      >
        <Home className="mr-2 h-5 w-5" />
        Return Home
      </Link>
    </div>
  );
};

export default NotFoundPage;