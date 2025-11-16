from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from agent import WritingAgent

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Initialize the writing agent
try:
    agent = WritingAgent()
    print("Writing agent initialized successfully")
except Exception as e:
    print(f"Failed to initialize writing agent: {e}")
    agent = None

@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "message": "AI Writing Assistant API is running"})

@app.route("/api/test", methods=["POST"])
def test():
    """Test endpoint to debug request format"""
    print("=== TEST ENDPOINT CALLED ===")
    print(f"Request method: {request.method}")
    print(f"Request content type: {request.content_type}")
    print(f"Request headers: {dict(request.headers)}")
    
    try:
        raw_data = request.get_data()
        print(f"Raw data: {raw_data}")
        
        data = request.get_json()
        print(f"Parsed JSON: {data}")
        
        return jsonify({
            "status": "success",
            "received_data": data,
            "message": "Test endpoint working"
        })
    except Exception as e:
        print(f"Test endpoint error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/chat", methods=["POST"])
def chat():
    """Main chat endpoint - processes user messages and returns AI response with project modifications"""
    print("=== CHAT ENDPOINT CALLED ===")
    
    try:
        # Debug: Log request details
        print(f"Request method: {request.method}")
        print(f"Request content type: {request.content_type}")
        print(f"Request headers: {dict(request.headers)}")
        
        # Get raw data first
        raw_data = request.get_data()
        print(f"Raw request data: {raw_data}")
        
        data = request.get_json()
        print(f"Parsed JSON data: {data}")
        
        if not data:
            print("ERROR: No data provided")
            return jsonify({"error": "No data provided"}), 400
        
        # Extract the user message
        user_input = data.get("userInput", "")
        print(f"User input received: '{user_input}'")
        print(f"User input type: {type(user_input)}")
        print(f"User input length: {len(user_input) if user_input else 'None'}")
        
        if not user_input:
            print("ERROR: No userInput provided")
            return jsonify({"error": "No userInput provided", "assistantReply": "Please provide a message."}), 400
        
        # Get the full project state
        project = data.get("currentProject", {})
        print(f"Project data: {project}")
        
        if not project:
            print("ERROR: No currentProject provided")
            return jsonify({"error": "No currentProject provided", "assistantReply": "Project data is required."}), 400
        
        # Check if agent is available
        if not agent:
            return jsonify({
                "error": "AI service not available", 
                "assistantReply": "The AI Writing Assistant service is not properly configured. Please contact your administrator."
            }), 500
        
        # Process the message using the agent
        print("Processing chat message with agent...")
        print(f"Passing to agent - user_input: '{user_input}', project keys: {list(project.keys()) if project else 'None'}")
        ai_response, modified_project = agent.process_chat_message(user_input, project)
        print(f"Agent returned - AI response: '{ai_response}'")
        print(f"Agent returned - Modified project keys: {list(modified_project.keys()) if modified_project else 'None'}")
        
        response_data = {
            "assistantReply": ai_response,
            "project": modified_project
        }
        
        print(f"Returning response: {response_data}")
        return jsonify(response_data)
        
    except Exception as e:
        print(f"ERROR in chat endpoint: {e}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

    

if __name__ == '__main__':
    app.run(debug=True, port=5002, host='0.0.0.0')