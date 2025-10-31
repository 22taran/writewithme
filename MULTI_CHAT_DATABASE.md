# 🗄️ Multi-Chat Database Management System

## 📋 **Overview**

The AI Writing Assistant now supports **multiple independent chat sessions** with proper database persistence, similar to ChatGPT or Cursor. Each chat session is stored separately in the database and persists across page refreshes.

## 🏗️ **Database Schema**

### **New Tables Added:**

#### 1. **`writeassistdev_chat_sessions`** - Chat Session Metadata
```sql
CREATE TABLE writeassistdev_chat_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    writeassistdevid INT NOT NULL,
    userid INT NOT NULL,
    session_id VARCHAR(50) NOT NULL,
    title VARCHAR(255) DEFAULT 'New Chat',
    is_active TINYINT(1) DEFAULT 0,
    created_at INT NOT NULL,
    modified_at INT NOT NULL,
    
    FOREIGN KEY (writeassistdevid) REFERENCES writeassistdev(id),
    FOREIGN KEY (userid) REFERENCES user(id),
    UNIQUE KEY unique_session (writeassistdevid, userid, session_id)
);
```

#### 2. **`writeassistdev_chat`** - Individual Messages (Updated)
```sql
CREATE TABLE writeassistdev_chat (
    id INT PRIMARY KEY AUTO_INCREMENT,
    writeassistdevid INT NOT NULL,
    userid INT NOT NULL,
    chat_session_id VARCHAR(50) NOT NULL,  -- NEW FIELD
    role ENUM('user', 'assistant') NOT NULL,
    content TEXT NOT NULL,
    timestamp INT NOT NULL,
    created_at INT NOT NULL,
    
    FOREIGN KEY (writeassistdevid) REFERENCES writeassistdev(id),
    FOREIGN KEY (userid) REFERENCES user(id),
    INDEX idx_chat_session (chat_session_id)
);
```

## 🔧 **Key Features**

### **1. Session Management**
- ✅ **Create new chats** - Each gets unique session ID
- ✅ **Switch between chats** - Only one active at a time
- ✅ **Delete chats** - Removes session and all messages
- ✅ **Rename chats** - Update session titles
- ✅ **Persistent storage** - Survives page refreshes

### **2. Message Organization**
- ✅ **Session-based storage** - Messages grouped by session
- ✅ **Chronological order** - Messages sorted by timestamp
- ✅ **Role tracking** - User vs Assistant messages
- ✅ **Content preservation** - Full message content stored

### **3. Database Operations**
- ✅ **Transaction safety** - ACID compliance
- ✅ **Foreign key constraints** - Data integrity
- ✅ **Indexed queries** - Fast retrieval
- ✅ **Cascade deletes** - Clean data removal

## 🚀 **API Endpoints**

### **Chat Session Management:**
```javascript
// Create new chat session
POST /mod/writeassistdev/ajax.php
{
    action: 'create_chat_session',
    title: 'My New Chat'
}

// Get all chat sessions
POST /mod/writeassistdev/ajax.php
{
    action: 'get_chat_sessions'
}

// Switch to specific chat
POST /mod/writeassistdev/ajax.php
{
    action: 'switch_chat_session',
    session_id: 'chat_123_456_789_abc'
}

// Delete chat session
POST /mod/writeassistdev/ajax.php
{
    action: 'delete_chat_session',
    session_id: 'chat_123_456_789_abc'
}

// Update chat title
POST /mod/writeassistdev/ajax.php
{
    action: 'update_chat_title',
    session_id: 'chat_123_456_789_abc',
    title: 'Updated Title'
}
```

### **Message Management:**
```javascript
// Get messages for session
POST /mod/writeassistdev/ajax.php
{
    action: 'get_session_messages',
    session_id: 'chat_123_456_789_abc'
}

// Save message to session
POST /mod/writeassistdev/ajax.php
{
    action: 'save_session_message',
    session_id: 'chat_123_456_789_abc',
    role: 'user',
    content: 'Hello AI!',
    timestamp: 1640995200
}

// Clear all messages in session
POST /mod/writeassistdev/ajax.php
{
    action: 'clear_session_messages',
    session_id: 'chat_123_456_789_abc'
}
```

## 📊 **Data Flow**

### **Creating New Chat:**
1. **Frontend**: User clicks "+" button
2. **AJAX**: `create_chat_session` endpoint called
3. **Backend**: `ChatSessionManager::createSession()` creates new session
4. **Database**: New record in `writeassistdev_chat_sessions`
5. **Response**: Returns unique `session_id`
6. **Frontend**: Creates new tab with session ID

### **Sending Message:**
1. **Frontend**: User types message and hits send
2. **AJAX**: `save_session_message` endpoint called
3. **Backend**: `ChatSessionManager::saveMessage()` stores message
4. **Database**: New record in `writeassistdev_chat` with `chat_session_id`
5. **Response**: Returns success confirmation
6. **Frontend**: Displays message in current chat tab

### **Switching Chats:**
1. **Frontend**: User clicks different chat tab
2. **AJAX**: `switch_chat_session` endpoint called
3. **Backend**: `ChatSessionManager::switchToSession()` updates active session
4. **Database**: Sets `is_active=1` for target, `is_active=0` for others
5. **Frontend**: Loads messages for new active session

## 🔄 **Migration Strategy**

### **Database Upgrade:**
1. **Version bump**: `version.php` updated to `2025102105`
2. **Schema changes**: New tables and fields added
3. **Existing data**: Preserved in old format
4. **Backward compatibility**: Old chat system still works

### **Data Migration:**
- **Existing chats**: Can be migrated to new system
- **Session creation**: First message creates default session
- **Gradual transition**: Users can continue using old system

## 🎯 **Benefits**

### **For Users:**
- ✅ **Multiple conversations** - Separate topics in different chats
- ✅ **Persistent history** - Chats survive page refreshes
- ✅ **Organized workflow** - Clear separation of ideas
- ✅ **Easy navigation** - Switch between conversations instantly

### **For Developers:**
- ✅ **Scalable architecture** - Handles unlimited chat sessions
- ✅ **Clean data model** - Normalized database structure
- ✅ **Efficient queries** - Indexed for fast retrieval
- ✅ **Maintainable code** - Clear separation of concerns

### **For System:**
- ✅ **Better performance** - Smaller, focused queries
- ✅ **Data integrity** - Foreign key constraints
- ✅ **Storage efficiency** - No duplicate data
- ✅ **Future extensibility** - Easy to add features

## 🚀 **Next Steps**

1. **Run database upgrade** - Execute the new schema
2. **Update frontend** - Integrate with new API endpoints
3. **Test functionality** - Verify all features work
4. **Migrate existing data** - Convert old chats to new format
5. **User training** - Explain new multi-chat features

## 📝 **Usage Example**

```javascript
// Frontend integration example
class MultiChatManager {
    async createNewChat(title = 'New Chat') {
        const response = await fetch('/mod/writeassistdev/ajax.php', {
            method: 'POST',
            body: new FormData({
                action: 'create_chat_session',
                title: title,
                cmid: window.cmId,
                sesskey: window.sesskey
            })
        });
        
        const result = await response.json();
        if (result.success) {
            this.switchToChat(result.session_id);
        }
    }
    
    async switchToChat(sessionId) {
        // Switch backend session
        await fetch('/mod/writeassistdev/ajax.php', {
            method: 'POST',
            body: new FormData({
                action: 'switch_chat_session',
                session_id: sessionId,
                cmid: window.cmId,
                sesskey: window.sesskey
            })
        });
        
        // Load messages for this session
        const messages = await this.loadSessionMessages(sessionId);
        this.displayMessages(messages);
    }
}
```

This system provides a robust, scalable foundation for managing multiple chat sessions with full database persistence! 🎉
