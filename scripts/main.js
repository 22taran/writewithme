// Main application for AI Writing Assistant - manages all modules and state
// All modules are concatenated into a single file by Grunt

// Global error handler to suppress addRange() errors from Quill
window.addEventListener('error', (event) => {
    if (event.message && event.message.includes('addRange(): The given range isn\'t in document')) {
        event.preventDefault();
        console.warn('Suppressed addRange() error from Quill editor');
        return false;
    }
});

// Central state management for the entire application
class GlobalState {
    constructor() {
        this.state = deepClone(DEFAULT_PROJECT_SCHEMA);
        this.listeners = new Map();
        this.silentMode = false; // Flag to prevent notifications during bulk updates
    }

    getState() {
        return deepClone(this.state);
    }

    setState(newState, silent = false) {
        this.state = deepClone(newState);
        if (!silent && !this.silentMode) {
            this.notifyListeners('stateChanged', this.state);
        }
    }

    updateState(updates, silent = false) {
        this.setState({ ...this.state, ...updates }, silent);
    }

    // Set silent mode for bulk operations
    setSilentMode(enabled) {
        this.silentMode = enabled;
    }

    subscribe(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    notifyListeners(event, data) {
        if (this.silentMode) return;
        
        this.listeners.get(event)?.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Event handler error for ${event}:`, error);
            }
        });
    }
}

// Manages project data loading, saving, and module coordination
class ProjectManager {
    constructor(globalState, api) {
        this.globalState = globalState;
        this.api = api;
        this.isReady = false;
        this.isSaving = false;
        this.saveQueued = false;
        this.lastSaveTime = null;
        this.modules = new Map(); // Keep track of registered modules for data collection
        // Autosave scheduling
        this.autosaveTimer = null;
        this.autosavePending = false;
        this.autosaveDebounceMs = 1000; // idle debounce
        this.autosaveMinIntervalMs = 30000; // hard throttle
        this.isOnline = navigator.onLine;

        // Online/offline handling
        window.addEventListener('online', () => {
            this.isOnline = true;
            // Trigger a save soon after coming online if pending
            if (this.autosavePending || this.autosaveTimer === null) {
                this.scheduleAutoSave('online-retry');
            }
        });
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.globalState.notifyListeners('autosave_offline', {});
        });
        
        this.init();
    }

    async init() {
        try {
            // Test AJAX connection first
            console.log('Testing AJAX connection...');
            const connectionTest = await this.api.testConnection();
            console.log('AJAX connection test:', connectionTest ? 'PASSED' : 'FAILED');
            
            await this.loadProject();
            this.isReady = true;
            this.globalState.notifyListeners('ready', this.globalState.getState());
        } catch (error) {
            console.error('ProjectManager: Initialization failed:', error);
            this.globalState.notifyListeners('error', error);
        }
    }

    async loadProject() {
        try {
            const project = await this.api.loadProject();
            if (project) {
                this.globalState.setState(project);
                // Trigger 'ready' event so modules can restore their UI
                this.globalState.notifyListeners('ready', project);
            } else {
                console.warn('No existing project found, creating new one');
                this.createNewProject();
            }
        } catch (error) {
            console.error('Failed to load project:', error);
            this.createNewProject();
        }
    }

    createNewProject() {
        const newProject = deepClone(DEFAULT_PROJECT_SCHEMA);
        newProject.metadata.created = formatDate(new Date());
        newProject.metadata.modified = formatDate(new Date());
        newProject.metadata.currentTab = 'plan'; // Set default tab
        newProject.metadata.instructorInstructions = window.instructorDescription || ''; // Include instructor instructions
        
        this.globalState.setState(newProject);
        return newProject;
    }

    // Register a module so its data gets collected during save operations
    registerModule(name, module) {
        this.modules.set(name, module);
    }

    // Gather all data from registered modules and current state for saving
    collectAllData() {
        const currentState = this.globalState.getState();
        const collectedData = deepClone(currentState);
        
        // Update the modified timestamp
        collectedData.metadata.modified = formatDate(new Date());
        
        // Ask each registered module for its current data
        this.modules.forEach((module, moduleName) => {
            try {
                if (typeof module.collectData === 'function') {
                    const moduleData = module.collectData();
                    
                    // Merge the module's data into the main project data
                    if (moduleData) {
                        Object.keys(moduleData).forEach(key => {
                            if (collectedData[key]) {
                                collectedData[key] = { ...collectedData[key], ...moduleData[key] };
                            } else {
                                collectedData[key] = moduleData[key];
                            }
                        });
                    }
                }
            } catch (error) {
                console.error(`ProjectManager: Error collecting data from ${moduleName}:`, error);
            }
        });
        
        // Update metadata with current tab and instructor instructions
        if (window.aiWritingAssistant && window.aiWritingAssistant.tabManager) {
            const currentTab = window.aiWritingAssistant.tabManager.getCurrentTab();
            collectedData.metadata = { 
                ...collectedData.metadata, 
                currentTab,
                instructorInstructions: window.instructorDescription || ''
            };
        }
        
        // Exclude chatHistory from project saves (chat persists via its own pipeline)
        if (collectedData.chatHistory) {
            delete collectedData.chatHistory;
        }
        return collectedData;
    }

    async saveProject() {
        if (this.isSaving) {
            // Queue another save to run immediately after current one
            this.saveQueued = true;
            return true;
        }

        this.isSaving = true;
        
        try {
            // Show saving indicator
            this.globalState.notifyListeners('autosave_saving', { reason: 'direct' });
            // Collect all data from modules and current state
            const completeProjectData = this.collectAllData();
            
            console.log('ProjectManager.saveProject(): write content length=', 
                completeProjectData?.write?.content?.length || 0);
            
            const success = await this.api.saveProject(completeProjectData);
            
            if (success) {
                this.lastSaveTime = new Date();
                this.globalState.notifyListeners('saved', completeProjectData);
                this.globalState.notifyListeners('autosave_saved', { reason: 'direct', at: new Date().toISOString() });
                return true;
            } else {
                throw new Error('Save failed');
            }
        } catch (error) {
            console.error('ProjectManager: Failed to save project:', error);
            this.globalState.notifyListeners('error', error);
            return false;
        } finally {
            this.isSaving = false;
            // If another save was requested while saving, run it immediately
            if (this.saveQueued) {
                this.saveQueued = false;
                // Fire-and-forget to avoid blocking UI
                this.saveProject().catch(() => {});
            }
        }
    }

    // Schedule an autosave with debounce and global throttle
    scheduleAutoSave(reason = 'unspecified', force = false) {
        const now = Date.now();
        const last = this.lastSaveTime ? this.lastSaveTime.getTime() : 0;
        const elapsed = now - last;

        // If offline, defer until online
        if (!this.isOnline) {
            this.autosavePending = true;
            this.globalState.notifyListeners('autosave_offline', { reason });
            return;
        }

        // Clear any pending debounce
        if (this.autosaveTimer) {
            clearTimeout(this.autosaveTimer);
            this.autosaveTimer = null;
        }

        // If outside throttle window, save soon after debounce
        let delay = this.autosaveDebounceMs;
        if (!force && elapsed < this.autosaveMinIntervalMs) {
            // Within throttle window: schedule at the end of the window
            const remaining = this.autosaveMinIntervalMs - elapsed;
            delay = Math.max(this.autosaveDebounceMs, remaining);
        }

        this.autosavePending = true;
        this.globalState.notifyListeners('autosave_scheduled', { reason, delay });

        this.autosaveTimer = setTimeout(async () => {
            try {
                this.globalState.notifyListeners('autosave_saving', { reason });
                await this.saveProject();
                this.globalState.notifyListeners('autosave_saved', { reason, at: new Date().toISOString() });
            } catch (e) {
                this.globalState.notifyListeners('autosave_error', { reason, error: e });
            } finally {
                this.autosavePending = false;
                this.autosaveTimer = null;
            }
        }, delay);
    }

    getProject() {
        return this.globalState.getState();
    }

    // These methods are now only used for initial state loading
    // Real-time updates are removed to prevent performance issues
    updateMetadata(metadata) {
        const currentState = this.globalState.getState();
        currentState.metadata = {
            ...currentState.metadata,
            ...metadata,
            modified: formatDate(new Date())
        };
        this.globalState.setState(currentState, true); // Silent update
    }

    updatePlan(planData) {
        const currentState = this.globalState.getState();
        currentState.plan = {
            ...currentState.plan,
            ...planData
        };
        this.globalState.setState(currentState, true); // Silent update
    }

    updateWrite(writeData) {
        const currentState = this.globalState.getState();
        currentState.write = {
            ...currentState.write,
            ...writeData
        };
        this.globalState.setState(currentState, true); // Silent update
    }

    updateEdit(editData) {
        const currentState = this.globalState.getState();
        currentState.edit = {
            ...currentState.edit,
            ...editData
        };
        this.globalState.setState(currentState, true); // Silent update
    }

    updateUI(uiData) {
        const currentState = this.globalState.getState();
        currentState.ui = {
            ...currentState.ui,
            ...uiData
        };
        this.globalState.setState(currentState, true); // Silent update
    }

    async addChatMessage(role, content) {
        const currentState = this.globalState.getState();
        const message = {
            role,
            content,
            timestamp: formatDate(new Date()),
            id: `${role}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        
        currentState.chatHistory.push(message);
        this.globalState.setState(currentState);
        
        // Only auto-save when assistant message is received (not on user input)
        if (role === 'assistant') {
            try {
            await this.saveProject();
            } catch (error) {
                console.warn('ProjectManager: Failed to save project after assistant message:', error.message);
                // Don't throw error - chat should continue working even if save fails
            }
        }
    }


    ready() {
        return this.isReady;
    }
}

// Handles the planning phase (idea bubbles, drag & drop, and outline sections
class PlanModule {
    constructor(globalState, projectManager, api) {
        this.globalState = globalState;
        this.projectManager = projectManager;
        this.api = api;
        this.domManager = new DOMManager();
        this.bubbles = new Map(); // Track all idea bubbles by ID
        this.sections = new Map(); // Track outline sections by ID
        this.isInitialized = false;
        this.isDragging = false; // Prevent state updates during drag operations
        this.restoreTimeout = null; // Debounce state restoration
        
        // Bind event handlers to prevent duplicate listeners
        this.handleAddIdeaClick = this.handleAddIdeaClick.bind(this);
        
        // Register with project manager so our data gets saved
        this.projectManager.registerModule('plan', this);
        
        this.init();
    }

    init() {
        this.setupElements();
        this.setupDragAndDrop();
        this.setupEventListeners();
        this.setupStateSync();
        this.loadTemplate();
        
        // Mark as initialized after template is loaded
        this.isInitialized = true;
        
        // Test bubble functionality removed
    }

    setupElements() {
        this.elements = {
            ideaBubbles: this.domManager.getElement('ideaBubbles'),
            outlineItems: this.domManager.getElement('outlineItems'),
            addIdeaBubbleBtn: this.domManager.getElement('addIdeaBubble')
        };
    }

    setupDragAndDrop() {
        if (typeof Sortable === 'undefined') {
            console.error('Sortable.js not loaded');
            return;
        }

        // Make the brainstorm panel droppable for idea bubbles
        if (this.elements.ideaBubbles) {
            new Sortable(this.elements.ideaBubbles, {
                group: {
                    name: 'bubbles',
                    pull: true,
                    put: ['bubbles']
                },
                sort: false,
                animation: 150,
                onStart: (evt) => {
                    this.isDragging = true;
                },
                onEnd: (evt) => {
                    this.isDragging = false;
                    this.handleDragEnd(evt);
                }
            });
        }
    }

    setupEventListeners() {
        if (this.elements.addIdeaBubbleBtn) {
            this.domManager.addEventListener(this.elements.addIdeaBubbleBtn, 'click', this.handleAddIdeaClick);
        }
        
        // Listen for bubble content changes - update content but don't autosave on every keystroke
        // Save happens on blur (when user clicks away) to prevent multiple DB entries
        document.addEventListener('bubbleContentChanged', (event) => {
            const { bubbleId, content } = event.detail;
            const bubble = this.bubbles.get(bubbleId);
            if (bubble) {
                bubble.content = content;
                // No autosave on content change - saves on blur instead
            }
        });
        
        // Listen for bubble deletion - delete locally only (no autosave)
        document.addEventListener('bubbleDeleted', (event) => {
            const { bubbleId } = event.detail;
            this.handleBubbleDeleted(bubbleId);
        });
    }

    handleAddIdeaClick() {
        this.addIdeaBubble();
    }

    async handleBubbleDeleted(bubbleId) {
        try {
            const bubble = this.bubbles.get(bubbleId);
            const payload = bubble ? {
                id: bubbleId, // may be non-numeric; backend will fallback to fields
                content: bubble.content || '',
                location: bubble.location || 'brainstorm',
                sectionId: bubble.sectionId || ''
            } : bubbleId; // if not found, attempt with id

            const ok = await this.api.deleteIdea(payload);
            if (ok) {
                this.bubbles.delete(bubbleId);
                const node = document.querySelector(`.idea-bubble[data-id="${bubbleId}"]`);
                if (node && node.parentNode) node.parentNode.removeChild(node);
                console.log('PlanModule: Bubble deleted from DB and UI:', bubbleId);
            } else {
                console.warn('PlanModule: Backend delete returned false for', bubbleId);
            }
        } catch (e) {
            console.warn('PlanModule: Delete idea failed:', e?.message || e);
        }
    }

    triggerAutoSave() {
        // Delegate to centralized autosave scheduler
        this.projectManager.scheduleAutoSave('plan', true);
    }


    setupStateSync() {
        // Only restore UI when project is initially loaded, not on every state change
        this.globalState.subscribe('ready', (state) => {
            console.log('DEBUG: PlanModule received ready event with state:', state);
            if (this.isInitialized && state.plan && state.plan.ideas) {
                console.log('DEBUG: Ready event - restoring bubbles from state.plan.ideas:', state.plan.ideas);
                this.restoreBubblesFromState(state.plan.ideas);
            } else {
                console.log('DEBUG: Ready event - no ideas to restore or not initialized');
                console.log('  isInitialized:', this.isInitialized);
                console.log('  state.plan:', state.plan);
                console.log('  state.plan.ideas:', state.plan ? state.plan.ideas : 'N/A');
            }
        });
        
        // Listen for AI-generated updates
        this.globalState.subscribe('aiUpdate', (updatedProject) => {
            if (this.isInitialized && updatedProject.plan && updatedProject.plan.ideas) {
                this.handleAIUpdates(updatedProject.plan.ideas);
            }
        });
    }

    // Handle AI-generated updates to the plan
    handleAIUpdates(ideas) {
        if (!Array.isArray(ideas)) return;
        
        // Find new AI-generated ideas that aren't already in the UI
        const newIdeas = ideas.filter(idea => 
            idea.aiGenerated && 
            idea.location === 'brainstorm' && 
            !this.bubbles.has(idea.id)
        );
        
        // Add new AI-generated bubbles
        newIdeas.forEach(idea => {
            const bubble = new BubbleComponent(idea.content, idea.id, true);
            this.bubbles.set(bubble.id, bubble);
            
            if (this.elements.ideaBubbles) {
                this.elements.ideaBubbles.appendChild(bubble.element);
            }
        });
    }

    restoreBubblesFromState(ideas) {
        console.log('DEBUG: restoreBubblesFromState called with:', ideas);
        
        // Handle both array and object formats (like chatHistory)
        let ideasArray;
        if (Array.isArray(ideas)) {
            ideasArray = ideas;
        } else if (typeof ideas === 'object' && ideas !== null) {
            // Convert object to array
            ideasArray = Object.values(ideas);
            console.log('DEBUG: Converted object ideas to array:', ideasArray);
        } else {
            console.log('DEBUG: No ideas to restore or invalid format');
            return;
        }

        console.log('DEBUG: Restoring', ideasArray.length, 'ideas');

        // Clear existing bubbles
        this.clearAllBubbles();

        // Restore bubbles to their correct locations
        ideasArray.forEach((idea, index) => {
            console.log(`DEBUG: Processing idea ${index}:`, idea);
            
            if (!idea.id || !idea.content) {
                console.warn('Invalid idea data:', idea);
                return;
            }

            const bubble = new BubbleComponent(idea.content, idea.id, idea.aiGenerated || false);
            bubble.location = idea.location || 'brainstorm'; // Set location for tracking
            bubble.sectionId = idea.sectionId || null; // Set sectionId for outline bubbles
            this.bubbles.set(bubble.id, bubble);

            if (idea.location === 'brainstorm') {
                if (this.elements.ideaBubbles) {
                    this.elements.ideaBubbles.appendChild(bubble.element);
                    console.log('DEBUG: Added bubble to brainstorm:', idea.content);
                }
            } else if (idea.location === 'outline' && idea.sectionId) {
                const section = this.sections.get(idea.sectionId);
                if (section) {
                    // Add bubble to the section's outline container
                    const outlineContainer = section.element.querySelector('.outline-container');
                    if (outlineContainer) {
                        outlineContainer.appendChild(bubble.element);
                        // Remove empty placeholder if it exists
                        const placeholder = outlineContainer.querySelector('.dropzone-placeholder');
                        if (placeholder) {
                            placeholder.remove();
                        }
                        outlineContainer.classList.remove('empty');
                    }
                } else {
                    console.warn('Section not found for bubble:', idea.sectionId);
                }
            } else {
                console.warn('Invalid bubble location or missing sectionId:', idea);
            }
        });
        
        console.log('DEBUG: Finished restoring bubbles. Map now has', this.bubbles.size, 'entries');
    }

    clearAllBubbles() {
        // Clear brainstorm bubbles
        if (this.elements.ideaBubbles) {
            this.elements.ideaBubbles.innerHTML = '';
        }

        // Clear outline bubbles
        this.sections.forEach(section => {
            const outlineContainer = section.element.querySelector('.outline-container');
            if (outlineContainer) {
                outlineContainer.innerHTML = '';
                // Add placeholder back
                outlineContainer.classList.add('empty');
                const placeholder = createElement('div', 'dropzone-placeholder', 'Drop ideas here to create outline items');
                placeholder.draggable = false;
                outlineContainer.appendChild(placeholder);
            }
        });

        // Clear bubbles map
        this.bubbles.clear();
    }

    async handleDragEnd(evt) {
        // Update bubble locations based on where they were dropped
        const bubbleElement = evt.item;
        const bubbleId = bubbleElement.dataset.id;
        const bubble = this.bubbles.get(bubbleId);
        
        if (bubble) {
            // Determine new location
            if (evt.to === this.elements.ideaBubbles) {
                bubble.setLocation('brainstorm');
            } else {
                // Find which section this was dropped into
                const sectionElement = evt.to.closest('.template-section');
                if (sectionElement) {
                    const sectionId = sectionElement.dataset.sectionId;
                    bubble.setLocation('outline', sectionId);
                } else {
                    console.warn('Could not find section element for dropped bubble');
                }
            }
        } else {
            console.warn('Bubble not found in bubbles map:', bubbleId);
        }

        // Explicitly save when moving bubble between brainstorm and outline
        try {
            await this.projectManager.saveProject();
        } catch (e) {
            console.warn('PlanModule: Save after drag failed:', e?.message || e);
        }
    }

    async loadTemplate() {
        try {
            const templateId = window.selectedTemplate || 'argumentative';
            const template = await this.api.loadTemplate(templateId);
            
            if (template && template.sections && template.sections.length > 0) {
            this.createSections(template.sections);
            } else {
                console.warn('No template sections found, creating default sections');
                this.createDefaultSections();
            }
        } catch (error) {
            console.error('Failed to load template:', error);
            console.warn('Creating default sections as fallback');
            this.createDefaultSections();
        }
    }
    
    createDefaultSections() {
        const defaultSections = [
            {
                id: 'introduction',
                title: 'Introduction',
                description: 'Hook, background, and thesis statement',
                required: true,
                allowMultiple: false,
                editableTitle: true,
                editableDescription: true,
                outline: []
            },
            {
                id: 'main-arguments',
                title: 'Main Arguments',
                description: 'Your key points supporting your thesis',
                required: true,
                allowMultiple: true,
                editableTitle: true,
                editableDescription: true,
                outline: []
            },
            {
                id: 'conclusion',
                title: 'Conclusion',
                description: 'Restate thesis and summarize main points',
                required: true,
                allowMultiple: false,
                editableTitle: true,
                editableDescription: true,
                outline: []
            }
        ];
        
        this.createSections(defaultSections);
    }

    createSections(sections) {
        if (!this.elements.outlineItems) return;
        
        this.elements.outlineItems.innerHTML = '';
        
        sections.forEach(sectionData => {
            const section = new SectionComponent(sectionData);
            this.sections.set(section.id, section);
            
            // Setup drag and drop for this section
            this.setupSectionDragAndDrop(section);
            
            this.elements.outlineItems.appendChild(section.element);
        });
    }

    setupSectionDragAndDrop(section) {
        if (typeof Sortable === 'undefined') return;
        
        const outlineContainer = section.element.querySelector('.outline-container');
        if (outlineContainer) {
            new Sortable(outlineContainer, {
                group: {
                    name: 'bubbles',
                    pull: true,
                    put: ['bubbles']
                },
                sort: true,
                animation: 150,
                onStart: (evt) => {
                    this.isDragging = true;
                },
                onEnd: (evt) => {
                    this.isDragging = false;
                    this.handleDragEnd(evt);
                }
            });
        }
    }

    addIdeaBubble(content = ' ') {
        const bubble = new BubbleComponent(content);
        bubble.location = 'brainstorm'; // Set location for tracking
        this.bubbles.set(bubble.id, bubble);
        
        if (this.elements.ideaBubbles) {
            this.elements.ideaBubbles.appendChild(bubble.element);
            const contentDiv = bubble.element.querySelector('.bubble-content');
            contentDiv.focus();
            
            // Save on blur (when user finishes editing)
            contentDiv.addEventListener('blur', () => {
                const finalContent = contentDiv.textContent.trim();
                // Only save if bubble has meaningful content (not empty, not just placeholder)
                if (finalContent && finalContent !== finalContent.length > 0) {
                    bubble.content = finalContent;
                    this.triggerAutoSave();
                } else if (!finalContent || finalContent === 'New idea') {
                    // Remove bubble if it's still empty/placeholder when user clicks away
                    bubble.content = finalContent || '';
                    // Don't delete immediately - let user edit it
                }
            }, { once: false });
        }
        
        console.log('DEBUG: Added bubble to Map:', this.bubbles.size, 'bubbles');
        console.log('DEBUG: Bubble data:', { id: bubble.id, content: bubble.content, location: bubble.location });
        
        // Don't autosave immediately - wait until user finishes editing (blur event)
        
    }


    // Collect current bubble data from UI elements (used only during save operations)
    collectBubbleData() {
        // Get all bubbles from our tracking Map instead of DOM
        const brainstormBubbles = [];
        const outlineBubbles = [];
        
        console.log('DEBUG: collectBubbleData - bubbles Map has', this.bubbles.size, 'entries');
        
        this.bubbles.forEach((bubble, id) => {
            console.log('DEBUG: Processing bubble:', id, bubble);
            const bubbleData = {
                id: bubble.id,
                content: bubble.content,
                location: bubble.location || 'brainstorm',
                sectionId: bubble.sectionId || null,  // CRITICAL: Include sectionId
                aiGenerated: bubble.aiGenerated || false
            };
            
            if (bubbleData.location === 'brainstorm') {
                brainstormBubbles.push(bubbleData);
            } else if (bubbleData.location === 'outline') {
                outlineBubbles.push(bubbleData);
            }
        });

        // Combine all bubbles into one array
        const allBubbles = [...brainstormBubbles, ...outlineBubbles];
        
        console.log('DEBUG: collectBubbleData result:', allBubbles);
        
        return allBubbles;
    }

    // Legacy method name for compatibility - now just collects data
    saveAllBubbles() {
        return this.collectBubbleData();
    }

    // Method called by ProjectManager to collect all plan data
    collectData() {
        // Collect current bubble data from UI elements
        const currentBubbles = this.collectBubbleData();
        
        // Collect outline structure
        const outline = [];
        this.sections.forEach(section => {
            const sectionData = {
                id: section.id,
                title: section.title,
                description: section.description,
                bubbles: section.getBubbles()
            };
            outline.push(sectionData);
        });
        
        // Get current template info
        const templateName = window.selectedTemplate || 'argumentative';
        
        const planData = {
            plan: {
                templateName: templateName,
                templateDisplayName: this.getTemplateDisplayName(templateName),
                ideas: currentBubbles,
                outline: outline,
                customSectionTitles: {},
                customSectionDescriptions: {}
            }
        };
        
        return planData;
    }

    getTemplateDisplayName(templateId) {
        const templateNames = {
            'argumentative': 'Argumentative Essay',
            'comparative': 'Comparative Essay',
            'lab-report': 'Lab Report',
            'test-template': 'Test Template'
        };
        return templateNames[templateId] || templateId;
    }

}

// ---- Base Editor Module ----
class BaseEditorModule {
    constructor(globalState, projectManager, editorId, moduleName) {
        this.globalState = globalState;
        this.projectManager = projectManager;
        this.editorId = editorId;
        this.moduleName = moduleName;
        this.editor = null;
        this.init();
    }

    init() {
        this.initializeEditor();
        this.setupEventListeners();
    }

    initializeEditor() {
        const editorContainer = document.getElementById(this.editorId);
        if (!editorContainer) return;
        
        try {
            this.editor = new Quill(`#${this.editorId}`, quillConfig);
            this.editor.format('size', '12pt');
            editorContainer.classList.add('quill-page');
            
            // No need for selection-change handling - let Quill manage selection naturally
            
            this.setupEditorEvents();
        } catch (error) {
            console.error(`Failed to initialize ${this.moduleName} editor:`, error);
        }
    }

    setupEditorEvents() {
        if (!this.editor) {
            console.warn(`${this.moduleName}: Editor not initialized, cannot setup autosave`);
            return;
        }
        // Debounced autosave on user-initiated changes only
        let debounceTimer = null;
        const debounceMs = 300; // feel instant
        this.editor.on('text-change', (delta, oldDelta, source) => {
            if (source !== 'user') return; // Ignore programmatic updates during restore
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                console.log(`${this.moduleName}: Triggering autosave after text-change`);
                // Direct save for Write/Edit like Google Docs (fast autosave)
                this.projectManager.saveProject().catch((e) => {
                    console.error(`${this.moduleName}: Autosave failed:`, e);
                });
            }, debounceMs);
        });
    }

    setupEventListeners() {
        // Only restore editor content when project is initially loaded
        this.globalState.subscribe('ready', (state) => {
            const moduleState = state[this.moduleName.toLowerCase()];
            if (moduleState && this.editor) {
                this.editor.root.innerHTML = moduleState.content || '';
            }
        });
    }

    calculateWordCount() {
        if (!this.editor) return 0;
        const text = this.editor.getText();
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }
}

// ---- Write Module ----
class WriteModule extends BaseEditorModule {
    constructor(globalState, projectManager) {
        super(globalState, projectManager, 'writeEditor', 'Write');
        
        // Register with project manager for data collection
        this.projectManager.registerModule('write', this);
        this.lastSaveWasManual = false; // Track manual saves for version history
    }

    handleTextChange(content) {
        // Text changes are handled locally, state updated only during save
    }

    // Method called by ProjectManager to collect all write data
    collectData() {
        const content = this.editor ? this.editor.root.innerHTML : '';
        const wordCount = this.calculateWordCount();
        const changeSummary = this.lastSaveWasManual ? 'Manual save' : 'Auto-saved';
        
        console.log('WriteModule.collectData(): content length=' + content.length + ', wordCount=' + wordCount + ', changeSummary=' + changeSummary + ', lastSaveWasManual=' + this.lastSaveWasManual);
        
        // Reset flag AFTER collecting data (not before)
        const wasManual = this.lastSaveWasManual;
        this.lastSaveWasManual = false;
        
        const writeData = {
            write: {
                content: content,
                wordCount: wordCount,
                changeSummary: wasManual ? 'Manual save' : 'Auto-saved'
            }
        };
        
        return writeData;
    }
}

// ---- Edit Module ----
class EditModule extends BaseEditorModule {
    constructor(globalState, projectManager) {
        super(globalState, projectManager, 'editEditor', 'Edit');
        
        // Register with project manager for data collection
        this.projectManager.registerModule('edit', this);
        this.lastSaveWasManual = false; // Track manual saves for version history
    }

    handleTextChange(content) {
        // Text changes are handled locally, state updated only during save
    }

    // Method called by ProjectManager to collect all edit data
    collectData() {
        const content = this.editor ? this.editor.root.innerHTML : '';
        const wordCount = this.calculateWordCount();
        const currentState = this.globalState.getState();
        
        // Reset flag AFTER collecting data (not before)
        const wasManual = this.lastSaveWasManual;
        this.lastSaveWasManual = false;
        
        const editData = {
            edit: {
                content: content,
                wordCount: wordCount,
                suggestions: currentState.edit?.suggestions || [],
                changeSummary: wasManual ? 'Manual save' : 'Auto-saved'
            }
        };
        
        return editData;
    }
}

// ---- Main Application ----
class AIWritingAssistant {
    constructor() {
        this.globalState = new GlobalState();
        this.api = new ProjectAPI();
        this.projectManager = new ProjectManager(this.globalState, this.api);
        this.chatSystem = new CompleteChatSystem(this.globalState, this.api, this.projectManager);
        this.saveStatus = null; // Save status indicator
        
        this.modules = {
            plan: null,
            write: null,
            edit: null
        };
        
        this.tabManager = null; // Will be initialized after modules
        
        this.init();
    }

    async init() {
        try {
            console.log('AIWritingAssistant.init() called');
            // Set initial activity class
            document.body.classList.add('activity-plan');
            
            // Initialize modules first so they can subscribe to events
            console.log('Initializing modules...');
            this.initializeModules();
            console.log('Modules initialized');
            
            // Initialize TabManager after modules are ready
            console.log('Creating TabManager...');
            console.log('TabManager available:', typeof TabManager);
            this.tabManager = new TabManager(this.globalState);
            console.log('TabManager created:', this.tabManager);
            
            // Wait for project manager to be ready
            await this.waitForProjectManager();
            
            // Setup action buttons
            this.setupActionButtons();
            
            // Setup global event listeners
            this.setupGlobalEvents();

            // Setup autosave status indicator
            this.setupSaveStatusIndicator();
        } catch (error) {
            console.error('Failed to initialize application:', error);
        }
    }

    async waitForProjectManager() {
        if (this.projectManager.ready()) return;
        
        return new Promise((resolve) => {
            this.globalState.subscribe('ready', resolve);
        });
    }

    initializeModules() {
        this.modules.plan = new PlanModule(this.globalState, this.projectManager, this.api);
        this.modules.write = new WriteModule(this.globalState, this.projectManager);
        this.modules.edit = new EditModule(this.globalState, this.projectManager);
        
        // Register chat manager for data collection
        this.projectManager.registerModule('chat', this.chatSystem);
        
        // Initialize version history manager
        this.versionHistory = new VersionHistoryManager(this.api);
        
        // Connect chat manager to global state for UI updates
        this.setupChatManagerConnection();
    }

    setupChatManagerConnection() {
        // Subscribe to state changes to update chat UI
        this.globalState.subscribe('stateChanged', (state) => {
            if (state.chatHistory && Array.isArray(state.chatHistory)) {
                // Only update if the chat history has actually changed
                const currentMessages = this.chatSystem.getMessages();
                if (currentMessages.length !== state.chatHistory.length) {
                    this.chatSystem.loadMessages(state.chatHistory);
                }
            }
        });
        
        // Also listen for the ready event to load initial chat history
        this.globalState.subscribe('ready', (state) => {
            if (state.chatHistory && Array.isArray(state.chatHistory)) {
                this.chatSystem.loadMessages(state.chatHistory);
            }
        });
    }

    setupActionButtons() {
        const saveBtn = document.getElementById('saveBtn');
        const saveExitBtn = document.getElementById('saveExitBtn');
        const exitBtn = document.getElementById('exitBtn');
        
        if (saveBtn) saveBtn.addEventListener('click', () => this.handleSave());
        if (saveExitBtn) saveExitBtn.addEventListener('click', () => this.handleSaveAndExit());
        if (exitBtn) exitBtn.addEventListener('click', () => this.handleExit());
    }

    async handleSave() {
        await this._handleSaveOperation('saveBtn', false);
    }

    async handleSaveAndExit() {
        await this._handleSaveOperation('saveExitBtn', true);
    }

    async _handleSaveOperation(buttonId, shouldExit = false) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        const originalText = button.innerHTML;
        
        try {
            button.disabled = true;
            button.innerHTML = 'Saving...';
            
            // Mark as manual save for version history
            if (this.modules.write) {
                this.modules.write.lastSaveWasManual = true;
            }
            if (this.modules.edit) {
                this.modules.edit.lastSaveWasManual = true;
            }
            
            // Update UI state before saving
            this.updateUIState();
            
            // Use the comprehensive save method from ProjectManager
            const success = await this.projectManager.saveProject();
            
            if (success) {
                button.innerHTML = 'Saved!';
                setTimeout(() => {
                    if (shouldExit) {
                        this.handleExit();
                    } else {
                        button.innerHTML = originalText;
                        button.disabled = false;
                    }
                }, shouldExit ? 1000 : 2000);
            } else {
                this._resetButton(button, originalText);
            }
        } catch (error) {
            console.error('Save error:', error);
            this._resetButton(button, originalText);
        }
    }

    updateUIState() {
        // UI state is collected during save operations, not updated in real-time
    }

    _resetButton(button, originalText) {
        button.innerHTML = 'Save Failed';
        setTimeout(() => {
            button.innerHTML = originalText;
            button.disabled = false;
        }, 3000);
    }

    handleExit() {
        const courseUrl = window.location.href.split('/mod/writeassistdev/')[0] + '/course/view.php?id=' + window.courseId;
        window.location.href = courseUrl;
    }

    setupGlobalEvents() {
        // CompleteChatSystem handles all chat events internally
        // No need for global event listeners

        // Setup export event listeners

        // Listen for project loaded to restore UI
        this.globalState.subscribe('ready', (state) => {
            this.restoreUIFromState(state);
        });

        // Save on tab/background switch (best-effort like Google Docs)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Best-effort immediate save of current project snapshot
                this.projectManager.saveProject().catch(() => {});
            }
        });

        // Save on page unload (best-effort)
        window.addEventListener('beforeunload', () => {
            // Fire-and-forget; browsers may not wait, but it helps
            this.projectManager.saveProject().catch(() => {});
        });
    }

    setupSaveStatusIndicator() {
        // Create status element
        const el = document.createElement('div');
        el.id = 'saveStatusIndicator';
        el.style.cssText = `
            position: fixed;
            bottom: 16px;
            right: 16px;
            background: var(--primary-bg);
            border: 1px solid var(--border-color);
            color: var(--text-color);
            border-radius: 6px;
            padding: 6px 10px;
            font-size: 12px;
            box-shadow: var(--shadow-sm);
            opacity: 0.85;
            display: none;
            z-index: 9999;`;
        document.body.appendChild(el);
        this.saveStatus = el;

        const show = (text) => {
            if (!this.saveStatus) return;
            this.saveStatus.textContent = text;
            this.saveStatus.style.display = 'block';
        };
        const hideLater = (ms = 1500) => {
            if (!this.saveStatus) return;
            setTimeout(() => {
                this.saveStatus.style.display = 'none';
            }, ms);
        };

        // Subscribe to autosave events (skip 'scheduled' to avoid noise)
        this.globalState.subscribe('autosave_saving', () => show('Saving…'));
        this.globalState.subscribe('autosave_saved', () => { show('Saved'); hideLater(); });
        this.globalState.subscribe('autosave_error', () => { show('Save error'); hideLater(3000); });
        this.globalState.subscribe('autosave_offline', () => show('Offline - will save later'));
    }


    restoreUIFromState(state) {
        // Restore chat messages
        if (state.chatHistory && Array.isArray(state.chatHistory)) {
            this.chatSystem.loadMessages(state.chatHistory);
        }

        // Restore current tab
        if (state.metadata && state.metadata.currentTab) {
            this.tabManager.switchTab(state.metadata.currentTab);
        }
    }

    // handleUserMessage is now handled by CompleteChatSystem

    // Handle specific project updates from AI responses
    handleProjectUpdates(updatedProject) {
        // Handle new brainstorm ideas
        if (updatedProject.plan && updatedProject.plan.ideas) {
            this.handleNewIdeas(updatedProject.plan.ideas);
        }
        
        // Handle new edit suggestions
        if (updatedProject.edit && updatedProject.edit.suggestions) {
            this.handleNewSuggestions(updatedProject.edit.suggestions);
        }
        
        // Handle content updates
        if (updatedProject.write && updatedProject.write.content) {
            this.handleContentUpdates(updatedProject.write.content);
        }
    }

    // Handle new ideas from AI responses
    handleNewIdeas(ideas) {
        if (this.modules.plan && Array.isArray(ideas)) {
            // Find new AI-generated ideas
            const newIdeas = ideas.filter(idea => idea.aiGenerated && idea.location === 'brainstorm');
            
            newIdeas.forEach(idea => {
                // Create a new bubble for the AI-generated idea
                const bubble = new BubbleComponent(idea.content, idea.id, true);
                this.modules.plan.bubbles.set(bubble.id, bubble);
                
                // Add to the brainstorm panel
                if (this.modules.plan.elements.ideaBubbles) {
                    this.modules.plan.elements.ideaBubbles.appendChild(bubble.element);
                }
            });
        }
    }

    // Handle new edit suggestions from AI responses
    handleNewSuggestions(suggestions) {
        if (this.modules.edit && Array.isArray(suggestions)) {
            // Find new AI-generated suggestions
            const newSuggestions = suggestions.filter(suggestion => suggestion.aiGenerated);
            
            // Update the edit module with new suggestions
            newSuggestions.forEach(suggestion => {
                // This would integrate with the edit module's suggestion system
                console.log('New AI suggestion:', suggestion);
            });
        }
    }

    // Handle content updates from AI responses
    handleContentUpdates(content) {
        if (this.modules.write && this.modules.write.editor) {
            // Update the write editor content if it has changed
            const currentContent = this.modules.write.editor.root.innerHTML;
            if (currentContent !== content) {
                this.modules.write.editor.root.innerHTML = content;
            }
        }
    }

    // Save project method
    async saveProject() {
        try {
            const success = await this.projectManager.saveProject();
            if (success) {
                console.log('Project saved successfully');
                // Show success feedback
                this.showSaveFeedback('Project saved successfully!', 'success');
            } else {
                console.error('Save project failed');
                this.showSaveFeedback('Failed to save project', 'error');
            }
        } catch (error) {
            console.error('Save project error:', error);
            this.showSaveFeedback('Error saving project: ' + error.message, 'error');
        }
    }

    // Show save feedback
    showSaveFeedback(message, type) {
        // Create feedback element
        const feedback = document.createElement('div');
        feedback.className = `save-feedback ${type}`;
        feedback.textContent = message;
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            ${type === 'success' ? 'background: #28a745;' : 'background: #dc3545;'}
        `;
        
        document.body.appendChild(feedback);
        
        // Remove after 3 seconds
        setTimeout(() => {
            feedback.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
            }, 300);
        }, 3000);
    }

    // Export methods
}

// ---- Application Initialization ----
function initializeApp() {
    console.log('Initializing AI Writing Assistant...');
    
    // Prevent multiple initializations
    if (window.aiWritingAssistant) {
        console.log('AI Writing Assistant already initialized, skipping...');
        return;
    }
    
    try {
        // Wait for all dependencies to be available
        if (typeof TabManager === 'undefined') {
            console.error('TabManager not available');
            return;
        }
        
        window.aiWritingAssistant = new AIWritingAssistant();
        console.log('AI Writing Assistant initialized successfully');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        console.error('Error details:', error.stack);
    }
}

// Wait for DOM and all modules to be ready
function waitForReady() {
if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initializeApp, 100); // Small delay to ensure modules are loaded
        });
} else {
        setTimeout(initializeApp, 100);
    }
}

// Start initialization
waitForReady();

// Global function to check version information (call from browser console)
window.checkVersions = function() {
    if (window.versionInfo) {
        console.log('Plugin Version:', window.versionInfo.plugin_version);
        return window.versionInfo;
    } else {
        console.log('Version information not available');
        return null;
    }
};

// === VERSION HISTORY MANAGER ===
class VersionHistoryManager {
    constructor(api) {
        this.api = api;
        this.currentPhase = 'write';
        this.selectedVersion = null;
        this.elements = {
            modal: document.getElementById('versionHistoryModal'),
            closeBtn: document.getElementById('versionModalClose'),
            openBtn: document.getElementById('versionHistoryBtn'),
            phaseTabs: document.querySelectorAll('.version-tab-btn'),
            versionList: document.getElementById('versionList'),
            previewBtn: document.getElementById('versionPreviewBtn'),
            restoreBtn: document.getElementById('versionRestoreBtn')
        };
        
        this.init();
    }
    
    init() {
        if (this.elements.modal) {
            // Setup event listeners
            if (this.elements.openBtn) {
                this.elements.openBtn.addEventListener('click', () => this.open());
            }
            if (this.elements.closeBtn) {
                this.elements.closeBtn.addEventListener('click', () => this.close());
            }
            if (this.elements.modal) {
                this.elements.modal.addEventListener('click', (e) => {
                    if (e.target === this.elements.modal) this.close();
                });
            }
            
            this.elements.phaseTabs.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.switchPhase(btn.dataset.phase);
                });
            });
            
            if (this.elements.previewBtn) {
                this.elements.previewBtn.addEventListener('click', () => this.previewVersion());
            }
            if (this.elements.restoreBtn) {
                this.elements.restoreBtn.addEventListener('click', () => this.restoreVersion());
            }
        }
    }
    
    async open() {
        if (this.elements.modal) {
            this.elements.modal.style.display = 'flex';
            await this.loadVersions(this.currentPhase);
        }
    }
    
    close() {
        if (this.elements.modal) {
            this.elements.modal.style.display = 'none';
            this.selectedVersion = null;
            this.updateButtons();
        }
    }
    
    async switchPhase(phase) {
        this.currentPhase = phase;
        this.elements.phaseTabs.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.phase === phase);
        });
        this.selectedVersion = null;
        await this.loadVersions(phase);
        this.updateButtons();
    }
    
    async loadVersions(phase) {
        if (!this.elements.versionList) return;
        
        this.elements.versionList.innerHTML = '<div class="version-loading">Loading versions...</div>';
        
        try {
            const versions = await this.api.getVersionHistory(phase);
            
            if (versions.length === 0) {
                this.elements.versionList.innerHTML = '<div class="version-empty">No version history yet</div>';
                return;
            }
            
            const listHtml = versions.map(v => {
                const date = new Date(v.created_at * 1000);
                const dateStr = date.toLocaleString();
                const isSelected = this.selectedVersion === v.version_number;
                
                return `
                    <div class="version-item ${isSelected ? 'selected' : ''}" data-version="${v.version_number}">
                        <div class="version-number">Version ${v.version_number}</div>
                        <div class="version-summary">${v.change_summary || 'Auto-saved'}</div>
                        <div class="version-meta">
                            <span class="version-date">${dateStr}</span>
                            <span class="version-words">${v.word_count || 0} words</span>
                        </div>
                    </div>
                `;
            }).join('');
            
            this.elements.versionList.innerHTML = listHtml;
            
            // Add click handlers
            this.elements.versionList.querySelectorAll('.version-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.elements.versionList.querySelectorAll('.version-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');
                    this.selectedVersion = parseInt(item.dataset.version);
                    this.updateButtons();
                });
            });
        } catch (e) {
            console.error('Failed to load versions:', e);
            this.elements.versionList.innerHTML = '<div class="version-error">Failed to load versions</div>';
        }
    }
    
    updateButtons() {
        const hasSelection = this.selectedVersion !== null;
        if (this.elements.previewBtn) {
            this.elements.previewBtn.disabled = !hasSelection;
        }
        if (this.elements.restoreBtn) {
            this.elements.restoreBtn.disabled = !hasSelection;
        }
    }
    
    async previewVersion() {
        if (!this.selectedVersion) return;
        
        try {
            const version = await this.api.getVersion(this.currentPhase, this.selectedVersion);
            if (version) {
                // Show preview in a temporary div or alert
                const preview = window.open('', '_blank');
                preview.document.write(`
                    <html>
                        <head><title>Version ${version.version_number} Preview</title></head>
                        <body style="padding: 20px; font-family: Arial;">
                            <h2>Version ${version.version_number} Preview</h2>
                            <p><strong>Saved:</strong> ${new Date(version.created_at * 1000).toLocaleString()}</p>
                            <p><strong>Summary:</strong> ${version.change_summary || 'Auto-saved'}</p>
                            <p><strong>Words:</strong> ${version.word_count || 0}</p>
                            <hr>
                            <div>${version.content}</div>
                        </body>
                    </html>
                `);
            }
        } catch (e) {
            console.error('Failed to preview version:', e);
            alert('Failed to preview version');
        }
    }
    
    async restoreVersion() {
        if (!this.selectedVersion) return;
        
        if (!confirm(`Restore Version ${this.selectedVersion}? This will replace your current content.`)) {
            return;
        }
        
        try {
            const success = await this.api.restoreVersion(this.currentPhase, this.selectedVersion);
            if (success) {
                alert('Version restored successfully! Refreshing content...');
                // Reload the editor content
                if (window.aiWritingAssistant && window.aiWritingAssistant.projectManager) {
                    await window.aiWritingAssistant.projectManager.loadProject();
                    // Restore editor content
                    const module = this.currentPhase === 'write' 
                        ? window.aiWritingAssistant.modules.write 
                        : window.aiWritingAssistant.modules.edit;
                    if (module && module.editor) {
                        const currentState = window.aiWritingAssistant.globalState.getState();
                        const phaseData = currentState[this.currentPhase];
                        if (phaseData && phaseData.content) {
                            module.editor.root.innerHTML = phaseData.content;
                        }
                    }
                }
                this.close();
            } else {
                alert('Failed to restore version');
            }
        } catch (e) {
            console.error('Failed to restore version:', e);
            alert('Failed to restore version');
        }
    }
}

// ---- Exports ----
// End of main.js
