import React from 'react';
import { Todo } from '../../types/todo';
import TodoItem from './TodoItem';

interface TodoListProps {
  todos: Todo[];
  onToggleTodo: (id: number) => void;
  onDeleteTodo: (id: number) => void;
}

const TodoList: React.FC<TodoListProps> = ({ todos, onToggleTodo, onDeleteTodo }) => {
  if (todos.length === 0) {
    return (
      <div className="text-center py-8 bg-white rounded-lg shadow-sm">
        <p className="text-gray-500">No todos yet. Add a new one above!</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3 mt-6">
      {todos.map(todo => (
        <TodoItem 
          key={todo.id} 
          todo={todo} 
          onToggle={onToggleTodo} 
          onDelete={onDeleteTodo} 
        />
      ))}
    </ul>
  );
};

export default TodoList;