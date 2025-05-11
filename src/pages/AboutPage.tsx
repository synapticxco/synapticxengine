import React from 'react';

const AboutPage = () => {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">About This Project</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Flask-React Full-Stack Application</h2>
        <p className="text-gray-600 mb-4">
          This is a full-stack web application built with Python Flask on the backend and React with TypeScript on the frontend.
          It demonstrates how to create a modern web application with a clear separation between frontend and backend concerns.
        </p>
        <p className="text-gray-600">
          The application includes features like state management, API integration, responsive design, and more.
        </p>
      </div>
      
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Tech Stack</h2>
      
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Backend</h3>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>Python Flask</li>
            <li>RESTful API design</li>
            <li>Flask Blueprints for modular routing</li>
            <li>Error handling</li>
            <li>CORS support</li>
          </ul>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Frontend</h3>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>React 18</li>
            <li>TypeScript</li>
            <li>React Router for navigation</li>
            <li>Tailwind CSS for styling</li>
            <li>Responsive design</li>
            <li>Lucide React for icons</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;