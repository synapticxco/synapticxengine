import React, { useState, useEffect } from 'react';
import TodoList from '../components/todos/TodoList';
import TodoForm from '../components/todos/TodoForm';
import { Todo } from '../types/todo';
import { getTodos, addTodo, updateTodo, deleteTodo } from '../services/todoService';

const TodosPage = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTodos = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getTodos();
        setTodos(data);
      } catch (err) {
        setError('Failed to fetch todos. Please try again later.');
        console.error('Error fetching todos:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTodos();
  }, []);

  const handleAddTodo = async (title: string) => {
    try {
      const newTodo = await addTodo(title);
      setTodos(prev => [...prev, newTodo]);
    } catch (err) {
      setError('Failed to add todo. Please try again.');
      console.error('Error adding todo:', err);
    }
  };

  const handleToggleTodo = async (id: number) => {
    try {
      const todoToUpdate = todos.find(todo => todo.id === id);
      if (!todoToUpdate) return;
      
      const updatedTodo = await updateTodo(id, {
        ...todoToUpdate,
        completed: !todoToUpdate.completed
      });
      
      setTodos(prev => prev.map(todo => 
        todo.id === id ? updatedTodo : todo
      ));
    } catch (err) {
      setError('Failed to update todo. Please try again.');
      console.error('Error updating todo:', err);
    }
  };

  const handleDeleteTodo = async (id: number) => {
    try {
      await deleteTodo(id);
      setTodos(prev => prev.filter(todo => todo.id !== id));
    } catch (err) {
      setError('Failed to delete todo. Please try again.');
      console.error('Error deleting todo:', err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Todo List</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
          <p>{error}</p>
        </div>
      )}
      
      <TodoForm onAddTodo={handleAddTodo} />
      
      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <TodoList 
          todos={todos} 
          onToggleTodo={handleToggleTodo} 
          onDeleteTodo={handleDeleteTodo} 
        />
      )}
    </div>
  );
};

export default TodosPage;