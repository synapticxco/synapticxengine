import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const HomePage = () => {
  return (
    <div className="flex flex-col items-center">
      <section className="text-center max-w-4xl mx-auto mt-8 mb-16">
        <h1 className="text-4xl font-bold text-gray-800 mb-6">
          Welcome to Flask-React Full-Stack
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          A modern web application with Python Flask backend and React frontend
        </p>
        <Link 
          to="/todos" 
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-md shadow-md hover:bg-blue-700 transition-colors duration-200"
        >
          Try the Todo App
          <ArrowRight className="ml-2 h-5 w-5" />
        </Link>
      </section>

      <section className="w-full max-w-5xl mx-auto grid md:grid-cols-3 gap-8 mb-16">
        <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Flask Backend</h2>
          <p className="text-gray-600">
            Powered by Python Flask, providing a robust and scalable REST API for your application.
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">React Frontend</h2>
          <p className="text-gray-600">
            Modern React with TypeScript for type safety and better developer experience.
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Tailwind CSS</h2>
          <p className="text-gray-600">
            Beautiful, responsive design with the utility-first CSS framework.
          </p>
        </div>
      </section>
    </div>
  );
};

export default HomePage;