// Complete Chat System - Built from scratch with all features

// === CHAT TAB MANAGER ===

class ChatTabManager {
    constructor(chatSystem) {
        this.chatSystem = chatSystem;
        this.chats = new Map(); // Store chat instances by ID
        this.currentChatId = 'chat-1';
        this.chatCounter = 1;
        
        this.elements = {
            chatTabs: document.querySelector('.chat-tabs'),
            newChatBtn: document.getElementById('newChatBtn'),
            chatContent: document.querySelector('.chat-content'),
            clearChatBtn: document.getElementById('clearChatBtn')
        };
        
        this.init();
    }
    
    init() {
        // Initialize with existing chat-1
        this.currentChatId = 'chat-1';
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Delay the initial switch to ensure DOM is ready
        setTimeout(() => {
            this.switchToChat('chat-1');
        }, 100);
    }
    
    setupEventListeners() {
        // New chat button
        if (this.elements.newChatBtn) {
            this.elements.newChatBtn.addEventListener('click', () => this.createNewChat());
        }
        
        // Chat tab clicks
        if (this.elements.chatTabs) {
            this.elements.chatTabs.addEventListener('click', (e) => {
                if (e.target.classList.contains('chat-tab')) {
                    const chatId = e.target.dataset.chatId;
                    this.switchToChat(chatId);
                } else if (e.target.classList.contains('chat-tab-close')) {
                    const chatId = e.target.dataset.chatId;
                    this.deleteChat(chatId);
                }
            });
        }
        
        // Clear chat button
        if (this.elements.clearChatBtn) {
            this.elements.clearChatBtn.addEventListener('click', () => this.clearCurrentChat());
        }
    }
    
    createNewChat() {
        this.chatCounter++;
        const chatId = `chat-${this.chatCounter}`;
        const chatTitle = `Chat ${this.chatCounter}`;
        
        this.createChat(chatId, chatTitle);
        this.switchToChat(chatId);
    }
    
    createChat(chatId, title) {
        // For chat-1, use existing elements
        if (chatId === 'chat-1') {
            const chatInstance = {
                id: chatId,
                title: title,
                messages: new Map(),
                tab: document.querySelector(`[data-chat-id="${chatId}"]`),
                messagesContainer: document.getElementById('chatMessages')
            };
            
            this.chats.set(chatId, chatInstance);
            return chatInstance;
        }
        
        // For new chats, create new elements
        const chatTab = document.createElement('div');
        chatTab.className = 'chat-tab';
        chatTab.dataset.chatId = chatId;
        chatTab.innerHTML = `
            <span class="chat-tab-title">${title}</span>
            <button class="chat-tab-close" data-chat-id="${chatId}" title="Close chat" aria-label="Close chat">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
                    <path d="M9 3L3 9M3 3l6 6" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
            </button>
        `;
        
        // Insert before new chat button
        this.elements.chatTabs.insertBefore(chatTab, this.elements.newChatBtn);
        
        // Create chat messages container
        const chatMessages = document.createElement('div');
        chatMessages.className = 'chat-messages';
        chatMessages.id = `chatMessages-${chatId}`;
        chatMessages.dataset.chatId = chatId;
        
        // Insert into chat content
        this.elements.chatContent.insertBefore(chatMessages, this.elements.chatContent.querySelector('.chat-actions-row'));
        
        // Create chat instance
        const chatInstance = {
            id: chatId,
            title: title,
            messages: new Map(),
            tab: chatTab,
            messagesContainer: chatMessages
        };
        
        this.chats.set(chatId, chatInstance);
        
        return chatInstance;
    }
    
    switchToChat(chatId) {
        if (!this.chats.has(chatId)) {
            // If chat doesn't exist, create it (for chat-1)
            if (chatId === 'chat-1') {
                this.createChat(chatId, 'New Chat');
            } else {
                return;
            }
        }
        
        // Update active tab
        document.querySelectorAll('.chat-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        const activeTab = document.querySelector(`[data-chat-id="${chatId}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
        
        // Update active messages container
        document.querySelectorAll('.chat-messages').forEach(container => {
            container.classList.remove('active');
        });
        
        const messagesContainer = chatId === 'chat-1' 
            ? document.getElementById('chatMessages')
            : document.getElementById(`chatMessages-${chatId}`);
            
        if (messagesContainer) {
            messagesContainer.classList.add('active');
        }
        
        // Update current chat ID
        this.currentChatId = chatId;
        
        // Update chat system reference - with null checks
        if (this.chatSystem) {
            this.chatSystem.currentChatId = chatId;
            this.chatSystem.messages = this.chats.get(chatId).messages;
            
            // Only update elements if they exist
            if (this.chatSystem.elements) {
                this.chatSystem.elements.chatMessages = messagesContainer;
            }
        }
        
        console.log(`Switched to chat: ${chatId}`);
    }
    
    deleteChat(chatId) {
        if (!this.chats.has(chatId)) return;
        
        // Don't delete if it's the only chat
        if (this.chats.size <= 1) {
            console.log('Cannot delete the last chat');
            return;
        }
        
        const chat = this.chats.get(chatId);
        
        // Remove tab
        chat.tab.remove();
        
        // Remove messages container
        chat.messagesContainer.remove();
        
        // Remove from chats map
        this.chats.delete(chatId);
        
        // If we deleted the current chat, switch to another one
        if (this.currentChatId === chatId) {
            const remainingChats = Array.from(this.chats.keys());
            if (remainingChats.length > 0) {
                this.switchToChat(remainingChats[0]);
            }
        }
        
        console.log(`Deleted chat: ${chatId}`);
    }
    
    clearCurrentChat() {
        const currentChat = this.chats.get(this.currentChatId);
        if (currentChat) {
            currentChat.messages.clear();
            currentChat.messagesContainer.innerHTML = '';
            this.chatSystem.messages = currentChat.messages;
            console.log(`Cleared chat: ${this.currentChatId}`);
        }
    }
    
    updateChatTitle(chatId, newTitle) {
        const chat = this.chats.get(chatId);
        if (chat) {
            chat.title = newTitle;
            const titleElement = chat.tab.querySelector('.chat-tab-title');
            if (titleElement) {
                titleElement.textContent = newTitle;
            }
        }
    }
}

// === COMPLETE CHAT SYSTEM ===
// This replaces all existing chat functionality

class CompleteChatSystem {
    constructor(globalState, api, projectManager) {
        this.globalState = globalState;
        this.api = api;
        this.projectManager = projectManager;
        this.currentChatId = 'chat-1';
        this.messages = new Map();
        this.isInitialized = false;
        this.isProcessing = false;
        this.eventHandlers = new Map();
        this.messageQueue = [];
        this.retryCount = 0;
        this.maxRetries = 3;
        
        // Lazy loading state
        this.chatHistoryLoaded = false;
        this.isLoadingHistory = false;
        this.allChatMessages = [];  // Store all messages from API
        this.renderedMessageCount = 0;  // Track how many messages are rendered
        this.isLoadingFromDatabase = false;  // Flag to prevent circular updates
        this.pageSize = 20;
        this.isFetchingOlder = false;
        this.hasMore = true;
        this.oldestTimestampLoaded = null; // oldest ts in allChatMessages
        this.messageKeys = new Set(); // strong dedupe: role|ts|content

        this.makeMessageKey = (m) => {
            const ts = typeof m.timestamp === 'string' ? m.timestamp : String(m.timestamp || '');
            return `${m.role}|${ts}|${m.content}`;
        };
        
        // Initialize tab manager after elements are set up
        setTimeout(() => {
            this.tabManager = new ChatTabManager(this);
        }, 200);
        
        // DOM elements
        this.elements = {
            chatMessages: document.getElementById('chatMessages'),
            userInput: document.getElementById('userInput'),
            sendButton: document.getElementById('sendMessage'),
            clearChatButton: document.getElementById('clearChatBtn'),
            typingIndicator: null
        };
        
        
        // Create typing indicator if it doesn't exist
        this.createTypingIndicator();
        
        // Delay initialization to ensure DOM is ready
        setTimeout(() => {
            this.init();
        }, 100);
    }

    init() {
        if (this.isInitialized) {
            console.warn('CompleteChatSystem: Already initialized');
            return;
        }
        
        
        
        if (!this.elements.chatMessages) {
            console.error('CompleteChatSystem: chatMessages element not found!');
            return;
        }
        
        // Setup event listeners immediately for responsive UI
        this.setupEventListeners();
        this.subscribeToGlobalState();
        this.setupAutoSave();
        
        // Load chat history asynchronously (non-blocking)
        this.loadChatHistory();
        
        this.isInitialized = true;
    }

    destroy() {
        console.log('CompleteChatSystem: Destroying...');
        this.removeAllEventListeners();
        this.messages.clear();
        this.messageQueue = [];
        this.isInitialized = false;
    }

    // === MESSAGE MANAGEMENT ===
    
    async sendMessage(content) {
        if (!content || !content.trim()) return;
        if (this.isProcessing) {
            this.messageQueue.push(content);
            return;
        }
        
        this.isProcessing = true;
        this.disableInput(true);
        
        try {
            // Add user message
            const userMessage = this.createMessage('user', content.trim());
            await this.addMessage(userMessage);
            
            // Show typing indicator
            this.showTypingIndicator();
            
            // Get AI response
            const aiResponse = await this.getAIResponse(content);
            
            // Hide typing indicator
            this.hideTypingIndicator();
            
            // Add AI response
            const assistantMessage = this.createMessage('assistant', aiResponse);
            await this.addMessage(assistantMessage);
            
            // Process queued messages
            this.processMessageQueue();
            
        } catch (error) {
            console.error('CompleteChatSystem: Error sending message:', error);
            this.hideTypingIndicator();
            await this.addMessage(this.createMessage('assistant', 'Sorry, I encountered an error. Please try again.'));
        } finally {
            this.isProcessing = false;
            this.disableInput(false);
        }
    }

    async getAIResponse(userMessage) {
        try {
            const currentProject = this.globalState.getState();
            const response = await this.api.sendChatMessage(userMessage, currentProject);
            
            if (response && response.assistantReply) {
                return response.assistantReply;
            } else {
                throw new Error('No response from AI');
            }
        } catch (error) {
            console.error('CompleteChatSystem: AI response error:', error);
            throw error;
        }
    }

    processMessageQueue() {
        if (this.messageQueue.length > 0 && !this.isProcessing) {
            const nextMessage = this.messageQueue.shift();
            setTimeout(() => this.sendMessage(nextMessage), 100);
        }
    }

    // === MESSAGE CREATION AND STORAGE ===
    
    createMessage(role, content, metadata = {}) {
        const timestamp = new Date().toISOString();
        const id = `${role}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        return {
            id,
            role,
            content,
            timestamp,
            metadata: {
                ...metadata,
                retryCount: 0,
                status: 'sent'
            }
        };
    }

    async addMessage(message) {
        console.log('CHAT DEBUG: addMessage called with:', message);
        
        // Validate message
        if (!this.validateMessage(message)) {
            console.warn('CompleteChatSystem: Invalid message:', message);
            return false;
        }
        
        // Check for duplicates (by id and by content+timestamp+role)
        if (this.isDuplicate(message)) {
            console.log('CHAT DEBUG: Duplicate message detected, skipping');
            return false;
        }
        
        // Strong-key dedupe guard
        const key = this.makeMessageKey(message);
        if (this.messageKeys.has(key)) {
            return false;
        }
        this.messageKeys.add(key);

        // Add to local storage
        this.messages.set(message.id, message);
        
        // Render in UI
        this.renderMessage(message);
        
        // Try parsing AI response for ideas
        if (message.role === 'assistant') {
            console.log('IDEAS DEBUG: Parsing AI response for ideas:', message.content);
            const ideas = this.parseIdeasFromResponse(message.content);
            if (ideas.length > 0) {
                console.log('IDEAS DEBUG: Extracted ideas from parsing:', ideas);
                await this.addIdeasToBrainstorm(ideas);
            }
        }
        
        // Update global state
        await this.updateGlobalState();
        
        // Only save to database if this is a NEW message (not loaded from history)
        if (message.metadata?.status !== 'loaded') {
            await this.saveToDatabase(message);
        }
        
        return true;
    }

    validateMessage(message) {
        return message && 
               message.id && 
               message.role && 
               message.content && 
               message.timestamp &&
               ['user', 'assistant'].includes(message.role);
    }

    isDuplicate(message) {
        // Check by ID
        if (this.messages.has(message.id)) {
            return true;
        }
        
        // Check by content within last 5 seconds
        const recentMessages = Array.from(this.messages.values())
            .filter(msg => msg.role === message.role && 
                          Date.now() - new Date(msg.timestamp).getTime() < 5000);
        
        return recentMessages.some(msg => msg.content === message.content);
    }

    // === UI MANAGEMENT ===
    
    renderMessage(message, prepend = false) {
        
        if (!this.elements.chatMessages) {
            console.error('CompleteChatSystem: Chat messages container not found');
            return;
        }
        
        
        // Check if already rendered
        const existingElement = this.elements.chatMessages.querySelector(`[data-message-id="${message.id}"]`);
        if (existingElement) {
            return;
        }
        
        const messageElement = this.createMessageElement(message);
        
        if (prepend) {
            this.elements.chatMessages.insertBefore(messageElement, this.elements.chatMessages.firstChild);
        } else {
            this.elements.chatMessages.appendChild(messageElement);
            this.scrollToBottom();
        }
        
    }

    createMessageElement(message) {
        
        const messageDiv = createElement('div', `message ${message.role}`);
        messageDiv.setAttribute('data-message-id', message.id);
        
        
        const contentDiv = createElement('div', 'message-content', message.content);
        
        // Ensure we have a valid timestamp for display
        const displayTime = message.timestamp || new Date().toISOString();
        const timeDiv = createElement('div', 'message-time', this.formatTime(displayTime));
        
        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(timeDiv);
        
        
        // Add action buttons for assistant messages
        if (message.role === 'assistant') {
            const actionsDiv = createElement('div', 'message-actions');
            const regenerateBtn = createElement('button', 'regenerate-btn', '↻');
            regenerateBtn.title = 'Regenerate this response';
            regenerateBtn.addEventListener('click', () => this.regenerateMessage(message));
            actionsDiv.appendChild(regenerateBtn);
            messageDiv.appendChild(actionsDiv);
            
        }
        
        return messageDiv;
    }

    createTypingIndicator() {
        if (!this.elements.chatMessages) return;
        
        this.elements.typingIndicator = createElement('div', 'typing-indicator');
        this.elements.typingIndicator.innerHTML = `
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <span class="typing-text">AI is typing...</span>
        `;
        this.elements.typingIndicator.style.display = 'none';
        this.elements.chatMessages.appendChild(this.elements.typingIndicator);
    }

    showTypingIndicator() {
        if (this.elements.typingIndicator) {
            this.elements.typingIndicator.style.display = 'flex';
            this.scrollToBottom();
        }
    }

    hideTypingIndicator() {
        if (this.elements.typingIndicator) {
            this.elements.typingIndicator.style.display = 'none';
        }
    }

    scrollToBottom() {
        if (this.elements.chatMessages) {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        }
    }

    formatTime(timestamp) {
        // Handle different timestamp formats
        let date;
        
        if (typeof timestamp === 'string') {
            // Try to parse as ISO string first
            date = new Date(timestamp);
            // If invalid, try parsing as Unix timestamp
            if (isNaN(date.getTime())) {
                date = new Date(parseInt(timestamp) * 1000);
            }
        } else if (typeof timestamp === 'number') {
            // If it's a Unix timestamp (seconds), convert to milliseconds
            if (timestamp < 10000000000) { // Unix timestamp in seconds
                date = new Date(timestamp * 1000);
            } else { // Already in milliseconds
                date = new Date(timestamp);
            }
        } else {
            // Fallback to current time
            date = new Date();
        }
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            console.warn('CompleteChatSystem: Invalid timestamp:', timestamp);
            return 'Invalid time';
        }
        
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // === EVENT HANDLING ===
    
    setupEventListeners() {
        // Send button
        if (this.elements.sendButton) {
            this.sendHandler = (e) => {
                e.preventDefault();
                const content = this.elements.userInput.value.trim();
                if (content) {
                    this.elements.userInput.value = '';
                    this.sendMessage(content);
                }
            };
            this.elements.sendButton.addEventListener('click', this.sendHandler);
            this.eventHandlers.set('sendButton', { 
                element: this.elements.sendButton, 
                handler: this.sendHandler, 
                event: 'click' 
            });
        }
        
        // Enter key
        if (this.elements.userInput) {
            this.keypressHandler = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const content = this.elements.userInput.value.trim();
                    if (content) {
                        this.elements.userInput.value = '';
                        this.sendMessage(content);
                    }
                }
            };
            this.elements.userInput.addEventListener('keypress', this.keypressHandler);
            this.eventHandlers.set('userInput', { 
                element: this.elements.userInput, 
                handler: this.keypressHandler, 
                event: 'keypress' 
            });
        }
        
        // Clear chat button
        if (this.elements.clearChatButton) {
            this.clearChatHandler = (e) => {
                e.preventDefault();
                this.clearChat();
            };
            this.elements.clearChatButton.addEventListener('click', this.clearChatHandler);
            this.eventHandlers.set('clearChatButton', { 
                element: this.elements.clearChatButton, 
                handler: this.clearChatHandler, 
                event: 'click' 
            });
        }
    }

    removeAllEventListeners() {
        this.eventHandlers.forEach(({ element, handler, event }) => {
            element.removeEventListener(event, handler);
        });
        this.eventHandlers.clear();
    }

    disableInput(disabled) {
        if (this.elements.userInput) {
            this.elements.userInput.disabled = disabled;
        }
        if (this.elements.sendButton) {
            this.elements.sendButton.disabled = disabled;
        }
    }

    // === STATE MANAGEMENT ===
    
    subscribeToGlobalState() {
        if (!this.globalState) return;
        
        if (this.stateChangeHandler) {
            this.globalState.unsubscribe('stateChanged', this.stateChangeHandler);
        }
        
        this.stateChangeHandler = (state) => this.handleStateChange(state);
        this.globalState.subscribe('stateChanged', this.stateChangeHandler);
    }

    handleStateChange(state) {
        if (state.chatHistory && Array.isArray(state.chatHistory)) {
            this.syncWithGlobalState(state.chatHistory);
        }
    }

    syncWithGlobalState(chatHistory) {
        // Only sync if there are new messages
        const currentCount = this.messages.size;
        const newCount = chatHistory.length;
        
        if (newCount > currentCount) {
            
            // Add only new messages
            for (let i = currentCount; i < newCount; i++) {
                const message = chatHistory[i];
                if (!this.messages.has(message.id)) {
                    this.messages.set(message.id, message);
                    this.renderMessage(message);
                }
            }
        }
    }

    async updateGlobalState() {
        // Don't update global state while loading from database (prevents circular updates)
        if (this.isLoadingFromDatabase) {
            return;
        }
        
        const currentState = this.globalState.getState();
        // Convert messages to the format expected by the database
        currentState.chatHistory = Array.from(this.messages.values()).map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp
        }));
        this.globalState.setState(currentState);
    }

    // === DATABASE OPERATIONS ===
    
    async saveToDatabase(message) {
        try {
            // Validate message exists
            if (!message || !message.role || !message.content) {
                console.warn('CompleteChatSystem: saveToDatabase called with invalid message:', message);
                return;
            }
            
            // Use chat-specific append endpoint to avoid full-project saves and duplicates
            const ts = typeof message.timestamp === 'string' ? (Date.parse(message.timestamp)/1000|0) : (message.timestamp || Math.floor(Date.now()/1000));
            const sessionId = this.currentChatId || 'default';
            const ok = await this.api.appendChatMessage(sessionId, message.role, message.content, ts);
            if (!ok) {
                console.warn('CompleteChatSystem: appendChatMessage reported failure');
            }
        } catch (error) {
            console.error('CompleteChatSystem: Failed to append chat message:', error);
        }
    }

    async loadChatHistory() {
        if (this.isLoadingHistory || this.chatHistoryLoaded) {
            return; // Already loading or loaded
        }
        
        this.isLoadingHistory = true;
        this.isLoadingFromDatabase = true;  // Prevent circular updates
        
        try {
            // Show loading indicator
            if (this.elements.chatMessages && !this.elements.chatMessages.querySelector('.chat-loading')) {
                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'chat-loading';
                loadingDiv.innerHTML = '<div class="loading-spinner"></div><span>Loading chat history...</span>';
                this.elements.chatMessages.appendChild(loadingDiv);
            }
            
            // Load latest page without blocking UI paint
            const chatPromise = this.api.loadChatHistoryPage(this.pageSize, null, 800);
            chatPromise.then((chatHistoryArray) => {
                const loadingDiv = this.elements.chatMessages?.querySelector('.chat-loading');
                if (loadingDiv) loadingDiv.remove();

                if (chatHistoryArray && Array.isArray(chatHistoryArray) && chatHistoryArray.length > 0) {
                    const normalized = chatHistoryArray.map(m => {
                        // Preserve timestamp properly - convert to Unix seconds if needed, but keep original format
                        let ts = m.timestamp;
                        if (!ts) {
                            // If no timestamp, use created_at or current time
                            ts = m.created_at || Math.floor(Date.now() / 1000);
                        } else if (typeof ts === 'string') {
                            // Parse ISO string or try Unix timestamp
                            const parsed = Date.parse(ts);
                            ts = isNaN(parsed) ? (parseInt(ts) || Math.floor(Date.now() / 1000)) : Math.floor(parsed / 1000);
                        } else if (typeof ts === 'number') {
                            // Ensure it's in seconds (not milliseconds)
                            ts = ts < 10000000000 ? ts : Math.floor(ts / 1000);
                        }
                        return {
                            id: m.id || `${m.role}_${ts}_${Math.random().toString(36).substr(2, 5)}`,
                            role: m.role,
                            content: m.content,
                            timestamp: ts,
                            metadata: { status: 'loaded' }
                        };
                    }).sort((a,b) => (a.timestamp||0) - (b.timestamp||0));

                    this.allChatMessages = normalized;
                    this.oldestTimestampLoaded = normalized.length ? normalized[0].timestamp : null;
                    this.hasMore = normalized.length === this.pageSize;
                    this.renderedMessageCount = 0;
                    this.messages.clear();
                    if (this.elements.chatMessages) this.elements.chatMessages.innerHTML = '';

                    requestAnimationFrame(() => this.renderNextBatch(Math.min(10, this.pageSize)));
                    this.setupScrollListener();
                } else {
                    this.chatHistoryLoaded = true;
                }

                this.isLoadingHistory = false;
                this.isLoadingFromDatabase = false;
            }).catch(() => {
                const loadingDiv = this.elements.chatMessages?.querySelector('.chat-loading');
                if (loadingDiv) loadingDiv.remove();
                this.isLoadingHistory = false;
                this.isLoadingFromDatabase = false;
                this.chatHistoryLoaded = true;
            });
        } catch (error) {
            console.error('CompleteChatSystem: Failed to start chat history load:', error);
            this.isLoadingHistory = false;
            this.isLoadingFromDatabase = false;
        }
    }
    
    setupScrollListener() {
        if (!this.elements.chatMessages) return;
        
        const messagesContainer = this.elements.chatMessages;
        let isScrolling = false;
        
        messagesContainer.addEventListener('scroll', () => {
            // Throttle scroll events
            if (isScrolling) return;
            isScrolling = true;
            
            requestAnimationFrame(() => {
                // If near top, fetch older page
                if (messagesContainer.scrollTop < 100) {
                    this.fetchOlderMessages();
                }
                
                isScrolling = false;
            });
        });
    }
    
    renderNextBatch(batchSize = 10) {
        const startIndex = this.renderedMessageCount;
        const endIndex = Math.min(startIndex + batchSize, this.allChatMessages.length);
        if (!this.elements.chatMessages) return;

        const fragment = document.createDocumentFragment();
        
        // Render messages in reverse order (oldest first)
        for (let i = startIndex; i < endIndex; i++) {
            const message = this.allChatMessages[i];
            if (!message || !message.role || !message.content) continue;

            // Preserve original timestamp or convert Unix timestamp to ISO string for display
            let displayTimestamp = message.timestamp;
            if (typeof displayTimestamp === 'number') {
                // Convert Unix timestamp (seconds) to ISO string for consistency
                displayTimestamp = new Date(displayTimestamp * 1000).toISOString();
            } else if (!displayTimestamp) {
                // Only use current time as last resort
                displayTimestamp = new Date().toISOString();
            }
            
            const fullMessage = {
                id: message.id || `${message.role}_${message.timestamp || Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                role: message.role,
                content: message.content,
                timestamp: displayTimestamp,
                metadata: { retryCount: 0, status: 'loaded' }
            };

            // Strong-key dedupe on load
            const key = this.makeMessageKey(fullMessage);
            if (this.messageKeys.has(key)) continue;
            this.messageKeys.add(key);

            // Track locally (no DB save for loaded batches)
            this.messages.set(fullMessage.id, fullMessage);

            // Build element without touching DOM repeatedly
            const msgEl = this.createMessageElement(fullMessage);
            fragment.appendChild(msgEl);
        }

        // Single append to DOM (one layout/paint)
        this.elements.chatMessages.appendChild(fragment);
        this.scrollToBottom();

        this.renderedMessageCount = endIndex;
        if (this.renderedMessageCount >= this.allChatMessages.length) {
            this.chatHistoryLoaded = true;
        }
    }

    async fetchOlderMessages() {
        if (this.isFetchingOlder || !this.hasMore) return;
        this.isFetchingOlder = true;
        try {
            const before = this.oldestTimestampLoaded;
            if (!before) { this.hasMore = false; return; }
            const older = await this.api.loadChatHistoryPage(this.pageSize, before);
            if (!older || older.length === 0) {
                this.hasMore = false;
                return;
            }

            // Normalize and sort ascending
            const normalized = older.map(m => {
                // Preserve timestamp properly
                let ts = m.timestamp;
                if (!ts) {
                    ts = m.created_at || Math.floor(Date.now() / 1000);
                } else if (typeof ts === 'string') {
                    const parsed = Date.parse(ts);
                    ts = isNaN(parsed) ? (parseInt(ts) || Math.floor(Date.now() / 1000)) : Math.floor(parsed / 1000);
                } else if (typeof ts === 'number') {
                    ts = ts < 10000000000 ? ts : Math.floor(ts / 1000);
                }
                return {
                    id: m.id || `${m.role}_${ts}_${Math.random().toString(36).substr(2, 5)}`,
                    role: m.role,
                    content: m.content,
                    timestamp: ts,
                    metadata: { status: 'loaded' }
                };
            }).sort((a,b) => (a.timestamp||0) - (b.timestamp||0));

            // Prepend to allChatMessages
            this.allChatMessages = [...normalized, ...this.allChatMessages];
            this.oldestTimestampLoaded = this.allChatMessages[0]?.timestamp || this.oldestTimestampLoaded;

            // Render the newly fetched items (prepend in DOM)
            normalized.forEach(msg => {
                if (!this.messages.has(msg.id)) {
                    const key = this.makeMessageKey(msg);
                    if (!this.messageKeys.has(key)) {
                        this.messageKeys.add(key);
                        this.messages.set(msg.id, msg);
                        this.renderMessage(msg, true);
                    }
                }
            });
        } catch (e) {
            console.error('fetchOlderMessages failed:', e);
        } finally {
            this.isFetchingOlder = false;
        }
    }

    setupAutoSave() {
        // Individual messages are saved immediately when added via addMessage()
        // No need for interval-based auto-save - messages persist in real-time
        // This method is kept for future extensibility but currently does nothing
    }

    // === AI IDEA EXTRACTION ===
    
    parseIdeasFromResponse(response) {
        const ideas = [];
        
        // Look for patterns like "I've added X to your ideas" or "Here's an idea: X"
        const patterns = [
            /I've added ["']([^"']+)["'] to your ideas/i,
            /added ["']([^"']+)["'] to your ideas/i,
            /Here are some fresh ideas: ["']([^"']+)["']/i,
            /Here are some ideas: ["']([^"']+)["']/i,
            /Here's an idea: ["']?([^"'\n]+)["']?/i,
            /Here is an idea: ["']?([^"'\n]+)["']?/i,
            /suggestion: ["']?([^"'\n]+)["']?/i,
            /consider: ["']?([^"'\n]+)["']?/i,
            /idea: ["']?([^"'\n]+)["']?/i,
            /["']([^"']+)["']/g  // Match any quoted text as potential ideas
        ];
        
        patterns.forEach((pattern, index) => {
            if (pattern.global) {
                // Handle global patterns (like the last one for quoted text)
                let match;
                while ((match = pattern.exec(response)) !== null) {
                    if (match[1]) {
                        const idea = match[1].trim();
                        if (idea.length > 3 && idea.length < 100 && !ideas.includes(idea)) {
                            ideas.push(idea);
                        }
                    }
                }
            } else {
                // Handle single match patterns
                const matches = response.match(pattern);
                if (matches && matches[1]) {
                    const idea = matches[1].trim();
                    if (idea.length > 3 && idea.length < 100 && !ideas.includes(idea)) {
                        ideas.push(idea);
                    }
                }
            }
        });
        
        return ideas;
    }
    
    async addIdeasToBrainstorm(ideas) {
        console.log('IDEAS DEBUG: addIdeasToBrainstorm called with:', ideas);
        if (!ideas || ideas.length === 0) {
            console.log('IDEAS DEBUG: No ideas to add');
            return;
        }
        
        try {
            // Get the PlanModule from the AIWritingAssistant instance
            console.log('IDEAS DEBUG: Getting projectManager:', this.projectManager);
            console.log('IDEAS DEBUG: Getting AIWritingAssistant from window:', window.aiWritingAssistant);
            
            // Try to get PlanModule from AIWritingAssistant
            const aiWritingAssistant = window.aiWritingAssistant;
            const planModule = aiWritingAssistant?.modules?.plan;
            
            console.log('IDEAS DEBUG: PlanModule from AIWritingAssistant:', planModule);
            
            if (planModule && planModule.addIdeaBubble) {
                console.log('IDEAS DEBUG: PlanModule has addIdeaBubble method');
                for (const idea of ideas) {
                    console.log('IDEAS DEBUG: Processing idea:', idea);
                    // Check if idea already exists
                    const existingIdeas = Array.from(planModule.bubbles.values())
                        .map(bubble => bubble.content.toLowerCase());
                    console.log('IDEAS DEBUG: Existing ideas:', existingIdeas);
                    
                    if (!existingIdeas.includes(idea.toLowerCase())) {
                        console.log('IDEAS DEBUG: Adding new idea:', idea);
                        planModule.addIdeaBubble(idea);
                        console.log('IDEAS DEBUG: Idea added successfully');
                    } else {
                        console.log('IDEAS DEBUG: Idea already exists, skipping:', idea);
                    }
                }
            } else {
                console.error('IDEAS DEBUG: PlanModule not found or addIdeaBubble method missing', {
                    aiWritingAssistant: aiWritingAssistant,
                    modules: aiWritingAssistant?.modules,
                    plan: aiWritingAssistant?.modules?.plan,
                    hasAddIdeaBubble: planModule?.addIdeaBubble
                });
            }
        } catch (error) {
            console.error('CompleteChatSystem: Error adding ideas to brainstorm:', error);
        }
    }

    // === REGENERATION ===
    
    async regenerateMessage(message) {
        if (message.role !== 'assistant') return;
        
        try {
            // Find the user message that prompted this response
            const messagesArray = Array.from(this.messages.values());
            const messageIndex = messagesArray.findIndex(msg => msg.id === message.id);
            
            if (messageIndex > 0) {
                const userMessage = messagesArray[messageIndex - 1];
                if (userMessage.role === 'user') {
                    // Remove the current assistant message
                    this.removeMessage(message.id);
                    
                    // Show typing indicator
                    this.showTypingIndicator();
                    
                    // Regenerate response
                    const aiResponse = await this.getAIResponse(userMessage.content);
                    
                    // Hide typing indicator
                    this.hideTypingIndicator();
                    
                    // Add the new assistant response
                    const newAssistantMessage = this.createMessage('assistant', aiResponse);
                    await this.addMessage(newAssistantMessage);
                }
            }
        } catch (error) {
            console.error('CompleteChatSystem: Error regenerating message:', error);
            this.hideTypingIndicator();
        }
    }

    async regenerateLastMessage() {
        const messagesArray = Array.from(this.messages.values());
        if (messagesArray.length >= 2) {
            const lastMessage = messagesArray[messagesArray.length - 1];
            await this.regenerateMessage(lastMessage);
        }
    }

    clearChat() {
        // Clear local messages
        this.messages.clear();
        
        // Clear UI
        if (this.elements.chatMessages) {
            this.elements.chatMessages.innerHTML = '';
        }
        
        // Update global state
        this.updateGlobalState();
        
    }

    removeMessage(messageId) {
        // Remove from local storage
        this.messages.delete(messageId);
        
        // Remove from DOM
        const messageElement = this.elements.chatMessages.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.remove();
        }
        
        // Update global state
        this.updateGlobalState();
    }

    // === PUBLIC API ===
    
    getMessages() {
        return Array.from(this.messages.values());
    }

    getMessageCount() {
        return this.messages.size;
    }

    clearMessages() {
        this.messages.clear();
        if (this.elements.chatMessages) {
            this.elements.chatMessages.innerHTML = '';
        }
        this.updateGlobalState();
    }

    loadMessages(messages) {
        if (!Array.isArray(messages)) {
            console.warn('CompleteChatSystem: loadMessages called with non-array:', messages);
            return;
        }
        
        this.messages.clear();
        if (this.elements.chatMessages) {
            this.elements.chatMessages.innerHTML = '';
        }
        
        messages.forEach(message => {
            // Ensure message has required fields
            if (message.role && message.content) {
                const fullMessage = {
                    id: message.id || `${message.role}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    role: message.role,
                    content: message.content,
                    timestamp: message.timestamp || new Date().toISOString(),
                    metadata: message.metadata || { retryCount: 0, status: 'loaded' }
                };
                this.messages.set(fullMessage.id, fullMessage);
                this.renderMessage(fullMessage);
            }
        });
        
        this.updateGlobalState();
    }
}
