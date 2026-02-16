// DOM manipulation and UI components for the writing assistant

// Display version information when the module loads
if (window.versionInfo) {
    console.log('DOM.js module loaded');
}

// Configure Quill editor with custom font sizes and toolbar options
const Size = Quill.import('attributors/style/size');
Size.whitelist = ['8pt', '10pt', '12pt', '14pt', '16pt', '18pt', '24pt', '36pt'];
Quill.register(Size, true);

const quillConfig = {
    theme: 'snow',
    modules: {
        toolbar: [
            ['bold', 'italic', 'underline', 'strike'],
            ['blockquote', 'code-block'],
            [{ 'header': 1 }, { 'header': 2 }],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'script': 'sub' }, { 'script': 'super' }],
            [{ 'indent': '-1' }, { 'indent': '+1' }],
            [{ 'direction': 'rtl' }],
            [{ 'size': ['8pt', '10pt', '12pt', '14pt', '16pt', '18pt', '24pt', '36pt'] }],
            [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'font': [] }],
            [{ 'align': [] }],
            ['clean']
        ]
    }
};

// Manages DOM elements and event listeners to prevent memory leaks
class DOMManager {
    constructor() {
        this.elements = {}; // Cache for frequently accessed elements
        this.eventListeners = new Map(); // Track event listeners for cleanup
    }

    // Get DOM element by ID, with caching to avoid repeated queries
    getElement(id, selector = null) {
        // Don't cache null/undefined values - retry each time if element wasn't found
        if (!this.elements[id]) {
            const element = selector ? document.querySelector(selector) : document.getElementById(id);
            if (element) {
                this.elements[id] = element;
            }
            return element;
        }
        return this.elements[id];
    }

    // Clear the element cache (useful for dynamic content)
    clearCache() {
        this.elements = {};
    }

    // Add event listener with duplicate prevention
    addEventListener(element, event, handler, options = {}) {
        if (!element) return;

        const key = `${element.id || 'unknown'}_${event}`;
        const handlers = this.eventListeners.get(key) || [];

        // Only add if not already added (prevents duplicate listeners)
        if (!handlers.includes(handler)) {
            handlers.push(handler);
            this.eventListeners.set(key, handlers);
            element.addEventListener(event, handler, options);
        }
    }

    removeEventListeners(element, event = null) {
        const key = event ? `${element.id || 'unknown'}_${event}` : element.id || 'unknown';
        const handlers = this.eventListeners.get(key);

        if (handlers) {
            handlers.forEach(handler => element.removeEventListener(event, handler));
            this.eventListeners.delete(key);
        }
    }

    cleanup() {
        this.eventListeners.forEach((handlers, key) => {
            const [elementId, event] = key.split('_');
            const element = this.getElement(elementId);
            handlers.forEach(handler => element?.removeEventListener(event, handler));
        });
        this.eventListeners.clear();
    }
}

// Represents a draggable idea bubble that can be moved between brainstorm and outline
class BubbleComponent {
    constructor(content = ' ', id = null, aiGenerated = false) {
        this.id = id || generateId();
        this.content = content;
        this.aiGenerated = aiGenerated;
        this.element = this.createBubble();
    }

    createBubble() {
        const bubble = createElement('div', 'idea-bubble');
        bubble.dataset.id = this.id;

        // Add AI-generated class if applicable
        if (this.aiGenerated) {
            bubble.classList.add('ai-generated');
            bubble.dataset.aiGenerated = 'true';
        }

        const contentDiv = createElement('div', 'bubble-content', this.content);
        const deleteBtn = createElement('button', 'delete-bubble-btn', '×');

        // Add delete functionality
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.delete();
        });

        bubble.appendChild(contentDiv);
        bubble.appendChild(deleteBtn);

        // Make content editable only if not AI-generated
        if (!this.aiGenerated) {
            contentDiv.contentEditable = true;

            // Add event listener for content changes
            contentDiv.addEventListener('input', () => {
                this.content = contentDiv.textContent;
                // Emit custom event for content change
                bubble.dispatchEvent(new CustomEvent('bubbleContentChanged', {
                    detail: { bubbleId: this.id, content: this.content },
                    bubbles: true,
                    composed: true
                }));
            });
        } else {
            // Add AI label for AI-generated bubbles
            const aiLabel = createElement('span', 'ai-label', 'AI');
            contentDiv.appendChild(aiLabel);
        }

        return bubble;
    }

    setContent(content) {
        this.content = content;
        const contentDiv = this.element.querySelector('.bubble-content');
        if (contentDiv) {
            contentDiv.textContent = content;
        }
    }

    getContent() {
        const contentDiv = this.element.querySelector('.bubble-content');
        return contentDiv ? contentDiv.textContent : this.content;
    }

    setLocation(location, sectionId = null) {
        // Update internal state
        this.location = location;
        this.sectionId = sectionId;

        // Update DOM element
        this.element.dataset.location = location;
        if (sectionId) {
            this.element.dataset.sectionId = sectionId;
        }
    }

    delete() {
        // Emit custom event for bubble deletion (PlanModule will handle DB + DOM)
        this.element.dispatchEvent(new CustomEvent('bubbleDeleted', {
            detail: { bubbleId: this.id },
            bubbles: true,
            composed: true
        }));
    }

    destroy() {
        if (this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

class SectionComponent {
    constructor(sectionData) {
        this.id = sectionData.id;
        this.title = sectionData.title;
        this.description = sectionData.description;
        this.required = sectionData.required || false;
        this.isCustom = sectionData.isCustom || false; // Track if this is a user-created section
        this.element = this.createSection();
    }

    createSection() {
        const sectionDiv = createElement('div', 'template-section');
        sectionDiv.dataset.sectionId = this.id;

        const sectionHeader = createElement('div', 'section-header');

        // Title with edit capability
        const sectionTitle = createElement('h4', 'section-title', this.title);
        sectionTitle.contentEditable = true;
        sectionTitle.dataset.sectionId = this.id;
        sectionTitle.setAttribute('spellcheck', 'false');

        // Add event listeners for saving title changes
        let titleDebounceTimer = null;
        sectionTitle.addEventListener('input', () => {
            // Clear any pending save
            if (titleDebounceTimer) {
                clearTimeout(titleDebounceTimer);
            }
        });

        sectionTitle.addEventListener('blur', () => {
            const newTitle = sectionTitle.textContent.trim();
            if (newTitle && newTitle !== this.title) {
                this.title = newTitle;
                // Trigger save via custom event
                const event = new CustomEvent('sectionTitleChanged', {
                    detail: { sectionId: this.id, newTitle: newTitle },
                    bubbles: true
                });
                sectionTitle.dispatchEvent(event);
            } else if (!newTitle) {
                // Restore original if empty
                sectionTitle.textContent = this.title;
            }
        });

        sectionHeader.appendChild(sectionTitle);

        // Add delete button for ALL sections (users can remove any section they don't want)
        const deleteBtn = createElement('button', 'section-delete-btn');
        deleteBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3L3 9M3 3l6 6"/></svg>';
        deleteBtn.title = this.isCustom ? 'Delete this section' : 'Remove this section from outline';
        deleteBtn.setAttribute('aria-label', 'Delete section');
        deleteBtn.dataset.sectionId = this.id;
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // Dispatch custom event for section deletion/removal
            const event = new CustomEvent('sectionDeleted', {
                detail: { sectionId: this.id, isCustom: this.isCustom },
                bubbles: true,
                composed: true
            });
            this.element.dispatchEvent(event);
        });
        sectionHeader.appendChild(deleteBtn);

        sectionDiv.appendChild(sectionHeader);

        // Add section description if it exists
        if (this.description) {
            const sectionDescription = createElement('p', 'section-description', this.description);
            sectionDiv.appendChild(sectionDescription);
        }

        const outlineContainer = createElement('div', 'outline-container outline-dropzone');
        outlineContainer.dataset.sectionId = this.id;

        // Add dropzone placeholder text when empty
        outlineContainer.classList.add('empty');
        const placeholder = createElement('div', 'dropzone-placeholder', 'Drop ideas here to create outline items');
        placeholder.draggable = false;
        outlineContainer.appendChild(placeholder);

        sectionDiv.appendChild(outlineContainer);

        return sectionDiv;
    }

    addBubble(bubble) {
        const outlineContainer = this.element.querySelector('.outline-container');
        if (outlineContainer) {
            // Remove placeholder if it exists
            if (outlineContainer.classList.contains('empty')) {
                outlineContainer.classList.remove('empty');
                outlineContainer.innerHTML = '';
            }
            outlineContainer.appendChild(bubble.element);
        }
    }

    removeBubble(bubbleId) {
        const bubble = this.element.querySelector(`[data-id="${bubbleId}"]`);
        if (bubble) {
            bubble.remove();

            // Add placeholder back if no bubbles remain
            const outlineContainer = this.element.querySelector('.outline-container');
            if (outlineContainer && outlineContainer.children.length === 0) {
                outlineContainer.classList.add('empty');
                const placeholder = createElement('div', 'dropzone-placeholder', 'Drop ideas here to create outline items');
                placeholder.draggable = false;
                outlineContainer.appendChild(placeholder);
            }
        }
    }

    getBubbles() {
        const outlineContainer = this.element.querySelector('.outline-container');
        if (!outlineContainer) return [];

        return Array.from(outlineContainer.querySelectorAll('.idea-bubble')).map(bubble => ({
            id: bubble.dataset.id,
            content: bubble.querySelector('.bubble-content').textContent,
            aiGenerated: bubble.dataset.aiGenerated === 'true'
        }));
    }

    setTitle(title) {
        this.title = title;
        const titleElement = this.element.querySelector('.section-title');
        if (titleElement) {
            titleElement.textContent = title;
        }
    }

    destroy() {
        if (this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

// ---- Tab Management ----
// Simple, reliable tab switching system
class TabManager {
    constructor(globalState, projectManager) {
        console.log('>>> TabManager constructor called - CACHE REFRESH TEST');
        this.globalState = globalState;
        this.projectManager = projectManager;
        this.currentTab = 'plan';
        this.init();
        console.log('>>> TabManager initialized - CACHE REFRESH TEST');
    }

    init() {
        // Ensure goal element is always a read-only div (not a textarea)
        // This prevents any cached JavaScript from creating a textarea
        this.ensureGoalIsReadOnly();

        this.setupTabs();
        // Note: setupTabs() calls switchTab('plan') which already calls updateGoalForTab()
        // So no need to call it again here
    }

    ensureGoalIsReadOnly() {
        const goalElement = document.getElementById('assignmentGoal');
        if (goalElement && goalElement.tagName !== 'DIV') {
            // Replace textarea with div if it exists
            const div = document.createElement('div');
            div.id = 'assignmentGoal';
            div.className = 'goal-field goal-field-readonly';

            // Get goal text from instructor goals or current element value
            const currentTab = this.currentTab || 'plan';
            const instructorGoals = window.instructorGoals || {};
            const goalText = instructorGoals[currentTab] || goalElement.value || '';

            if (goalText) {
                div.textContent = goalText;
            } else {
                div.innerHTML = '<em>No goal set for this phase.</em>';
            }

            const parentNode = goalElement.parentNode;
            if (parentNode) {
                parentNode.replaceChild(div, goalElement);
                console.log('TabManager: Replaced textarea with read-only div for goal element');
            }
        }
    }

    setupTabs() {
        console.log('=== Setting up tabs ===');
        // Find all tab buttons
        const tabButtons = document.querySelectorAll('.tab-btn');
        console.log('Found', tabButtons.length, 'tab buttons');

        // Add click listeners to each tab button
        tabButtons.forEach(button => {
            const tabId = button.getAttribute('data-tab');
            console.log('Setting up tab:', tabId, 'Button:', button);

            button.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Tab clicked:', tabId);
                this.switchTab(tabId);
            });
        });

        // Restore last active tab from localStorage, or default to 'plan'
        const savedTab = localStorage.getItem('researchflow_activeTab');
        const initialTab = savedTab || 'plan';
        console.log('Restoring tab from localStorage:', initialTab);

        // Set initial active tab (this will also call updateGoalForTab via switchTab)
        this.switchTab(initialTab);
        console.log('=== Tab setup complete ===');
    }

    switchTab(tabId) {
        console.log('=== Switching to tab:', tabId, '===');

        // Remove active class from all tab buttons
        const allTabButtons = document.querySelectorAll('.tab-btn');
        console.log('Found', allTabButtons.length, 'tab buttons');
        allTabButtons.forEach(btn => {
            console.log('Removing active from:', btn.dataset.tab, 'Classes:', btn.classList.toString());
            btn.classList.remove('active');
        });

        // Add active class to clicked tab button
        const activeButton = document.querySelector(`[data-tab="${tabId}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
            console.log('Added active to:', tabId, 'Classes:', activeButton.classList.toString());
        } else {
            console.error('Could not find button for tab:', tabId);
        }

        // Hide all tab content
        const allTabContent = document.querySelectorAll('.tab-content');
        allTabContent.forEach(content => {
            content.classList.remove('active');
        });

        // Show selected tab content
        const activeContent = document.getElementById(tabId);
        if (activeContent) {
            activeContent.classList.add('active');
        }

        // Update body class for activity-based styling
        document.body.className = document.body.className.replace(/activity-\w+/g, '');
        document.body.classList.add(`activity-${tabId}`);
        console.log('Updated body class to:', document.body.className);

        // If switching to write tab, populate outline sidebar and update AI tool buttons
        if (tabId === 'write') {
            this.populateWriteOutline();
            // Update AI tool button states when switching to Write tab
            setTimeout(() => {
                if (window.aiWritingAssistant && window.aiWritingAssistant.modules && window.aiWritingAssistant.modules.write) {
                    const writeModule = window.aiWritingAssistant.modules.write;
                    if (writeModule.editor) {
                        const range = writeModule.editor.getSelection();
                        writeModule.updateAIToolButtons(range);
                    }
                }
            }, 100);
        }

        // If switching to edit tab, ensure import button listener is set up
        if (tabId === 'edit') {
            setTimeout(() => {
                if (window.aiWritingAssistant && window.aiWritingAssistant.modules && window.aiWritingAssistant.modules.edit) {
                    const editModule = window.aiWritingAssistant.modules.edit;
                    const importBtn = document.getElementById('importWriteContentBtn');
                    if (importBtn && !importBtn.hasAttribute('data-listener-attached')) {
                        importBtn.addEventListener('click', () => editModule.importWriteContent());
                        importBtn.setAttribute('data-listener-attached', 'true');
                    }
                }
            }, 100);
        }

        // Update goal display for the active tab
        this.updateGoalForTab(tabId);

        // Save active tab to localStorage
        localStorage.setItem('researchflow_activeTab', tabId);

        this.currentTab = tabId;
        console.log('=== Tab switch complete ===');
    }

    updateGoalForTab(tabId) {
        // Get instructor goals from window (set by PHP)
        const instructorGoals = window.instructorGoals || {};

        console.log('TabManager.updateGoalForTab():', {
            tabId,
            instructorGoals,
            hasGoals: !!instructorGoals[tabId]
        });

        // Get goal element
        const goalElement = document.getElementById('assignmentGoal');
        if (!goalElement) {
            console.warn('TabManager.updateGoalForTab(): Goal element not found');
            return;
        }

        // Get goal for current tab
        const goalText = instructorGoals[tabId] || '';

        // Always use read-only display - goal comes from backend set by instructor
        if (goalElement.tagName === 'DIV') {
            if (goalText) {
                goalElement.textContent = goalText;
            } else {
                goalElement.innerHTML = '<em>No goal set for this phase.</em>';
            }
        } else {
            // Replace textarea with div if it exists
            const div = document.createElement('div');
            div.id = 'assignmentGoal';
            div.className = 'goal-field goal-field-readonly';
            if (goalText) {
                div.textContent = goalText;
            } else {
                div.innerHTML = '<em>No goal set for this phase.</em>';
            }

            const parentNode = goalElement.parentNode;
            if (parentNode) {
                parentNode.replaceChild(div, goalElement);
            }
        }
    }

    restoreGoalFromState() {
        // No longer needed - goals are instructor-set per tab
        // This method is kept for compatibility but does nothing
    }

    populateWriteOutline() {
        const outlineSidebar = document.getElementById('outlineSidebar');
        if (!outlineSidebar) {
            console.warn('Outline sidebar not found');
            return;
        }

        // Get plan data from global state OR directly from project manager (fresher)
        let state;
        if (this.projectManager) {
            // Collect all data to ensure we have the latest state from PlanModule
            // This is critical because PlanModule updates its own state but might not have synced to GlobalState yet
            state = this.projectManager.collectAllData();
            console.log('DEBUG: populateWriteOutline - fetched fresh state from ProjectManager');
        } else {
            state = this.globalState.getState();
            console.log('DEBUG: populateWriteOutline - fetched state from GlobalState');
        }

        console.log('DEBUG: populateWriteOutline - state:', state);
        console.log('DEBUG: populateWriteOutline - plan.ideas:', state?.plan?.ideas);

        if (!state || !state.plan || !state.plan.ideas) {
            console.warn('No plan data available');
            return;
        }

        // Convert ideas to array if it's an object (like chatHistory)
        let ideasArray;
        if (Array.isArray(state.plan.ideas)) {
            ideasArray = state.plan.ideas;
        } else if (typeof state.plan.ideas === 'object' && state.plan.ideas !== null) {
            ideasArray = Object.values(state.plan.ideas);
            console.log('DEBUG: Converted ideas object to array:', ideasArray);
        } else {
            console.warn('Invalid ideas format:', typeof state.plan.ideas);
            return;
        }


        // Clear existing outline
        outlineSidebar.innerHTML = '<h3>My Outline</h3>';

        // Get available sections to check if we should show the insert template button
        let sections = this.getOutlineSections(state);


        // Add button to insert outline template into editor (only if sections exist)
        if (sections && sections.length > 0) {
            const insertTemplateBtn = document.createElement('button');
            insertTemplateBtn.className = 'insert-template-btn';
            insertTemplateBtn.textContent = 'Insert Outline Template';
            insertTemplateBtn.title = 'Insert outline section headings into the editor';
            insertTemplateBtn.addEventListener('click', () => {
                if (window.aiWritingAssistant && window.aiWritingAssistant.modules && window.aiWritingAssistant.modules.write) {
                    window.aiWritingAssistant.modules.write.insertOutlineTemplate();
                }
            });
            outlineSidebar.appendChild(insertTemplateBtn);
        }

        // Filter bubbles that are in outline
        const outlineBubbles = ideasArray.filter(bubble =>
            bubble.location === 'outline' && bubble.sectionId
        );

        console.log('DEBUG: outlineBubbles found:', outlineBubbles.length, outlineBubbles);

        if (outlineBubbles.length === 0) {
            const noOutline = document.createElement('p');
            noOutline.textContent = 'No outline items yet. Go back to Plan & Organize to add ideas to your outline.';
            noOutline.style.color = 'var(--text-secondary)';
            noOutline.style.fontStyle = 'italic';
            noOutline.style.padding = 'var(--spacing-md)';
            outlineSidebar.appendChild(noOutline);
            return;
        }

        // Group bubbles by section
        const sectionsMap = new Map();

        // Use sections we already got above (or get them if not available)
        if (!sections || sections.length === 0) {
            sections = this.getOutlineSections(state);
        }



        sections.forEach(section => {
            sectionsMap.set(section.id, {
                title: section.title,
                bubbles: []
            });
        });

        // Add bubbles to their sections
        outlineBubbles.forEach(bubble => {
            if (bubble.sectionId && sectionsMap.has(bubble.sectionId)) {
                sectionsMap.get(bubble.sectionId).bubbles.push(bubble);
            }
        });

        // Create outline display
        sectionsMap.forEach((sectionData, sectionId) => {
            if (sectionData.bubbles.length > 0) {
                const sectionDiv = document.createElement('div');
                // Margin handled by CSS now

                const sectionTitle = document.createElement('h4');
                sectionTitle.textContent = sectionData.title;
                // Styles handled by CSS
                sectionDiv.appendChild(sectionTitle);

                const bubbleList = document.createElement('ul');
                // Styles handled by CSS

                sectionData.bubbles.forEach(bubble => {
                    const bubbleItem = document.createElement('li');
                    // Truncate long content for better space usage
                    const maxLength = 80;
                    const content = bubble.content.trim();
                    bubbleItem.textContent = content.length > maxLength
                        ? content.substring(0, maxLength) + '...'
                        : content;
                    bubbleItem.title = content; // Show full text on hover
                    // Styles handled by CSS
                    bubbleList.appendChild(bubbleItem);
                });

                sectionDiv.appendChild(bubbleList);
                outlineSidebar.appendChild(sectionDiv);
            }
        });
    }

    getOutlineSections(state) {
        // If we have sections from plan module, use those
        if (window.aiWritingAssistant && window.aiWritingAssistant.modules.plan) {
            const planModule = window.aiWritingAssistant.modules.plan;
            if (planModule.sections) {
                const sections = [];
                planModule.sections.forEach((section, id) => {
                    sections.push({
                        id: section.id,
                        title: section.title,
                        description: section.description
                    });
                });
                return sections;
            }
        }

        // Otherwise, use template data
        if (window.templateData && window.templateData.sections) {
            return window.templateData.sections;
        }

        // Default sections as fallback
        return [
            { id: 'introduction', title: 'Introduction' },
            { id: 'main-arguments', title: 'Main Arguments' },
            { id: 'conclusion', title: 'Conclusion' }
        ];
    }

    getCurrentTab() {
        return this.currentTab;
    }
}

// Handles chat interface for AI interactions
class ChatManager {
    constructor(globalState) {
        this.globalState = globalState;
        this.messages = []; // Store chat message history
        this.elements = {
            chatMessages: document.getElementById('chatMessages'),
            userInput: document.getElementById('userInput'),
            sendButton: document.getElementById('sendMessage'),
            regenerateGlobalBtn: document.getElementById('regenerateGlobalBtn')
        };

        // Check if elements were found
        if (!this.elements.chatMessages || !this.elements.userInput || !this.elements.sendButton) {
            console.warn('ChatManager: Some required elements not found');
        }

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.subscribeToGlobalState();
    }

    subscribeToGlobalState() {
        if (this.globalState) {
            this.globalState.subscribe('stateChanged', (state) => {
                this.syncWithGlobalState(state);
            });
        }
    }

    syncWithGlobalState(state) {
        if (state.chatHistory && Array.isArray(state.chatHistory)) {
            // Only add new messages instead of clearing and re-rendering everything
            if (state.chatHistory.length > this.messages.length) {
                console.log('ChatManager: Adding new messages, current:', this.messages.length, 'total:', state.chatHistory.length);

                // Add only the new messages
                for (let i = this.messages.length; i < state.chatHistory.length; i++) {
                    const msg = state.chatHistory[i];
                    this.messages.push(msg);
                    this.renderMessage(msg);
                }
            }
        }
    }

    setupEventListeners() {
        // Remove existing listeners first to prevent duplicates
        this.removeEventListeners();

        if (this.elements.sendButton) {
            this.sendButtonHandler = () => this.sendMessage();
            this.elements.sendButton.addEventListener('click', this.sendButtonHandler);
        }

        if (this.elements.userInput) {
            this.userInputHandler = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            };
            this.elements.userInput.addEventListener('keypress', this.userInputHandler);
        }

        if (this.elements.regenerateGlobalBtn) {
            this.regenerateButtonHandler = () => this.regenerateLastMessage();
            this.elements.regenerateGlobalBtn.addEventListener('click', this.regenerateButtonHandler);
        }
    }

    removeEventListeners() {
        if (this.elements.sendButton && this.sendButtonHandler) {
            this.elements.sendButton.removeEventListener('click', this.sendButtonHandler);
        }

        if (this.elements.userInput && this.userInputHandler) {
            this.elements.userInput.removeEventListener('keypress', this.userInputHandler);
        }

        if (this.elements.regenerateGlobalBtn && this.regenerateButtonHandler) {
            this.elements.regenerateGlobalBtn.removeEventListener('click', this.regenerateButtonHandler);
        }
    }

    // Messages are now handled by global state sync
    // This method is kept for backward compatibility but shouldn't be used directly
    addMessage(role, content, timestamp = null) {
        console.warn('ChatManager.addMessage() is deprecated. Messages are now handled by global state sync.');
    }

    renderMessage(message) {
        if (!this.elements.chatMessages) {
            console.error('ChatManager: chatMessages element not found, cannot render message');
            return;
        }

        const messageDiv = createElement('div', `message ${message.role}`);
        const messageContent = createElement('div', 'message-content');

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
                messageContent.innerHTML = cleanHtml;
                messageContent.classList.add('markdown-rendered');
            } catch (e) {
                console.error('ChatManager: Error parsing markdown:', e);
                messageContent.textContent = message.content;
            }
        } else {
            messageContent.textContent = message.content;
        }

        messageDiv.appendChild(messageContent);
        this.elements.chatMessages.appendChild(messageDiv);
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }

    sendMessage() {
        if (!this.elements.userInput) return;

        const message = this.elements.userInput.value.trim();
        if (!message) return;

        console.log('ChatManager: Sending message:', message);

        // Don't add message directly - let the global state system handle it
        this.elements.userInput.value = '';

        // Emit custom event for message sent
        document.dispatchEvent(new CustomEvent('messageSent', {
            detail: { message, role: 'user' }
        }));
    }


    regenerateLastMessage() {
        if (this.messages.length < 2) return;

        const last = this.messages[this.messages.length - 1];
        const prev = this.messages[this.messages.length - 2];

        if (last.role !== 'assistant' || prev.role !== 'user') return;

        // Remove last AI message
        this.messages.pop();
        if (this.elements.chatMessages.lastChild) {
            this.elements.chatMessages.removeChild(this.elements.chatMessages.lastChild);
        }

        // Emit custom event for regeneration
        document.dispatchEvent(new CustomEvent('regenerateRequested', {
            detail: { message: prev.content }
        }));
    }

    updateRegenerateButton() {
        if (!this.elements.regenerateGlobalBtn) return;

        const last = this.messages[this.messages.length - 1];
        this.elements.regenerateGlobalBtn.disabled = !(last && last.role === 'assistant');
    }

    loadMessages(messages) {
        // Check if DOM elements are available, re-initialize if needed
        if (!this.elements.chatMessages) {
            console.warn('ChatManager: Reinitializing elements as chatMessages was not found');
            this.elements.chatMessages = document.getElementById('chatMessages');
        }

        // Clear existing messages without triggering clear event
        this.messages = [];
        if (this.elements.chatMessages) {
            this.elements.chatMessages.innerHTML = '';
        } else {
            console.error('ChatManager: chatMessages element still not found after reinit, cannot clear messages');
            return; // Don't try to load messages if we can't render them
        }
        this.updateRegenerateButton();

        // Load new messages
        if (messages && Array.isArray(messages)) {
            messages.forEach((msg, index) => {
                this.addMessage(msg.role, msg.content, msg.timestamp);
            });
        } else {
            console.warn('ChatManager: Invalid messages array');
        }
    }

    getMessages() {
        return [...this.messages];
    }

    // Method called by ProjectManager to collect chat data
    collectData() {
        const chatData = {
            chatHistory: this.getMessages()
        };

        return chatData;
    }
}



