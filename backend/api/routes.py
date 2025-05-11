from flask import Blueprint, jsonify, request

api_bp = Blueprint('api', __name__)

# Mock data for demo purposes
todos = [
    {"id": 1, "title": "Learn Flask", "completed": False},
    {"id": 2, "title": "Learn React", "completed": False},
    {"id": 3, "title": "Build Full-Stack App", "completed": False}
]

@api_bp.route('/todos', methods=['GET'])
def get_todos():
    return jsonify(todos)

@api_bp.route('/todos/<int:todo_id>', methods=['GET'])
def get_todo(todo_id):
    todo = next((todo for todo in todos if todo["id"] == todo_id), None)
    if todo:
        return jsonify(todo)
    return jsonify({"error": "Todo not found"}), 404

@api_bp.route('/todos', methods=['POST'])
def create_todo():
    if not request.json or 'title' not in request.json:
        return jsonify({"error": "Title is required"}), 400
    
    new_id = max(todo["id"] for todo in todos) + 1 if todos else 1
    new_todo = {
        "id": new_id,
        "title": request.json["title"],
        "completed": request.json.get("completed", False)
    }
    todos.append(new_todo)
    return jsonify(new_todo), 201

@api_bp.route('/todos/<int:todo_id>', methods=['PUT'])
def update_todo(todo_id):
    todo = next((todo for todo in todos if todo["id"] == todo_id), None)
    if not todo:
        return jsonify({"error": "Todo not found"}), 404
    
    if not request.json:
        return jsonify({"error": "No data provided"}), 400
    
    todo["title"] = request.json.get("title", todo["title"])
    todo["completed"] = request.json.get("completed", todo["completed"])
    return jsonify(todo)

@api_bp.route('/todos/<int:todo_id>', methods=['DELETE'])
def delete_todo(todo_id):
    global todos
    todo = next((todo for todo in todos if todo["id"] == todo_id), None)
    if not todo:
        return jsonify({"error": "Todo not found"}), 404
    
    todos = [todo for todo in todos if todo["id"] != todo_id]
    return jsonify({"result": True})