import React from 'react';
import { Todo } from '../../types/todo';
import { CheckCircle, Circle, Trash2 } from 'lucide-react';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}

const TodoItem: React.FC<TodoItemProps> = ({ todo, onToggle, onDelete }) => {
  return (
    <li 
      className={`
        flex items-center justify-between p-4 bg-white rounded-lg shadow-sm
        transition-all duration-200 hover:shadow-md
        ${todo.completed ? 'border-l-4 border-green-500' : 'border-l-4 border-blue-500'}
      `}
    >
      <div className="flex items-center">
        <button 
          onClick={() => onToggle(todo.id)}
          className="focus:outline-none"
          aria-label={todo.completed ? "Mark as incomplete" : "Mark as complete"}
        >
          {todo.completed ? (
            <CheckCircle className="h-6 w-6 text-green-500 mr-3" />
          ) : (
            <Circle className="h-6 w-6 text-blue-500 mr-3" />
          )}
        </button>
        <span 
          className={`
            text-gray-800 transition-all duration-200
            ${todo.completed ? 'line-through text-gray-500' : ''}
          `}
        >
          {todo.title}
        </span>
      </div>
      <button 
        onClick={() => onDelete(todo.id)} 
        className="text-red-500 hover:text-red-700 transition-colors duration-200 p-1 rounded-full hover:bg-red-50"
        aria-label="Delete todo"
      >
        <Trash2 className="h-5 w-5" />
      </button>
    </li>
  );
};

export default TodoItem;