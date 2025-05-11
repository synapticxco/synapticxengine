import express from 'express';

const router = express.Router();

// Mock data for demo purposes
let todos = [
  {"id": 1, "title": "Learn Flask", "completed": false},
  {"id": 2, "title": "Learn React", "completed": false},
  {"id": 3, "title": "Build Full-Stack App", "completed": false}
];

// GET all todos
router.get('/todos', (req, res) => {
  res.json(todos);
});

// GET a specific todo
router.get('/todos/:id', (req, res) => {
  const todoId = parseInt(req.params.id);
  const todo = todos.find(t => t.id === todoId);
  
  if (todo) {
    res.json(todo);
  } else {
    res.status(404).json({"error": "Todo not found"});
  }
});

// POST a new todo
router.post('/todos', (req, res) => {
  if (!req.body || !req.body.title) {
    return res.status(400).json({"error": "Title is required"});
  }
  
  const newId = todos.length > 0 ? Math.max(...todos.map(t => t.id)) + 1 : 1;
  const newTodo = {
    "id": newId,
    "title": req.body.title,
    "completed": req.body.completed || false
  };
  
  todos.push(newTodo);
  res.status(201).json(newTodo);
});

// PUT (update) a todo
router.put('/todos/:id', (req, res) => {
  const todoId = parseInt(req.params.id);
  const todoIndex = todos.findIndex(t => t.id === todoId);
  
  if (todoIndex === -1) {
    return res.status(404).json({"error": "Todo not found"});
  }
  
  if (!req.body) {
    return res.status(400).json({"error": "No data provided"});
  }
  
  const updatedTodo = {
    ...todos[todoIndex],
    ...req.body,
    id: todoId // Ensure ID doesn't change
  };
  
  todos[todoIndex] = updatedTodo;
  res.json(updatedTodo);
});

// DELETE a todo
router.delete('/todos/:id', (req, res) => {
  const todoId = parseInt(req.params.id);
  const initialLength = todos.length;
  
  todos = todos.filter(t => t.id !== todoId);
  
  if (todos.length === initialLength) {
    return res.status(404).json({"error": "Todo not found"});
  }
  
  res.json({"result": true});
});

export default router;