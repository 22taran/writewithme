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
                tab: null, // No tab element
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

        // Update active tab (if tabs exist)
        if (this.elements.chatTabs) {
            document.querySelectorAll('.chat-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            const activeTab = document.querySelector(`[data-chat-id="${chatId}"]`);
            if (activeTab) {
                activeTab.classList.add('active');
            }
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

        // Remove tab if it exists
        if (chat.tab) {
            chat.tab.remove();
        }

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
            if (chat.tab) {
                const titleElement = chat.tab.querySelector('.chat-tab-title');
                if (titleElement) {
                    titleElement.textContent = newTitle;
                }
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
        this.pageSize = 50; // Increased from 20 to load more messages initially
        this.isFetchingOlder = false;
        this.hasMore = true;
        this.oldestTimestampLoaded = null; // oldest ts in allChatMessages
        this.messageKeys = new Set(); // strong dedupe: role|ts|content

        this.makeMessageKey = (m) => {
            // Normalize timestamp to ISO string for consistent deduplication
            // Must handle both ISO strings and MySQL TIMESTAMP format (YYYY-MM-DD HH:MM:SS)
            let ts = m.timestamp;
            if (!ts) {
                ts = new Date().toISOString();
            } else if (typeof ts === 'string') {
                // Check if it's MySQL TIMESTAMP format (YYYY-MM-DD HH:MM:SS)
                if (ts.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
                    // MySQL TIMESTAMP format - convert to ISO string
                    const date = new Date(ts.replace(' ', 'T') + 'Z');
                    ts = date.toISOString();
                } else if (ts.includes('T')) {
                    // Already ISO string - use as-is
                    ts = ts;
                } else {
                    // Try to parse as date and convert to ISO
                    const date = new Date(ts);
                    ts = isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
                }
            } else if (typeof ts === 'number') {
                // Convert Unix timestamp to ISO string
                ts = ts < 10000000000
                    ? new Date(ts * 1000).toISOString()
                    : new Date(ts).toISOString();
            } else {
                ts = new Date().toISOString();
            }
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
        // Use ISO string for TIMESTAMP/TIMESTAMPTZ compatibility
        const timestamp = new Date().toISOString();
        const id = `${role}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        return {
            id,
            role,
            content,
            timestamp, // ISO string - compatible with TIMESTAMP/TIMESTAMPTZ
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
        // Normalize timestamps to milliseconds for comparison
        const normalizeTimestamp = (ts) => {
            if (!ts) return Date.now();
            if (typeof ts === 'string') {
                const parsed = Date.parse(ts);
                return isNaN(parsed) ? Date.now() : parsed;
            } else if (typeof ts === 'number') {
                return ts < 10000000000 ? ts * 1000 : ts;
            }
            return Date.now();
        };

        const messageTime = normalizeTimestamp(message.timestamp);
        const now = Date.now();

        const recentMessages = Array.from(this.messages.values())
            .filter(msg => {
                if (msg.role !== message.role) return false;
                const msgTime = normalizeTimestamp(msg.timestamp);
                return (now - msgTime) < 5000; // Within last 5 seconds
            });

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


        const contentDiv = createElement('div', 'message-content');

        // Render markdown if libraries are available
        if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
            try {
                // Configure marked to handle line breaks correctly
                marked.setOptions({
                    breaks: true,
                    gfm: true
                });
                const rawHtml = marked.parse(message.content);
                const cleanHtml = DOMPurify.sanitize(rawHtml);
                contentDiv.innerHTML = cleanHtml;
                contentDiv.classList.add('markdown-rendered');
            } catch (e) {
                console.error('CompleteChatSystem: Error parsing markdown:', e);
                contentDiv.textContent = message.content;
            }
        } else {
            contentDiv.textContent = message.content;
        }

        // Ensure we have a valid timestamp for display
        // Convert Unix seconds to ISO string only for display
        let displayTime = message.timestamp;
        if (typeof displayTime === 'number') {
            // Unix seconds - convert to ISO for display
            displayTime = new Date(displayTime * 1000).toISOString();
        } else if (typeof displayTime === 'string') {
            // Already a string, use as-is
            displayTime = displayTime;
        } else {
            displayTime = new Date().toISOString();
        }
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
            <span class="typing-text">AI is thinking...</span>
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
            // Check if it's MySQL TIMESTAMP format (YYYY-MM-DD HH:MM:SS)
            if (timestamp.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
                // MySQL TIMESTAMP format - database stores in UTC but returns without timezone
                // Parse as UTC by adding 'Z' suffix, then JavaScript will convert to local time
                date = new Date(timestamp.replace(' ', 'T') + 'Z');
            } else {
                // Try to parse as ISO string (may include timezone info)
                date = new Date(timestamp);
                // If invalid, try parsing as Unix timestamp
                if (isNaN(date.getTime())) {
                    date = new Date(parseInt(timestamp) * 1000);
                }
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

        // Use toLocaleTimeString which will display in user's local timezone
        // The date object is already in UTC, so this will convert to local time automatically
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
                    this.elements.userInput.style.height = 'auto'; // Reset height
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
            // Auto-resize textarea
            this.autoResizeHandler = () => {
                const textarea = this.elements.userInput;
                textarea.style.height = 'auto';
                const newHeight = Math.min(textarea.scrollHeight, 120); // Max 120px
                textarea.style.height = `${newHeight}px`;
            };
            this.elements.userInput.addEventListener('input', this.autoResizeHandler);

            // Enter key handler
            this.keypressHandler = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const content = this.elements.userInput.value.trim();
                    if (content) {
                        this.elements.userInput.value = '';
                        this.elements.userInput.style.height = 'auto'; // Reset height
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
            this.eventHandlers.set('userInputResize', {
                element: this.elements.userInput,
                handler: this.autoResizeHandler,
                event: 'input'
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
        // Ensure timestamps are ISO strings (compatible with TIMESTAMP/TIMESTAMPTZ)
        currentState.chatHistory = Array.from(this.messages.values()).map(msg => {
            let ts = msg.timestamp;
            // Normalize to ISO string if needed
            if (typeof ts === 'string') {
                // Already ISO string - use as-is
                ts = ts;
            } else if (typeof ts === 'number') {
                // Convert Unix timestamp to ISO string
                ts = ts < 10000000000
                    ? new Date(ts * 1000).toISOString()
                    : new Date(ts).toISOString();
            } else {
                ts = new Date().toISOString();
            }
            return {
                role: msg.role,
                content: msg.content,
                timestamp: ts // Always ISO string (compatible with TIMESTAMP/TIMESTAMPTZ)
            };
        });
        this.globalState.setState(currentState);
    }

    // === DATABASE OPERATIONS ===

    async saveToDatabase(message) {
        try {
            // Validate message exists
            if (!message || !message.role || !message.content) {
                console.warn('CompleteChatSystem: saveToDatabase called with invalid message:', message);
                return false;
            }

            // Normalize timestamp to ISO string - matches TIMESTAMP/TIMESTAMPTZ format
            let ts = message.timestamp;
            if (typeof ts === 'string') {
                // Already ISO string - use as-is
                ts = ts;
            } else if (typeof ts === 'number') {
                // Convert Unix timestamp to ISO string
                ts = ts < 10000000000
                    ? new Date(ts * 1000).toISOString()
                    : new Date(ts).toISOString();
            } else {
                ts = new Date().toISOString();
            }

            const sessionId = this.currentChatId || 'default';
            const ok = await this.api.appendChatMessage(sessionId, message.role, message.content, ts);

            if (!ok) {
                console.error('CompleteChatSystem: appendChatMessage reported failure');
                return false;
            }

            return true;
        } catch (error) {
            console.error('CompleteChatSystem: Failed to append chat message:', error);
            console.error('CompleteChatSystem: Error stack:', error.stack);
            return false;
        }
    }

    async loadChatHistory(forceReload = false) {
        // Allow force reload to bypass cache
        if (!forceReload && (this.isLoadingHistory || this.chatHistoryLoaded)) {
            return; // Already loading or loaded
        }

        // Reset state if forcing reload
        if (forceReload) {
            this.chatHistoryLoaded = false;
            this.allChatMessages = [];
            this.renderedMessageCount = 0;
            this.messageKeys.clear();
            this.messages.clear();
            if (this.elements.chatMessages) {
                this.elements.chatMessages.innerHTML = '';
            }
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
                        // Normalize timestamp to ISO string for consistent deduplication
                        // Database returns TIMESTAMP as "YYYY-MM-DD HH:MM:SS" string
                        let ts = m.timestamp;
                        if (!ts) {
                            // If no timestamp, use created_at or current time
                            ts = m.created_at
                                ? (typeof m.created_at === 'string' ? m.created_at : new Date(m.created_at * 1000).toISOString())
                                : new Date().toISOString();
                        } else if (typeof ts === 'string') {
                            // Check if it's MySQL TIMESTAMP format (YYYY-MM-DD HH:MM:SS)
                            if (ts.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
                                // MySQL TIMESTAMP format - convert to ISO string for consistency
                                // Parse as UTC and convert to ISO string
                                const date = new Date(ts.replace(' ', 'T') + 'Z');
                                ts = date.toISOString();
                            } else if (ts.includes('T')) {
                                // Already ISO string - use as-is
                                ts = ts;
                            } else {
                                // Try to parse as date and convert to ISO
                                const date = new Date(ts);
                                ts = isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
                            }
                        } else if (typeof ts === 'number') {
                            // Convert Unix timestamp to ISO string
                            ts = ts < 10000000000
                                ? new Date(ts * 1000).toISOString()
                                : new Date(ts).toISOString();
                        } else {
                            ts = new Date().toISOString();
                        }

                        return {
                            id: m.id || `${m.role}_${Date.parse(ts)}_${Math.random().toString(36).substr(2, 5)}`,
                            role: m.role,
                            content: m.content,
                            timestamp: ts, // ISO string for consistent deduplication
                            metadata: { status: 'loaded' }
                        };
                    }).sort((a, b) => {
                        // Sort by timestamp (ISO strings can be compared directly)
                        const timeA = Date.parse(a.timestamp || 0);
                        const timeB = Date.parse(b.timestamp || 0);
                        return timeA - timeB;
                    });

                    this.allChatMessages = normalized;
                    // After sorting ASC, first message is oldest, last is newest
                    this.oldestTimestampLoaded = normalized.length ? normalized[0].timestamp : null;
                    // Check if there are more messages (if we got a full page, there might be more)
                    // We need to check if there are messages older than the oldest we loaded
                    this.hasMore = normalized.length >= this.pageSize;
                    this.renderedMessageCount = 0;
                    this.messages.clear();
                    if (this.elements.chatMessages) this.elements.chatMessages.innerHTML = '';

                    // Render all messages immediately (no lazy loading for initial load)
                    // This ensures all messages are visible right away
                    requestAnimationFrame(() => {
                        this.renderNextBatch(this.allChatMessages.length);
                    });
                    this.setupScrollListener();
                    this.chatHistoryLoaded = true;
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

        if (!this.elements.chatMessages) {
            return;
        }

        const fragment = document.createDocumentFragment();
        let renderedCount = 0;

        // Render messages in reverse order (oldest first)
        for (let i = startIndex; i < endIndex; i++) {
            const message = this.allChatMessages[i];
            if (!message || !message.role || !message.content) {
                console.warn('CompleteChatSystem: Skipping invalid message at index', i, message);
                continue;
            }

            // Normalize timestamp to ISO string for consistent deduplication
            let ts = message.timestamp;
            if (!ts) {
                ts = new Date().toISOString();
            } else if (typeof ts === 'string') {
                // Check if it's MySQL TIMESTAMP format (YYYY-MM-DD HH:MM:SS)
                if (ts.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
                    // MySQL TIMESTAMP format - convert to ISO string
                    const date = new Date(ts.replace(' ', 'T') + 'Z');
                    ts = date.toISOString();
                } else if (ts.includes('T')) {
                    // Already ISO string - use as-is
                    ts = ts;
                } else {
                    // Try to parse as date and convert to ISO
                    const date = new Date(ts);
                    ts = isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
                }
            } else if (typeof ts === 'number') {
                // Convert Unix timestamp to ISO string
                ts = ts < 10000000000
                    ? new Date(ts * 1000).toISOString()
                    : new Date(ts).toISOString();
            } else {
                ts = new Date().toISOString();
            }

            const fullMessage = {
                id: message.id || `${message.role}_${Date.parse(ts)}_${Math.random().toString(36).substr(2, 9)}`,
                role: message.role,
                content: message.content,
                timestamp: ts, // ISO string - compatible with TIMESTAMP/TIMESTAMPTZ
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
            renderedCount++;
        }

        // Single append to DOM (one layout/paint)
        if (renderedCount > 0) {
            this.elements.chatMessages.appendChild(fragment);
            this.scrollToBottom();
        }

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
                // Preserve timestamp as ISO string - database returns TIMESTAMP as string
                // MySQL: "YYYY-MM-DD HH:MM:SS", PostgreSQL: ISO string
                let ts = m.timestamp;
                if (!ts) {
                    ts = m.created_at
                        ? (typeof m.created_at === 'string' ? m.created_at : new Date(m.created_at * 1000).toISOString())
                        : new Date().toISOString();
                } else if (typeof ts === 'string') {
                    // Check if it's MySQL TIMESTAMP format (YYYY-MM-DD HH:MM:SS) or ISO
                    if (ts.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
                        // MySQL TIMESTAMP format - keep as-is for now
                        // The formatTime function will handle parsing it correctly
                        // Don't convert to ISO here as it would shift timezone
                        ts = ts;
                    } else {
                        // Already ISO string - use as-is
                        ts = ts;
                    }
                } else if (typeof ts === 'number') {
                    // Convert Unix timestamp to ISO string
                    ts = ts < 10000000000
                        ? new Date(ts * 1000).toISOString()
                        : new Date(ts).toISOString();
                }
                return {
                    id: m.id || `${m.role}_${Date.parse(ts)}_${Math.random().toString(36).substr(2, 5)}`,
                    role: m.role,
                    content: m.content,
                    timestamp: ts, // ISO string - compatible with TIMESTAMP/TIMESTAMPTZ
                    metadata: { status: 'loaded' }
                };
            }).sort((a, b) => {
                // Sort by timestamp (ISO strings can be compared directly)
                const timeA = Date.parse(a.timestamp || 0);
                const timeB = Date.parse(b.timestamp || 0);
                return timeA - timeB;
            });

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

        // Don't overwrite if we're currently loading from database (prevents race condition)
        if (this.isLoadingHistory || this.isLoadingFromDatabase) {
            return;
        }

        // Don't overwrite if we've already loaded from database
        // This prevents old cached state from overwriting fresh database data
        if (this.chatHistoryLoaded) {
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
