import os
import json
from typing import Dict, List, Any, Optional
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.tools import BaseTool
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from pydantic import BaseModel, Field

# Import agent creation and executor for LangChain 0.2.0+
# These should be available in the main agents module
from langchain.agents import create_openai_tools_agent, AgentExecutor


class AddIdeaInput(BaseModel):
    """Input for adding an idea to the brainstorm list."""
    idea: str = Field(description="The idea to add to the brainstorm list")


class AddCommentInput(BaseModel):
    """Input for adding a comment to the quill editor content."""
    content: str = Field(description="The quill editor content with HTML comment attributes added")
    comment_text: str = Field(description="The comment text to add")


class AddIdeaTool(BaseTool):
    """Tool for adding ideas to the brainstorm list."""
    name: str = "add_idea"
    description: str = "Add a new idea to the brainstorm list when user mentions one."
    args_schema: type = AddIdeaInput

    def _run(self, idea: str) -> str:
        """Add an idea to the brainstorm list."""
        return f"Added idea: {idea}"


class AddCommentTool(BaseTool):
    """Tool for adding comments to quill editor content."""
    name: str = "add_comment"
    description: str = "Add a comment or suggestion to the written content."
    args_schema: type = AddCommentInput

    def _run(self, content: str, comment_text: str) -> str:
        """Add a comment to the quill editor content."""
        return f"Added comment: {comment_text}"


class WritingAgent:
    """LangChain-based writing agent with phase-specific system prompts and tools."""
    
    def __init__(self):
        """Initialize the writing agent with OpenAI model and tools."""
        self.llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0.7,
            api_key=os.getenv("OPENAI_API_KEY")
        )
        
        # Initialize tools
        self.tools = [AddIdeaTool(), AddCommentTool()]
        
        # System prompts for each phase
        self.system_prompts = {
            "plan_organize": """You are a helpful writing assistant in the Plan & Organize phase. Keep responses short and conversational.

**Your role:**
- Help brainstorm ideas
- Organize thoughts
- Create outlines
- Suggest when ready to write

**Response style:**
- Use structured format with numbered lists when providing multiple items (1. **Item** - explanation)
- Use **bold** formatting for emphasis on key terms, phrases, or important points
- When including examples, use "**Example:**" or "Example:" in plain text (NOT as a heading with ###)
- Do NOT use markdown headings (###, ##, #) - use plain text with bold formatting instead
- Be concise but clear
- Use casual, friendly tone
- Ask direct questions
- Give quick suggestions
- Include examples when helpful

**When to suggest moving to Write phase:**
- Clear outline exists
- Main ideas identified
- User feels ready

**When to revisit this phase:**
- Ideas scattered
- Need better organization""",

            "write": """You are a helpful writing assistant in the Write phase. Keep responses short and conversational.

**Your role:**
- Help develop content
- Maintain focus on outline
- Provide writing support
- Encourage progress

**Response style:**
- Use structured format with numbered lists when providing multiple items (1. **Item** - explanation)
- Use **bold** formatting for emphasis on key terms, phrases, transition words, or important points
- When including examples, use "**Example:**" or "Example:" in plain text (NOT as a heading with ###)
- Do NOT use markdown headings (###, ##, #) - use plain text with bold formatting instead
- Be concise but clear
- Use casual, friendly tone
- Give quick writing tips
- Stay encouraging
- Include examples when helpful

**When to suggest moving to Edit phase:**
- First draft complete
- All sections written
- Ready for revision

**When to revisit Plan phase:**
- Structure issues
- Need better organization""",

            "edit_revise": """You are a helpful writing assistant in the Edit & Revise phase. Keep responses short and conversational.

**Your role:**
- Review content
- Suggest improvements
- Check clarity
- Polish writing

**Response style:**
- Use structured format with numbered lists when providing multiple items (1. **Item** - explanation)
- Use **bold** formatting for emphasis on key terms, phrases, or important points
- When including examples, use "**Example:**" or "Example:" in plain text (NOT as a heading with ###)
- Do NOT use markdown headings (###, ##, #) - use plain text with bold formatting instead
- Be concise but clear
- Use casual, friendly tone
- Give specific feedback
- Stay constructive
- Include examples when helpful

**When work is complete:**
- Content clear and organized
- Major issues addressed
- Ready for submission

**When to revisit Write phase:**
- Major gaps found
- Significant rewriting needed"""
        }
        
        # Create agent executors for each phase
        self.agents = {}
        for phase, system_prompt in self.system_prompts.items():
            self.agents[phase] = self._create_agent(phase, system_prompt)
    
    def _create_agent(self, phase: str, system_prompt: str) -> AgentExecutor:
        """Create an agent executor for a specific phase."""
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder("agent_scratchpad")
        ])
        
        agent = create_openai_tools_agent(self.llm, self.tools, prompt)
        return AgentExecutor(agent=agent, tools=self.tools, verbose=True)
    
    def _extract_chat_history(self, project: Dict[str, Any]) -> List:
        """Extract chat history from project JSON and convert to LangChain messages."""
        chat_history = []
        
        # Get chat history from project
        if "chatHistory" in project and project["chatHistory"]:
            for message in project["chatHistory"]:
                if message.get("role") == "user":
                    chat_history.append(HumanMessage(content=message.get("content", "")))
                elif message.get("role") == "assistant":
                    chat_history.append(AIMessage(content=message.get("content", "")))
        
        return chat_history
    
    def _get_current_phase(self, project: Dict[str, Any]) -> str:
        """Determine the current phase based on project state."""
        # Default to plan_organize if no phase is specified
        current_phase = project.get("currentPhase", "plan_organize")
        
        # Validate phase
        if current_phase not in self.system_prompts:
            current_phase = "plan_organize"
        
        return current_phase
    
    def _create_project_context(self, project: Dict[str, Any]) -> str:
        """Create context string from project data (excluding chat history)."""
        context_parts = []
        
        # Add project title if available
        if "title" in project and project["title"]:
            context_parts.append(f"Project Title: {project['title']}")
        
        # Add project description if available
        if "description" in project and project["description"]:
            context_parts.append(f"Project Description: {project['description']}")
        
        # Add brainstorm ideas if available
        if "brainstormIdeas" in project and project["brainstormIdeas"]:
            ideas = project["brainstormIdeas"]
            if isinstance(ideas, list) and ideas:
                context_parts.append(f"Current Brainstorm Ideas: {', '.join(ideas)}")
        
        # Add outline if available
        if "outline" in project and project["outline"]:
            context_parts.append(f"Current Outline: {project['outline']}")
        
        # Add written content if available
        if "content" in project and project["content"]:
            content = project["content"]
            # Truncate very long content for context
            if len(content) > 1000:
                content = content[:1000] + "..."
            context_parts.append(f"Current Content: {content}")
        
        # Add current phase
        current_phase = self._get_current_phase(project)
        context_parts.append(f"Current Phase: {current_phase.replace('_', ' ').title()}")
        
        return "\n".join(context_parts) if context_parts else "No additional context available."
    
    def _create_full_project_context(self, project: Dict[str, Any]) -> str:
        """Create full project context including all JSON schema data."""
        import json
        
        # Create a clean copy of the project for context (excluding chat history to avoid duplication)
        context_project = project.copy()
        if "chatHistory" in context_project:
            del context_project["chatHistory"]
        
        # Format the full project state as JSON for the agent
        try:
            project_json = json.dumps(context_project, indent=2)
            return f"Complete Project State (JSON):\n{project_json}"
        except Exception as e:
            # Fallback to the basic context if JSON serialization fails
            return self._create_project_context(project)
    
    def _apply_tool_calls_to_project(self, project: Dict[str, Any], agent_result: Dict[str, Any]) -> Dict[str, Any]:
        """Apply tool call results to the project and return modified project."""
        modified_project = project.copy()
        
        # Check if the agent used any tools
        if "intermediate_steps" in agent_result:
            for step in agent_result["intermediate_steps"]:
                if isinstance(step, tuple) and len(step) >= 2:
                    action, observation = step[0], step[1]
                    
                    # Handle AddIdeaTool
                    if hasattr(action, 'tool') and action.tool == "add_idea":
                        idea = action.tool_input.get("idea", "")
                        if idea:
                            # Initialize brainstorm ideas if not present
                            if "plan" not in modified_project:
                                modified_project["plan"] = {}
                            if "ideas" not in modified_project["plan"]:
                                modified_project["plan"]["ideas"] = []
                            
                            # Add the new idea
                            new_idea = {
                                "id": f"ai_idea_{len(modified_project['plan']['ideas']) + 1}",
                                "content": idea,
                                "location": "brainstorm",
                                "aiGenerated": True
                            }
                            modified_project["plan"]["ideas"].append(new_idea)
                    
                    # Handle AddCommentTool
                    elif hasattr(action, 'tool') and action.tool == "add_comment":
                        content = action.tool_input.get("content", "")
                        comment_text = action.tool_input.get("comment_text", "")
                        if content and comment_text:
                            # Initialize edit suggestions if not present
                            if "edit" not in modified_project:
                                modified_project["edit"] = {}
                            if "suggestions" not in modified_project["edit"]:
                                modified_project["edit"]["suggestions"] = []
                            
                            # Add the comment as a suggestion
                            new_suggestion = {
                                "id": f"ai_comment_{len(modified_project['edit']['suggestions']) + 1}",
                                "content": comment_text,
                                "type": "comment",
                                "aiGenerated": True
                            }
                            modified_project["edit"]["suggestions"].append(new_suggestion)
        
        return modified_project
    
    def process_chat_message(self, user_input: str, project: Dict[str, Any]) -> tuple[str, Dict[str, Any]]:
        """Process a chat message and return AI response with modified project."""
        try:
            # Extract chat history
            chat_history = self._extract_chat_history(project)
            
            # Get current phase
            current_phase = self._get_current_phase(project)
            
            # Create project context with full JSON schema
            project_context = self._create_full_project_context(project)
            
            # Prepare input with full context and response style instruction
            full_input = f"""Full Project State:\n{project_context}\n\nUser Message: {user_input}

IMPORTANT: When providing lists or multiple items, use numbered format (1. **Item** - explanation). Use **bold** formatting for emphasis on key terms, phrases, or important points. When including examples, use "**Example:**" in plain text (NOT as a heading with ###). Do NOT use markdown headings (###, ##, #). Keep responses concise and conversational. Use a casual, friendly tone like you're texting a friend."""
            
            # Get the appropriate agent
            agent = self.agents[current_phase]
            
            # Run the agent
            result = agent.invoke({
                "input": full_input,
                "chat_history": chat_history
            })
            
            # Extract AI response
            ai_response = result.get("output", "I'm sorry, I couldn't process your request.")
            
            # Create modified project by applying tool call results
            modified_project = self._apply_tool_calls_to_project(project, result)
            
            # Add the new message to chat history
            if "chatHistory" not in modified_project:
                modified_project["chatHistory"] = []
            
            # Only add the assistant's response (frontend should add user message)
            modified_project["chatHistory"].append({
                "role": "assistant", 
                "content": ai_response
            })
            
            return ai_response, modified_project
            
        except Exception as e:
            error_message = f"I encountered an error while processing your request: {str(e)}"
            return error_message, project
