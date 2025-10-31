// Robust Chat Manager - Built from scratch with best practices
// This replaces the existing ChatManager in dom.js

class RobustChatManager {
    constructor(globalState) {
        this.globalState = globalState;
        this.messages = new Map(); // Use Map for O(1) lookups and deduplication
        this.isInitialized = false;
        this.eventHandlers = new Map(); // Track event handlers for cleanup
        this.messageIds = new Set(); // Track processed message IDs
        
        this.elements = {
            chatMessages: document.getElementById('chatMessages'),
            userInput: document.getElementById('userInput'),
            sendButton: document.getElementById('sendMessage'),
            regenerateGlobalBtn: document.getElementById('regenerateGlobalBtn')
        };
        
        this.init();
    }

    init() {
        if (this.isInitialized) {
            console.warn('RobustChatManager: Already initialized, skipping...');
            return;
        }
        
        console.log('RobustChatManager: Initializing...');
        this.setupEventListeners();
        this.subscribeToGlobalState();
        this.isInitialized = true;
        console.log('RobustChatManager: Initialized successfully');
    }

    destroy() {
        console.log('RobustChatManager: Destroying...');
        this.removeAllEventListeners();
        this.messages.clear();
        this.messageIds.clear();
        this.isInitialized = false;
    }

    subscribeToGlobalState() {
        if (!this.globalState) return;
        
        // Remove existing subscription if any
        if (this.stateChangeHandler) {
            this.globalState.unsubscribe('stateChanged', this.stateChangeHandler);
        }
        
        this.stateChangeHandler = (state) => this.handleStateChange(state);
        this.globalState.subscribe('stateChanged', this.stateChangeHandler);
    }

    handleStateChange(state) {
        if (!state.chatHistory || !Array.isArray(state.chatHistory)) return;
        
        console.log('RobustChatManager: State changed, processing', state.chatHistory.length, 'messages');
        
        // Process each message with deduplication
        state.chatHistory.forEach(msg => {
            this.addMessageIfNew(msg);
        });
    }

    addMessageIfNew(message) {
        // Ensure message has required fields
        if (!message.role || !message.content) {
            console.warn('RobustChatManager: Invalid message format:', message);
            return;
        }
        
        // Create unique key for deduplication - handle undefined timestamp
        const timestamp = message.timestamp || message.id || Date.now().toString();
        const messageKey = `${message.role}_${timestamp}_${message.content.substring(0, 50)}`;
        
        // Additional check: prevent duplicate content within last 5 seconds
        const contentKey = `${message.role}_${message.content}`;
        const now = Date.now();
        if (this.recentMessages && this.recentMessages.has(contentKey)) {
            const lastTime = this.recentMessages.get(contentKey);
            if (now - lastTime < 5000) { // 5 seconds
                console.log('RobustChatManager: Duplicate content detected within 5 seconds, skipping:', contentKey);
                return;
            }
        }
        
        if (this.messages.has(messageKey)) {
            console.log('RobustChatManager: Message already exists, skipping:', messageKey);
            return;
        }
        
        console.log('RobustChatManager: Adding new message:', messageKey);
        this.messages.set(messageKey, message);
        
        // Track recent messages to prevent rapid duplicates
        if (!this.recentMessages) {
            this.recentMessages = new Map();
        }
        this.recentMessages.set(contentKey, now);
        
        // Clean up old entries (older than 10 seconds)
        for (const [key, time] of this.recentMessages.entries()) {
            if (now - time > 10000) {
                this.recentMessages.delete(key);
            }
        }
        
        this.renderMessage(message);
    }

    setupEventListeners() {
        // Send button
        if (this.elements.sendButton) {
            this.sendHandler = (e) => {
                e.preventDefault();
                this.sendMessage();
            };
            this.elements.sendButton.addEventListener('click', this.sendHandler);
            this.eventHandlers.set('sendButton', { element: this.elements.sendButton, handler: this.sendHandler, event: 'click' });
        }
        
        // Enter key
        if (this.elements.userInput) {
            this.keypressHandler = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            };
            this.elements.userInput.addEventListener('keypress', this.keypressHandler);
            this.eventHandlers.set('userInput', { element: this.elements.userInput, handler: this.keypressHandler, event: 'keypress' });
        }

        // Regenerate button
        if (this.elements.regenerateGlobalBtn) {
            this.regenerateHandler = (e) => {
                e.preventDefault();
                this.regenerateLastMessage();
            };
            this.elements.regenerateGlobalBtn.addEventListener('click', this.regenerateHandler);
            this.eventHandlers.set('regenerateButton', { element: this.elements.regenerateGlobalBtn, handler: this.regenerateHandler, event: 'click' });
        }
    }

    removeAllEventListeners() {
        this.eventHandlers.forEach(({ element, handler, event }) => {
            element.removeEventListener(event, handler);
        });
        this.eventHandlers.clear();
        
        // Remove global state subscription
        if (this.stateChangeHandler && this.globalState) {
            this.globalState.unsubscribe('stateChanged', this.stateChangeHandler);
        }
    }

    sendMessage() {
        if (!this.elements.userInput) return;
        
        const message = this.elements.userInput.value.trim();
        if (!message) return;
        
        console.log('RobustChatManager: Sending message:', message);
        
        // Clear input immediately to prevent double-sending
        this.elements.userInput.value = '';
        
        // Disable send button temporarily
        if (this.elements.sendButton) {
            this.elements.sendButton.disabled = true;
            setTimeout(() => {
                if (this.elements.sendButton) {
                    this.elements.sendButton.disabled = false;
                }
            }, 1000);
        }
        
        // Emit event with unique ID to prevent duplicates
        const messageId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        document.dispatchEvent(new CustomEvent('messageSent', {
            detail: { 
                message, 
                role: 'user',
                id: messageId,
                timestamp: new Date().toISOString()
            }
        }));
    }

    renderMessage(message) {
        if (!this.elements.chatMessages) {
            console.error('RobustChatManager: chatMessages element not found');
            return;
        }
        
        // Check if message already rendered - handle undefined timestamp
        const messageId = message.id || message.timestamp || `${message.role}_${Date.now()}`;
        const existingMessage = this.elements.chatMessages.querySelector(`[data-message-id="${messageId}"]`);
        if (existingMessage) {
            console.log('RobustChatManager: Message already rendered, skipping');
            return;
        }
        
        const messageDiv = createElement('div', `message ${message.role}`);
        messageDiv.setAttribute('data-message-id', messageId);
        
        const messageContent = createElement('div', 'message-content', message.content);
        messageDiv.appendChild(messageContent);
        
        this.elements.chatMessages.appendChild(messageDiv);
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        
        console.log('RobustChatManager: Rendered message:', message.role, message.content.substring(0, 30));
    }

    regenerateLastMessage() {
        if (this.messages.size < 2) return;
        
        const messagesArray = Array.from(this.messages.values());
        const last = messagesArray[messagesArray.length - 1];
        const prev = messagesArray[messagesArray.length - 2];
        
        if (last.role !== 'assistant' || prev.role !== 'user') return;
        
        // Remove last AI message
        const lastKey = Array.from(this.messages.keys())[this.messages.size - 1];
        this.messages.delete(lastKey);
        
        // Remove from DOM
        const lastMessageElement = this.elements.chatMessages.querySelector(`[data-message-id="${last.id || last.timestamp}"]`);
        if (lastMessageElement) {
            lastMessageElement.remove();
        }
        
        // Request regeneration
        document.dispatchEvent(new CustomEvent('regenerateRequested', {
            detail: { message: prev.content }
        }));
    }

    loadMessages(messages) {
        console.log('RobustChatManager: Loading', messages.length, 'messages');
        this.messages.clear();
        this.messageIds.clear();
        if (this.elements.chatMessages) {
            this.elements.chatMessages.innerHTML = '';
        }
        
        messages.forEach(msg => {
            this.addMessageIfNew(msg);
        });
    }

    clearMessages() {
        console.log('RobustChatManager: Clearing all messages');
        this.messages.clear();
        this.messageIds.clear();
        if (this.elements.chatMessages) {
            this.elements.chatMessages.innerHTML = '';
        }
    }

    getMessages() {
        return Array.from(this.messages.values());
    }

    getMessageCount() {
        return this.messages.size;
    }
}
