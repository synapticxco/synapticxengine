# Flask-React Full-Stack Application

A modern web application with Python Flask backend and React frontend. This project demonstrates how to structure and build a full-stack application with a clear separation between frontend and backend concerns.

## Features

- Flask backend with RESTful API
- React frontend with TypeScript
- React Router for navigation
- Todo list application with CRUD operations
- Responsive design with Tailwind CSS
- State management with React hooks

## Project Structure

```
flask-react-fullstack/
├── backend/               # Flask backend
│   ├── api/               # API routes
│   │   ├── __init__.py
│   │   └── routes.py      # API endpoints
│   ├── app.py             # Flask application
│   ├── config.py          # Configuration
│   └── requirements.txt   # Python dependencies
├── public/                # Static assets
├── src/                   # React frontend
│   ├── components/        # Reusable components
│   │   ├── layout/        # Layout components
│   │   └── todos/         # Todo-specific components
│   ├── pages/             # Page components
│   ├── services/          # API services
│   ├── types/             # TypeScript types
│   ├── App.tsx            # Main App component
│   └── main.tsx           # Entry point
├── index.html             # HTML template
└── package.json           # Project dependencies
```

## Getting Started

### Prerequisites

- Node.js (v14+)
- Python (v3.8+)
- npm or yarn

### Installation

1. Clone the repository
2. Install frontend dependencies:
   ```
   npm install
   ```
3. Install backend dependencies:
   ```
   cd backend
   pip install -r requirements.txt
   ```

### Running the Application

To run both the backend and frontend concurrently:

```
npm start
```

Or separately:

1. Start the Flask backend:
   ```
   npm run start-api
   ```
2. Start the React frontend:
   ```
   npm run dev
   ```

## Development

- Frontend will run on http://localhost:5173
- Backend API will run on http://localhost:5000