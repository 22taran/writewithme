# 📤 Full Sample Request to Backend API

## 🎯 **Request Details:**

### **Endpoint:**
```
POST {API_ENDPOINT}/api/chat
```

### **Headers:**
```http
Content-Type: application/json
```

### **Request Body Structure:**
```json
{
  "userInput": "Help me brainstorm AI project ideas",
  "currentProject": {
    "id": "project_123",
    "title": "AI Writing Assistant Project",
    "plan": {
      "ideas": [
        {
          "id": "idea_1",
          "content": "AI for mental health support",
          "location": "brainstorm",
          "sectionId": null,
          "aiGenerated": true,
          "createdAt": "2025-01-27T10:30:00Z"
        },
        {
          "id": "idea_2", 
          "content": "AI tools for stress management",
          "location": "brainstorm",
          "sectionId": null,
          "aiGenerated": false,
          "createdAt": "2025-01-27T10:35:00Z"
        }
      ],
      "outline": [
        {
          "id": "section_1",
          "title": "Introduction",
          "description": "Overview of AI applications",
          "bubbles": [
            {
              "id": "bubble_1",
              "content": "Define AI terminology",
              "location": "outline",
              "sectionId": "section_1",
              "aiGenerated": false
            }
          ]
        }
      ]
    },
    "write": {
      "content": "This is the main content of the document..."
    },
    "edit": {
      "content": "This is the edited version of the document..."
    },
    "chatHistory": [
      {
        "id": "msg_1",
        "role": "user",
        "content": "Hello, I need help with my project",
        "timestamp": "2025-01-27T10:00:00Z"
      },
      {
        "id": "msg_2", 
        "role": "assistant",
        "content": "I'd be happy to help! What kind of project are you working on?",
        "timestamp": "2025-01-27T10:01:00Z"
      }
    ],
    "metadata": {
      "template": "argumentative",
      "createdAt": "2025-01-27T09:00:00Z",
      "modifiedAt": "2025-01-27T10:30:00Z"
    }
  }
}
```

## 🔧 **Data Sanitization Process:**

### **Before Sanitization (Raw Project Data):**
```json
{
  "write": {
    "content": "<p><strong>Hello</strong> this is <em>HTML content</em></p>"
  },
  "plan": {
    "ideas": {
      "33": {
        "id": "33",
        "content": "<span>AI idea with HTML</span>",
        "location": "brainstorm"
      }
    }
  }
}
```

### **After Sanitization (Sent to API):**
```json
{
  "write": {
    "content": "Hello this is HTML content"
  },
  "plan": {
    "ideas": [
      {
        "id": "33",
        "content": "AI idea with HTML",
        "location": "brainstorm"
      }
    ]
  }
}
```

## 📋 **Complete Sample Request:**

### **Full HTTP Request:**
```http
POST https://your-api-endpoint.com/api/chat HTTP/1.1
Content-Type: application/json
Content-Length: 2847

{
  "userInput": "Help me brainstorm AI project ideas",
  "currentProject": {
    "id": "project_123",
    "title": "AI Writing Assistant Project",
    "plan": {
      "ideas": [
        {
          "id": "idea_1",
          "content": "AI for mental health support",
          "location": "brainstorm",
          "sectionId": null,
          "aiGenerated": true,
          "createdAt": "2025-01-27T10:30:00Z"
        }
      ],
      "outline": [
        {
          "id": "section_1",
          "title": "Introduction",
          "description": "Overview of AI applications",
          "bubbles": [
            {
              "id": "bubble_1",
              "content": "Define AI terminology",
              "location": "outline",
              "sectionId": "section_1",
              "aiGenerated": false
            }
          ]
        }
      ]
    },
    "write": {
      "content": "This is the main content of the document..."
    },
    "edit": {
      "content": "This is the edited version of the document..."
    },
    "chatHistory": [
      {
        "id": "msg_1",
        "role": "user",
        "content": "Hello, I need help with my project",
        "timestamp": "2025-01-27T10:00:00Z"
      },
      {
        "id": "msg_2",
        "role": "assistant", 
        "content": "I'd be happy to help! What kind of project are you working on?",
        "timestamp": "2025-01-27T10:01:00Z"
      }
    ],
    "metadata": {
      "template": "argumentative",
      "createdAt": "2025-01-27T09:00:00Z",
      "modifiedAt": "2025-01-27T10:30:00Z"
    }
  }
}
```

## 🎯 **Expected Response Structure:**

### **Current Response (What we get now):**
```json
{
  "assistantReply": "Great! Here are some fresh ideas: AI for predicting mental health crises, AI tools for managing stress and anxiety, and AI in therapy session analytics. What do you think?",
  "project": {
    "plan": {
      "ideas": [
        {
          "id": "new_idea_1",
          "content": "AI for predicting mental health crises",
          "location": "brainstorm",
          "aiGenerated": true
        }
      ]
    }
  }
}
```

### **Enhanced Response (What we want for structured data):**
```json
{
  "assistantReply": "Great! Here are some fresh ideas: AI for predicting mental health crises, AI tools for managing stress and anxiety, and AI in therapy session analytics. What do you think?",
  "extractedData": {
    "ideas": [
      "AI for predicting mental health crises",
      "AI tools for managing stress and anxiety", 
      "AI in therapy session analytics"
    ],
    "suggestions": [],
    "tasks": []
  },
  "project": {
    "plan": {
      "ideas": [
        {
          "id": "new_idea_1",
          "content": "AI for predicting mental health crises",
          "location": "brainstorm",
          "aiGenerated": true
        }
      ]
    }
  }
}
```

## 🔍 **Key Points:**

### **Data Sanitization:**
- ✅ **HTML to Text**: All HTML content is converted to plain text
- ✅ **Object to Array**: Ideas object `{33: {...}}` becomes array `[{...}]`
- ✅ **Function Removal**: Non-serializable functions are removed
- ✅ **Deep Copy**: Original project data is not modified

### **Request Structure:**
- ✅ **userInput**: The user's message/question
- ✅ **currentProject**: Complete project state (sanitized)
- ✅ **JSON Serialization**: Validates data can be serialized

### **Response Handling:**
- ✅ **assistantReply**: Natural conversation text
- ✅ **extractedData**: Structured data (NEW - for ideas extraction)
- ✅ **project**: Updated project data

## 🚀 **Next Steps for Backend:**

1. **Parse structured response** from OpenAI
2. **Extract ideas** from AI response
3. **Return extractedData** field in API response
4. **Maintain backward compatibility** with current response format
