# Sample API Request

## Endpoint
`POST http://localhost:5002/api/chat`

## HTTP Headers
```
Content-Type: application/json
Accept: */*
```

## Request Body

```json
{
  "userInput": "Let's write about renewable energy",
  "currentProject": {
    "metadata": {
      "title": "Climate Solutions",
      "description": "Exploring renewable energy options",
      "currentTab": "plan",
      "currentPhase": "plan_organize",
      "instructorInstructions": "",
      "created": "1761419706",
      "modified": "1761583035"
    },
    "plan": {
      "ideas": [
        {
          "id": "1",
          "content": "Solar power efficiency",
          "location": "brainstorm",
          "sectionId": null,
          "aiGenerated": false
        },
        {
          "id": "2",
          "content": "Wind energy in rural areas",
          "location": "brainstorm",
          "sectionId": null,
          "aiGenerated": false
        }
      ],
      "outline": [
        {
          "id": "outline-1",
          "title": "Introduction",
          "content": "Overview of renewable energy"
        },
        {
          "id": "outline-2",
          "title": "Solar Power",
          "content": "Benefits and implementation"
        }
      ]
    },
    "write": {
      "content": "Renewable energy is transforming our world...",
      "wordCount": "45"
    },
    "edit": {
      "content": "",
      "wordCount": "0"
    },
    "chatHistory": [
      {
        "role": "user",
        "content": "I want to write about climate solutions",
        "timestamp": "2025-10-27T18:00:00.000Z"
      },
      {
        "role": "assistant",
        "content": "Great topic! What specific aspect of climate solutions interests you most?",
        "timestamp": "2025-10-27T18:00:01.000Z"
      },
      {
        "role": "user",
        "content": "Let's write about renewable energy",
        "timestamp": "2025-10-27T18:01:00.000Z"
      }
    ]
  }
}
```

## Success Response (200 OK)

```json
{
  "assistantReply": "Perfect! With your ideas on solar power and wind energy, let's build out that outline. Ready to add more sections or start writing?",
  "project": {
    "metadata": {
      "title": "Climate Solutions",
      "description": "Exploring renewable energy options",
      "currentTab": "plan",
      "currentPhase": "plan_organize",
      "instructorInstructions": "",
      "created": "1761419706",
      "modified": "1761583035"
    },
    "plan": {
      "ideas": [
        {
          "id": "1",
          "content": "Solar power efficiency",
          "location": "brainstorm",
          "sectionId": null,
          "aiGenerated": false
        },
        {
          "id": "2",
          "content": "Wind energy in rural areas",
          "location": "brainstorm",
          "sectionId": null,
          "aiGenerated": false
        }
      ],
      "outline": [
        {
          "id": "outline-1",
          "title": "Introduction",
          "content": "Overview of renewable energy"
        },
        {
          "id": "outline-2",
          "title": "Solar Power",
          "content": "Benefits and implementation"
        }
      ]
    },
    "write": {
      "content": "Renewable energy is transforming our world...",
      "wordCount": "45"
    },
    "edit": {
      "content": "",
      "wordCount": "0"
    },
    "chatHistory": [
      {
        "role": "user",
        "content": "I want to write about climate solutions",
        "timestamp": "2025-10-27T18:00:00.000Z"
      },
      {
        "role": "assistant",
        "content": "Great topic! What specific aspect of climate solutions interests you most?",
        "timestamp": "2025-10-27T18:00:01.000Z"
      },
      {
        "role": "user",
        "content": "Let's write about renewable energy",
        "timestamp": "2025-10-27T18:01:00.000Z"
      },
      {
        "role": "assistant",
        "content": "Perfect! With your ideas on solar power and wind energy, let's build out that outline. Ready to add more sections or start writing?"
      }
    ]
  }
}
```

## Error Response Examples

### 400 Bad Request - Missing userInput
```json
{
  "error": "No userInput provided",
  "assistantReply": "Please provide a message."
}
```

### 400 Bad Request - Missing currentProject
```json
{
  "error": "No currentProject provided",
  "assistantReply": "Project data is required."
}
```

### 500 Internal Server Error - Agent Not Initialized
```json
{
  "error": "AI service not available",
  "assistantReply": "The AI Writing Assistant service is not properly configured. Please contact your administrator."
}
```

---

## cURL Example

```bash
curl -X POST http://localhost:5002/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "Let'\''s write about renewable energy",
    "currentProject": {
      "metadata": {
        "title": "Climate Solutions",
        "description": "Exploring renewable energy options",
        "currentTab": "plan",
        "currentPhase": "plan_organize",
        "instructorInstructions": "",
        "created": "1761419706",
        "modified": "1761583035"
      },
      "plan": {
        "ideas": [
          {
            "id": "1",
            "content": "Solar power efficiency",
            "location": "brainstorm",
            "sectionId": null,
            "aiGenerated": false
          },
          {
            "id": "2",
            "content": "Wind energy in rural areas",
            "location": "brainstorm",
            "sectionId": null,
            "aiGenerated": false
          }
        ],
        "outline": []
      },
      "write": {
        "content": "",
        "wordCount": "0"
      },
      "edit": {
        "content": "",
        "wordCount": "0"
      },
      "chatHistory": []
    }
  }'
```

---

## Python Example

```python
import requests

url = "http://localhost:5002/api/chat"
payload = {
    "userInput": "Let's write about renewable energy",
    "currentProject": {
        "metadata": {
            "title": "Climate Solutions",
            "description": "Exploring renewable energy options",
            "currentTab": "plan",
            "currentPhase": "plan_organize",
            "instructorInstructions": "",
            "created": "1761419706",
            "modified": "1761583035"
        },
        "plan": {
            "ideas": [],
            "outline": []
        },
        "write": {
            "content": "",
            "wordCount": "0"
        },
        "edit": {
            "content": "",
            "wordCount": "0"
        },
        "chatHistory": []
    }
}

response = requests.post(url, json=payload)
data = response.json()

print(f"AI Response: {data['assistantReply']}")
print(f"Updated Project: {data['project']}")
```

---

## JavaScript Fetch Example

```javascript
async function sendChatMessage(userInput, currentProject) {
  const response = await fetch('http://localhost:5002/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userInput: userInput,
      currentProject: currentProject
    })
  });

  const data = await response.json();
  return {
    assistantReply: data.assistantReply,
    project: data.project
  };
}

// Usage
const result = await sendChatMessage(
  "Let's write about renewable energy",
  {
    metadata: { title: "My Project", currentTab: "plan" },
    plan: { ideas: [], outline: [] },
    write: { content: "", wordCount: "0" },
    edit: { content: "", wordCount: "0" },
    chatHistory: []
  }
);

console.log(result.assistantReply);
```
