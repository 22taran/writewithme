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
                // Ensure goal is set before setting state
                if (!project.metadata) {
                    project.metadata = {};
                }
                if (project.metadata.goal === undefined || project.metadata.goal === null) {
                    project.metadata.goal = '';
                } else {
                    project.metadata.goal = String(project.metadata.goal);
                }

                this.globalState.setState(project);
                // Trigger 'ready' event so modules can restore their UI
                this.globalState.notifyListeners('ready', project);
            } else {
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

        // Get goal from UI element (always read current value for accurate saves)
        // Update metadata with current tab and instructor instructions
        // Note: Goals are now instructor-level per tab, not stored in student metadata
        if (window.aiWritingAssistant && window.aiWritingAssistant.tabManager) {
            const currentTab = window.aiWritingAssistant.tabManager.getCurrentTab();
            collectedData.metadata = {
                ...collectedData.metadata,
                currentTab,
                instructorInstructions: window.instructorDescription || ''
            };
        } else {
            collectedData.metadata = {
                ...collectedData.metadata
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

            // Update global state with collected data to ensure consistency
            this.globalState.setState(completeProjectData, true);


            const result = await this.api.saveProject(completeProjectData);

            if (result && result.success) {
                // Update bubble IDs if mappings provided
                if (result.ideaMappings && this.modules.has('plan')) {
                    this.modules.get('plan').updateBubbleIds(result.ideaMappings);
                }

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
                this.saveProject().catch(() => { });
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
        // Use event delegation on document to catch clicks even if buttons aren't found yet
        this.setupEventDelegation();

        this.setupElements();
        this.setupDragAndDrop();
        this.setupEventListeners();
        this.setupStateSync();

        // Mark as initialized (sections will load when ready event fires)
        this.isInitialized = true;

        // Load sections immediately if state already exists, otherwise wait for ready event
        const currentState = this.globalState.getState();
        if (currentState.plan && (currentState.plan.customSections || currentState.plan.removedSections)) {
            // State already loaded, load sections now
            this.loadSections();
        } else {
            // State not loaded yet, wait for ready event
            this.globalState.subscribe('ready', () => {
                this.loadSections();
            });
        }

        // Update button states after a short delay to ensure DOM is ready
        setTimeout(() => {
            this.updateAskAIButtonState();
            this.updateAskAIOutlineButtonState();
        }, 200);
    }

    setupEventDelegation() {
        // Only set up once to avoid duplicate listeners
        if (this.eventDelegationSetup) {
            return;
        }
        this.eventDelegationSetup = true;

        console.log('Setting up event delegation for Ask AI button');
        // Use event delegation to catch clicks even if buttons aren't in DOM yet or are hidden
        // Only handle our specific buttons - don't interfere with chat or other buttons
        this.delegationHandler = (e) => {
            // Only handle if it's one of our buttons - don't interfere with chat or other buttons
            const targetId = e.target.id;
            const isAskAI = targetId === 'askAIButton' || e.target.closest('#askAIButton');
            const isAskAIOutline = targetId === 'askAIOutlineButton' || e.target.closest('#askAIOutlineButton');
            const isAddIdea = targetId === 'addIdeaBubble';
            const isAddSection = targetId === 'addCustomSection' || e.target.closest('#addCustomSection');

            // Skip if it's not one of our buttons (let other handlers work normally)
            if (!isAskAI && !isAskAIOutline && !isAddIdea && !isAddSection) {
                return;
            }

            // Handle Ask AI button (Brainstorm) - check button itself or any child element (like span)
            if (isAskAI) {
                const askAIButton = targetId === 'askAIButton' ? e.target : e.target.closest('#askAIButton');

                if (askAIButton) {
                    // Check both disabled attribute and disabled class
                    if (askAIButton.disabled || askAIButton.classList.contains('disabled')) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }

                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Ask AI button clicked via event delegation - calling handleAskAIClick');
                    this.handleAskAIClick();
                    return;
                }
            }

            // Handle Ask AI Outline button - check button itself or any child element (like span)
            if (isAskAIOutline) {
                const askAIOutlineButton = targetId === 'askAIOutlineButton' ? e.target : e.target.closest('#askAIOutlineButton');

                if (askAIOutlineButton) {
                    // Check both disabled attribute and disabled class
                    if (askAIOutlineButton.disabled || askAIOutlineButton.classList.contains('disabled')) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }

                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Ask AI Outline button clicked via event delegation - calling handleAskAIOutlineClick');
                    this.handleAskAIOutlineClick();
                    return;
                }
            }

            // Handle Add Idea button
            if (isAddIdea) {
                e.preventDefault();
                e.stopPropagation();
                this.handleAddIdeaClick(e);
                return;
            }

            // Handle Add Custom Section button
            if (isAddSection) {
                e.preventDefault();
                e.stopPropagation();
                this.addCustomSection();
                return;
            }
        };

        document.addEventListener('click', this.delegationHandler);
    }

    setupElements() {
        this.elements = {
            ideaBubbles: this.domManager.getElement('ideaBubbles'),
            outlineItems: this.domManager.getElement('outlineItems'),
            addIdeaBubbleBtn: this.domManager.getElement('addIdeaBubble')
        };

        // If buttons not found, try again after a short delay (in case DOM isn't fully ready)
        if (!this.elements.addIdeaBubbleBtn || !document.getElementById('addCustomSection')) {
            setTimeout(() => {
                this.elements.addIdeaBubbleBtn = this.domManager.getElement('addIdeaBubble');
                if (this.elements.addIdeaBubbleBtn) {
                    this.domManager.addEventListener(this.elements.addIdeaBubbleBtn, 'click', this.handleAddIdeaClick);
                }

                const addCustomSectionBtn = document.getElementById('addCustomSection');
                if (addCustomSectionBtn) {
                    addCustomSectionBtn.addEventListener('click', () => {
                        this.addCustomSection();
                    });
                }
            }, 200);
        }
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

        // Section sortable will be set up after sections are created
        // (called from createSections method)
    }

    setupEventListeners() {
        // Retry finding buttons multiple times with delays
        const maxRetries = 5;
        let retryCount = 0;

        const trySetupButtons = () => {
            retryCount++;

            // Add Idea button
            let btnFound = false;
            if (!this.elements.addIdeaBubbleBtn) {
                const btn = document.getElementById('addIdeaBubble');
                if (btn) {
                    this.elements.addIdeaBubbleBtn = btn;
                    this.domManager.addEventListener(btn, 'click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.handleAddIdeaClick(e);
                    });
                    btnFound = true;
                }
            } else {
                btnFound = true;
            }

            // Add custom section button
            let sectionBtnFound = false;
            const addCustomSectionBtn = document.getElementById('addCustomSection');
            if (addCustomSectionBtn) {
                // Remove any existing listeners first
                const newBtn = addCustomSectionBtn.cloneNode(true);
                addCustomSectionBtn.parentNode.replaceChild(newBtn, addCustomSectionBtn);

                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.addCustomSection();
                });
                sectionBtnFound = true;
            }

            // Ask AI button - use event delegation instead of direct listener
            // The button click is handled in setupEventDelegation()
            const askAIButton = document.getElementById('askAIButton');
            if (askAIButton) {
                // Just update the button state, event delegation handles clicks
                this.updateAskAIButtonState();
            }

            // Ask AI Outline button - update state independently
            const askAIOutlineButton = document.getElementById('askAIOutlineButton');
            if (askAIOutlineButton) {
                this.updateAskAIOutlineButtonState();
            }

            if (btnFound && sectionBtnFound) {
                return true;
            }

            if (retryCount < maxRetries) {
                setTimeout(trySetupButtons, 300);
            }

            return false;
        };

        // Try immediately
        trySetupButtons();

        // Setup goal input autosave (Google Docs style)
        // - Debounced autosave on input (after user stops typing)
        // - Immediate save on blur (when user clicks away)
        // - Save on page unload
        // Goal editing removed - goals are now read-only and come from backend set by instructor
    }

    async saveInstructorGoal(tab, goalValue) {
        if (!window.canEditGoals) return; // Only instructors can save

        try {
            const api = this.projectManager?.api;
            if (!api) return;

            await api.saveInstructorGoal(tab, goalValue);

            // Update window.instructorGoals to reflect the change
            if (window.instructorGoals) {
                window.instructorGoals[tab] = goalValue;
            }
        } catch (error) {
            console.error('Failed to save instructor goal:', error);
            throw error;
        }
    }

    setupEventListeners() {
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

    handleAddIdeaClick(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
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
                // Update Ask AI button state after bubble is deleted
                this.updateAskAIButtonState();
                this.updateAskAIOutlineButtonState();
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
        this.globalState.subscribe('ready', async (state) => {
            // Load sections from database FIRST (before restoring bubbles)
            // Sections must exist before we can restore bubbles to them
            if (this.isInitialized) {
                this.loadSections();

                // Wait a bit for sections to be created in DOM
                // Use requestAnimationFrame to ensure DOM is updated
                await new Promise(resolve => {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            resolve();
                        });
                    });
                });
            }

            // Now restore bubbles after sections are loaded
            if (this.isInitialized && state.plan && state.plan.ideas) {
                this.restoreBubblesFromState(state.plan.ideas);
            }

            // Goals are now instructor-level and displayed per-tab
            // No need to restore from student metadata
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
        // Handle both array and object formats (like chatHistory)
        let ideasArray;
        if (Array.isArray(ideas)) {
            ideasArray = ideas;
        } else if (typeof ideas === 'object' && ideas !== null) {
            // Convert object to array
            ideasArray = Object.values(ideas);
        } else {
            return;
        }

        // Clear existing bubbles
        this.clearAllBubbles();



        // Restore bubbles to their correct locations
        ideasArray.forEach((idea) => {
            if (!idea.id || !idea.content) {
                console.warn('Invalid idea data:', idea);
                return;
            }

            const bubble = new BubbleComponent(idea.content, idea.id, idea.aiGenerated || false);
            this.bubbles.set(bubble.id, bubble);

            // Use setLocation to properly update both internal state and DOM attributes
            if (idea.location === 'brainstorm') {
                bubble.setLocation('brainstorm', null);
                if (this.elements.ideaBubbles) {
                    this.elements.ideaBubbles.appendChild(bubble.element);
                }

                // Add event listeners for content changes (same as in addIdeaBubble)
                const contentDiv = bubble.element.querySelector('.bubble-content');
                if (contentDiv) {
                    bubble.element.addEventListener('bubbleContentChanged', () => {
                        this.updateAskAIButtonState();
                        this.updateAskAIOutlineButtonState();
                    });
                    contentDiv.addEventListener('input', () => {
                        this.updateAskAIButtonState();
                        this.updateAskAIOutlineButtonState();
                    });
                }
            } else if (idea.location === 'outline' && idea.sectionId) {
                // Set location first to update DOM attributes
                bubble.setLocation('outline', idea.sectionId);

                const section = this.sections.get(idea.sectionId);
                if (section && section.element) {
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
                    } else {
                        // Fallback: add to brainstorm if container not found
                        bubble.setLocation('brainstorm', null);
                        if (this.elements.ideaBubbles) {
                            this.elements.ideaBubbles.appendChild(bubble.element);
                        }
                    }
                } else {
                    console.warn('Section not found for bubble:', idea.sectionId, '- bubble will be added to brainstorm as fallback');

                    // Fallback: add to brainstorm if section not found
                    bubble.setLocation('brainstorm', null);
                    if (this.elements.ideaBubbles) {
                        this.elements.ideaBubbles.appendChild(bubble.element);
                    }
                }
            } else {
                console.warn('Invalid bubble location or missing sectionId:', idea);
                // Fallback: add to brainstorm
                bubble.setLocation('brainstorm', null);
                if (this.elements.ideaBubbles) {
                    this.elements.ideaBubbles.appendChild(bubble.element);
                }
            }
        });

        // Update Ask AI button state after restoring bubbles
        // Use setTimeout to ensure DOM is fully updated
        setTimeout(() => {
            this.updateAskAIButtonState();
            this.updateAskAIOutlineButtonState();
        }, 100);
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
                // Moving back to brainstorm - clear sectionId
                bubble.setLocation('brainstorm', null);
            } else {
                // Find which section this was dropped into
                const sectionElement = evt.to.closest('.template-section');
                if (sectionElement) {
                    const sectionId = sectionElement.dataset.sectionId;
                    if (sectionId) {
                        bubble.setLocation('outline', sectionId);
                    } else {
                        console.warn('PlanModule.handleDragEnd(): Section element found but no sectionId');
                    }
                } else {
                    // Try to find section from the dropzone container
                    const dropzone = evt.to.closest('.outline-container');
                    if (dropzone && dropzone.dataset.sectionId) {
                        const sectionId = dropzone.dataset.sectionId;
                        bubble.setLocation('outline', sectionId);
                    } else {
                        console.warn('PlanModule.handleDragEnd(): Could not find section element for dropped bubble');
                    }
                }
            }
        } else {
            console.warn('PlanModule.handleDragEnd(): Bubble not found in bubbles map:', bubbleId);
        }

        // Explicitly save when moving bubble between brainstorm and outline
        try {
            await this.projectManager.saveProject();
        } catch (e) {
            console.warn('PlanModule.handleDragEnd(): Save after drag failed:', e?.message || e);
        }
    }

    /**
     * Load sections from database or create default example sections
     * No template dependency - just example sections to guide users
     */
    loadSections() {
        try {
            // Prevent duplicate loading
            if (this.sectionsLoading) {
                return;
            }
            this.sectionsLoading = true;

            const state = this.globalState.getState();

            // Get saved sections from database
            const savedSections = state.plan?.customSections || [];
            const customTitles = state.plan?.customSectionTitles || {};
            const removedSections = state.plan?.removedSections || [];

            // Start with default example sections (guidance for users)
            const defaultSections = this.getDefaultExampleSections();

            // Filter out removed sections
            const activeDefaults = defaultSections.filter(section =>
                !removedSections.includes(section.id)
            );

            // Apply custom titles to default sections
            const sectionsWithCustomTitles = activeDefaults.map(section => ({
                ...section,
                title: customTitles[section.id] || section.title,
                isCustom: false
            }));

            // Add user's custom sections (filter out any that might have been removed)
            const validCustomSections = savedSections.filter(cs =>
                !removedSections.includes(cs.id)
            );
            const customSectionsWithDefaults = validCustomSections.map(cs => ({
                ...cs,
                required: false,
                allowMultiple: true,
                editableTitle: true,
                editableDescription: true,
                isCustom: true,
                outline: []
            }));

            // Combine all sections
            let allSections = [...sectionsWithCustomTitles, ...customSectionsWithDefaults];

            // Apply saved section order if available
            const savedOrder = state.plan?.sectionOrder || [];
            if (savedOrder.length > 0) {
                // Create a map for quick lookup
                const sectionMap = new Map(allSections.map(s => [s.id, s]));

                // Reorder sections based on saved order
                const orderedSections = [];
                const unorderedSections = [];

                // First, add sections in the saved order
                savedOrder.forEach(sectionId => {
                    if (sectionMap.has(sectionId)) {
                        orderedSections.push(sectionMap.get(sectionId));
                        sectionMap.delete(sectionId);
                    }
                });

                // Then, add any sections that weren't in the saved order (new sections)
                sectionMap.forEach(section => {
                    unorderedSections.push(section);
                });

                allSections = [...orderedSections, ...unorderedSections];
            }

            if (allSections.length > 0) {
                this.createSections(allSections);
            } else {
                // Fallback: create default sections if nothing loaded
                this.createDefaultSections();
            }

            this.sectionsLoading = false;
        } catch (error) {
            console.error('Failed to load sections:', error);
            console.warn('Creating default example sections as fallback');
            this.createDefaultSections();
            this.sectionsLoading = false;
        }
    }

    /**
     * Get default example sections (dummy columns to guide users)
     * These are just examples - users can delete/edit them freely
     */
    getDefaultExampleSections() {
        return [
            {
                id: 'introduction',
                title: 'Introduction',
                description: 'Hook, background, and thesis statement',
                required: false, // Not required - users can delete
                allowMultiple: false,
                editableTitle: true,
                editableDescription: true,
                outline: []
            },
            {
                id: 'main-arguments',
                title: 'Main Arguments',
                description: 'Your key points supporting your thesis',
                required: false,
                allowMultiple: true,
                editableTitle: true,
                editableDescription: true,
                outline: []
            },
            {
                id: 'conclusion',
                title: 'Conclusion',
                description: 'Restate thesis and summarize main points',
                required: false,
                allowMultiple: false,
                editableTitle: true,
                editableDescription: true,
                outline: []
            }
        ];
    }

    createDefaultSections() {
        // Use the same default example sections
        const defaultSections = this.getDefaultExampleSections();
        this.createSections(defaultSections);
    }

    createSections(sections) {
        if (!this.elements.outlineItems) return;

        this.elements.outlineItems.innerHTML = '';



        sections.forEach(sectionData => {
            const section = new SectionComponent(sectionData);
            this.sections.set(section.id, section);

            // Store the original title from template (for comparison later)
            // This is the title that was set when the section was created
            if (!section.originalTitle) {
                section.originalTitle = section.title;
            }

            // Store default title if this is a default example section
            if (!section.isCustom && !section.defaultTitle) {
                const defaultSection = this.getDefaultExampleSections().find(s => s.id === section.id);
                if (defaultSection) {
                    section.defaultTitle = defaultSection.title;
                }
            }

            // Setup drag and drop for this section
            this.setupSectionDragAndDrop(section);

            // Setup event listeners for section title changes and deletions
            this.setupSectionEventListeners(section);

            this.elements.outlineItems.appendChild(section.element);
        });

        // Re-initialize section sortable if it doesn't exist or sections were recreated
        if (this.elements.outlineItems) {
            this.setupSectionSortable();
        }
    }

    setupSectionSortable() {
        if (typeof Sortable === 'undefined') return;
        if (!this.elements.outlineItems) return;

        // Destroy existing sortable if it exists
        if (this.sectionSortable) {
            this.sectionSortable.destroy();
        }

        // Create new sortable instance for sections
        // Allow dragging the entire section (not just header)
        this.sectionSortable = new Sortable(this.elements.outlineItems, {
            animation: 200,
            ghostClass: 'section-ghost',
            chosenClass: 'section-chosen',
            filter: '.section-title, .section-delete-btn, .outline-container, .bubble-content', // Prevent dragging from these elements
            preventOnFilter: false, // Allow normal interaction with filtered elements
            onEnd: (evt) => {
                // Section order changed - save immediately
                this.handleSectionReorder();
            }
        });
    }

    setupSectionEventListeners(section) {
        // Listen for title changes
        section.element.addEventListener('sectionTitleChanged', (event) => {
            const { sectionId, newTitle } = event.detail;
            const section = this.sections.get(sectionId);
            if (section) {
                section.title = newTitle;
                // Trigger autosave
                this.projectManager.scheduleAutoSave('section-title', true);
            }
        });

        // Listen for section deletions/removals (both custom and template sections)
        section.element.addEventListener('sectionDeleted', (event) => {
            const { sectionId, isCustom } = event.detail;
            if (isCustom) {
                // Custom section - delete it completely
                this.deleteCustomSection(sectionId);
            } else {
                // Template section - mark as removed (user doesn't want it)
                this.removeTemplateSection(sectionId);
            }
        });
    }

    addCustomSection() {
        // Generate unique ID for custom section
        const sectionId = 'custom-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const newSection = {
            id: sectionId,
            title: 'New Section',
            description: '',
            required: false,
            allowMultiple: true,
            editableTitle: true,
            editableDescription: true,
            isCustom: true,
            outline: []
        };

        const section = new SectionComponent(newSection);
        this.sections.set(section.id, section);

        // Setup drag and drop
        this.setupSectionDragAndDrop(section);

        // Setup event listeners
        this.setupSectionEventListeners(section);

        // Add to DOM
        if (this.elements.outlineItems) {
            this.elements.outlineItems.appendChild(section.element);

            // Focus on the title so user can immediately edit it
            const titleElement = section.element.querySelector('.section-title');
            if (titleElement) {
                setTimeout(() => {
                    titleElement.focus();
                    // Select all text for easy replacement
                    const range = document.createRange();
                    range.selectNodeContents(titleElement);
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                }, 100);
            }
        } else {
            // Try to find it directly
            const outlineItems = document.getElementById('outlineItems');
            if (outlineItems) {
                this.elements.outlineItems = outlineItems;
                outlineItems.appendChild(section.element);
            }
        }

        // Save immediately to ensure section is persisted
        this.projectManager.saveProject().catch(err => {
            console.error('PlanModule.addCustomSection(): Failed to save:', err);
        });

        return section;
    }

    deleteCustomSection(sectionId) {
        const section = this.sections.get(sectionId);
        if (!section) return;

        // Only allow deletion of custom sections
        if (!section.isCustom) {
            console.warn('Cannot delete required section:', sectionId);
            return;
        }

        // Move all bubbles in this section back to brainstorm
        const bubbles = section.getBubbles();
        bubbles.forEach(bubbleData => {
            const bubble = this.bubbles.get(bubbleData.id);
            if (bubble) {
                bubble.setLocation('brainstorm', null);
                if (this.elements.ideaBubbles) {
                    this.elements.ideaBubbles.appendChild(bubble.element);
                }
            }
        });

        // Remove from sections map
        this.sections.delete(sectionId);

        // Remove from DOM
        if (section.element.parentNode) {
            section.element.parentNode.removeChild(section.element);
        }

        // Save immediately to ensure deletion is persisted
        this.projectManager.saveProject().catch(err => {
            console.error('PlanModule.deleteCustomSection(): Failed to save:', err);
        });
    }

    removeTemplateSection(sectionId) {
        const section = this.sections.get(sectionId);
        if (!section) {
            console.warn(`PlanModule: Cannot remove section ${sectionId} - not found`);
            return;
        }

        // Move all bubbles from this section back to brainstorm
        const bubbles = section.getBubbles();
        bubbles.forEach(bubbleData => {
            const bubble = this.bubbles.get(bubbleData.id);
            if (bubble) {
                bubble.setLocation('brainstorm', null);
                if (this.elements.ideaBubbles) {
                    this.elements.ideaBubbles.appendChild(bubble.element);
                }
            }
        });

        // Remove from sections map
        this.sections.delete(sectionId);

        // Remove from DOM
        if (section.element.parentNode) {
            section.element.parentNode.removeChild(section.element);
        }

        // Save immediately to ensure removal is persisted
        this.projectManager.saveProject().catch(err => {
            console.error('PlanModule.removeTemplateSection(): Failed to save:', err);
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

    handleSectionReorder() {
        // Get current section order from DOM
        const sectionOrder = Array.from(this.elements.outlineItems.children).map(child => {
            return child.dataset.sectionId || child.id.replace('section-', '');
        });

        // Save immediately
        this.projectManager.saveProject().catch(err => {
            console.error('PlanModule.handleSectionReorder(): Failed to save:', err);
        });
    }

    addIdeaBubble(content = ' ') {
        const bubble = new BubbleComponent(content);
        bubble.location = 'brainstorm'; // Set location for tracking
        this.bubbles.set(bubble.id, bubble);

        if (this.elements.ideaBubbles) {
            this.elements.ideaBubbles.appendChild(bubble.element);
            const contentDiv = bubble.element.querySelector('.bubble-content');
            if (contentDiv) {
                contentDiv.focus();

                // Listen to content changes in real-time
                bubble.element.addEventListener('bubbleContentChanged', () => {
                    // Update button state whenever content changes
                    this.updateAskAIButtonState();
                    this.updateAskAIOutlineButtonState();
                });

                // Also listen to input events for immediate updates
                contentDiv.addEventListener('input', () => {
                    // Update button state as user types
                    this.updateAskAIButtonState();
                    this.updateAskAIOutlineButtonState();
                });

                // Save on blur (when user finishes editing)
                contentDiv.addEventListener('blur', () => {
                    // Skip save if we are currently dragging (handleDragEnd will handle it)
                    if (this.isDragging) {
                        return;
                    }

                    const finalContent = contentDiv.textContent.trim();
                    // Only save if bubble has meaningful content (not empty, not just placeholder)
                    if (finalContent && finalContent !== 'New idea' && finalContent.length > 0) {
                        bubble.content = finalContent;
                        this.triggerAutoSave();
                    } else if (!finalContent || finalContent === 'New idea') {
                        // Remove bubble if it's still empty/placeholder when user clicks away
                        bubble.content = finalContent || '';
                        // Don't delete immediately - let user edit it
                    }
                    // Update button state even if content is empty (bubble might be removed)
                    this.updateAskAIButtonState();
                    this.updateAskAIOutlineButtonState();
                }, { once: false });
            }
        } else {
            // Try to find it directly
            const ideaBubbles = document.getElementById('ideaBubbles');
            if (ideaBubbles) {
                this.elements.ideaBubbles = ideaBubbles;
                ideaBubbles.appendChild(bubble.element);
            }
        }

        // Update Ask AI button state when bubble is added
        this.updateAskAIButtonState();

        // Don't autosave immediately - wait until user finishes editing (blur event)
    }


    // Collect current bubble data from UI elements (used only during save operations)
    collectBubbleData() {
        // Get all bubbles from our tracking Map instead of DOM
        const allBubbles = [];

        this.bubbles.forEach((bubble) => {
            const bubbleData = {
                id: bubble.id,
                content: bubble.content,
                location: bubble.location || 'brainstorm',
                sectionId: bubble.sectionId || null,  // CRITICAL: Include sectionId
                aiGenerated: bubble.aiGenerated || false
            };

            allBubbles.push(bubbleData);
        });

        return allBubbles;
    }

    // Legacy method name for compatibility - now just collects data
    saveAllBubbles() {
        return this.collectBubbleData();
    }

    /**
     * Update bubble IDs based on server response
     * @param {Object} mappings Map of client ID -> DB ID
     */
    updateBubbleIds(mappings) {
        if (!mappings || Object.keys(mappings).length === 0) return;

        Object.entries(mappings).forEach(([clientId, dbId]) => {
            // Skip if IDs are same (already synced)
            if (clientId == dbId) return;

            // Ensure dbId is a string for consistency with dataset.id and map keys
            const newId = String(dbId);

            const bubble = this.bubbles.get(clientId);
            if (bubble) {
                // Update internal map
                this.bubbles.delete(clientId);
                this.bubbles.delete(clientId);
                bubble.id = newId;
                this.bubbles.set(newId, bubble);

                // Update DOM element
                if (bubble.element) {
                    bubble.element.dataset.id = newId;
                    // Update any other attributes if needed
                }
            }
        });
    }

    // Method called by ProjectManager to collect all plan data
    collectData() {

        // Collect current bubble data from UI elements
        const currentBubbles = this.collectBubbleData();


        // Collect outline structure with current titles from DOM
        const outline = [];
        const customSectionTitles = {};
        const customSections = [];
        const removedSections = [];

        this.sections.forEach(section => {
            // Get current title from DOM (may have been edited)
            const titleElement = section.element.querySelector('.section-title');
            const currentTitle = titleElement ? titleElement.textContent.trim() : section.title;

            // Store original/default title for comparison
            if (!section.originalTitle) {
                section.originalTitle = section.title || currentTitle;
            }

            // Get default title from example sections if this is a default section
            if (!section.isCustom && !section.defaultTitle) {
                const defaultSection = this.getDefaultExampleSections().find(s => s.id === section.id);
                if (defaultSection) {
                    section.defaultTitle = defaultSection.title;
                }
            }

            // Update section title if changed
            if (currentTitle !== section.title) {
                section.title = currentTitle;
            }

            const sectionData = {
                id: section.id,
                title: currentTitle,
                description: section.description,
                bubbles: section.getBubbles(),
                isCustom: section.isCustom || false,
                required: section.required !== false
            };

            outline.push(sectionData);

            // Track custom sections separately
            if (section.isCustom) {
                customSections.push({
                    id: section.id,
                    title: currentTitle,
                    description: section.description
                });
            } else {
                // Track custom titles for default example sections (if title was changed from default)
                // Use the default title if available, otherwise use original title
                const compareTitle = section.defaultTitle || section.originalTitle;

                if (compareTitle && currentTitle !== compareTitle) {
                    // Title differs from default/original - save as custom
                    customSectionTitles[section.id] = currentTitle;
                } else if (!compareTitle && currentTitle) {
                    // No default/original to compare against, but we have a title - save it
                    customSectionTitles[section.id] = currentTitle;
                } else {
                    // Title matches default - remove from custom titles if it exists
                    if (customSectionTitles[section.id]) {
                        delete customSectionTitles[section.id];
                    }
                }
            }
        });

        // Get removed sections (sections that exist in default examples but not in current sections)
        const defaultSectionIds = this.getDefaultExampleSections().map(s => s.id);
        const currentSectionIds = Array.from(this.sections.keys());
        defaultSectionIds.forEach(defaultSectionId => {
            // If default example section is not in current sections, it was removed
            if (!currentSectionIds.includes(defaultSectionId)) {
                if (!removedSections.includes(defaultSectionId)) {
                    removedSections.push(defaultSectionId);
                }
            }
        });

        // Filter out removed sections from customSections (in case a default was somehow marked as custom)
        const finalCustomSections = customSections.filter(cs =>
            !removedSections.includes(cs.id)
        );

        // Get section order from DOM (current order of sections)
        const sectionOrder = Array.from(this.elements.outlineItems.children).map(child => {
            return child.dataset.sectionId || child.id.replace('section-', '');
        }).filter(id => id); // Filter out any undefined/null IDs

        const planData = {
            plan: {
                ideas: currentBubbles,
                outline: outline,
                customSectionTitles: customSectionTitles,
                customSections: finalCustomSections, // Store all user-created sections (filtered)
                removedSections: removedSections, // Store removed example sections
                sectionOrder: sectionOrder, // Save the order
                customSectionDescriptions: {}
            }
        };


        return planData;
    }

    // Removed template-related methods - no longer needed

    // === Ask AI Button Functionality ===

    updateAskAIButtonState() {
        const askAIButton = document.getElementById('askAIButton');
        if (!askAIButton) {
            console.log('Ask AI button not found');
            return;
        }

        // Count brainstorm ideas (ideas with location === 'brainstorm' and non-empty content)
        // Use getContent() to get current DOM content, not just bubble.content
        const brainstormIdeas = Array.from(this.bubbles.values())
            .filter(bubble => {
                // Check location first
                if (bubble.location !== 'brainstorm') {
                    return false;
                }

                // Get content from DOM (current state) or from bubble.content
                let content = '';
                if (bubble.getContent) {
                    content = bubble.getContent().trim();
                } else {
                    // Fallback: check DOM directly
                    const contentDiv = bubble.element?.querySelector('.bubble-content');
                    if (contentDiv) {
                        content = contentDiv.textContent.trim();
                    } else {
                        content = (bubble.content || '').trim();
                    }
                }

                return content.length > 0;
            });

        const ideaCount = brainstormIdeas.length;
        const hasEnoughIdeas = ideaCount >= 4;

        console.log('Ask AI Button State Update:', {
            totalBubbles: this.bubbles.size,
            brainstormIdeas: ideaCount,
            hasEnoughIdeas: hasEnoughIdeas,
            bubbles: Array.from(this.bubbles.values()).map(b => ({
                id: b.id,
                location: b.location,
                content: b.getContent ? b.getContent() : b.content
            }))
        });

        // Enable/disable button
        askAIButton.disabled = !hasEnoughIdeas;

        // Update tooltip
        if (hasEnoughIdeas) {
            askAIButton.title = 'Ask AI for additional ideas';
            askAIButton.classList.remove('disabled');
        } else {
            askAIButton.title = 'You have to add atleast 4 ideas before';
            askAIButton.classList.add('disabled');
        }
    }

    async handleAskAIClick() {
        console.log('=== handleAskAIClick called ===');

        const askAIButton = document.getElementById('askAIButton');
        console.log('Button found:', !!askAIButton);
        console.log('Button disabled:', askAIButton?.disabled);

        if (!askAIButton) {
            console.error('Ask AI button not found in DOM');
            return;
        }

        if (askAIButton.disabled) {
            console.log('Ask AI button is disabled');
            return;
        }

        console.log('Ask AI button clicked, collecting ideas...');

        // Get brainstorm ideas - use getContent() to get current DOM content
        const brainstormIdeas = Array.from(this.bubbles.values())
            .filter(bubble => {
                // Check location first
                if (bubble.location !== 'brainstorm') {
                    return false;
                }

                // Get content from DOM (current state) or from bubble.content
                let content = '';
                if (bubble.getContent) {
                    content = bubble.getContent().trim();
                } else {
                    // Fallback: check DOM directly
                    const contentDiv = bubble.element?.querySelector('.bubble-content');
                    if (contentDiv) {
                        content = contentDiv.textContent.trim();
                    } else {
                        content = (bubble.content || '').trim();
                    }
                }

                return content.length > 0;
            })
            .map(bubble => {
                // Get content using same method as filter
                if (bubble.getContent) {
                    return bubble.getContent().trim();
                } else {
                    const contentDiv = bubble.element?.querySelector('.bubble-content');
                    if (contentDiv) {
                        return contentDiv.textContent.trim();
                    } else {
                        return (bubble.content || '').trim();
                    }
                }
            });

        console.log('Brainstorm ideas collected:', brainstormIdeas);

        if (brainstormIdeas.length < 4) {
            console.log('Not enough ideas:', brainstormIdeas.length);
            return;
        }

        // Get thesis/goal from assignment goal element or state
        let thesis = '';
        const goalElement = document.getElementById('assignmentGoal');
        if (goalElement) {
            thesis = goalElement.textContent.trim();
        } else {
            // Fallback to state
            const state = this.globalState.getState();
            thesis = state?.metadata?.goal || '';
        }

        console.log('Thesis/goal:', thesis);

        // Format ideas list (comma-separated for inline insertion)
        const ideasList = brainstormIdeas.join(', ');

        // Create the prompt
        const prompt = `I am a student working on a writing assignment, and this is my thesis [${thesis || 'No thesis provided'}]. I have come up with some ideas already [${ideasList}]. Please provide me with 5-10 additional ideas that are related to what I've come up with to help me plan what I want to write about.`;

        console.log('Prompt created:', prompt);

        // Send to chat
        if (window.aiWritingAssistant && window.aiWritingAssistant.chatSystem) {
            // Don't switch tabs - chat is always visible in the left sidebar
            // Just ensure the chat section is visible and send the message

            // Scroll chat into view if needed (optional - chat should already be visible)
            const chatSection = document.querySelector('.chat-section');
            if (chatSection) {
                chatSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }

            // Send the message
            console.log('Sending message to chat system...');
            await window.aiWritingAssistant.chatSystem.sendMessage(prompt);
            console.log('Message sent successfully');
        } else {
            console.error('Chat system not available', {
                aiWritingAssistant: window.aiWritingAssistant,
                chatSystem: window.aiWritingAssistant?.chatSystem
            });
        }
    }

    // === Ask AI Outline Button Functionality ===

    updateAskAIOutlineButtonState() {
        const askAIOutlineButton = document.getElementById('askAIOutlineButton');
        if (!askAIOutlineButton) {
            console.log('Ask AI Outline button not found');
            return;
        }

        // Count brainstorm ideas (ideas with location === 'brainstorm' and non-empty content)
        // Use getContent() to get current DOM content, not just bubble.content
        const brainstormIdeas = Array.from(this.bubbles.values())
            .filter(bubble => {
                // Check location first
                if (bubble.location !== 'brainstorm') {
                    return false;
                }

                // Get content from DOM (current state) or from bubble.content
                let content = '';
                if (bubble.getContent) {
                    content = bubble.getContent().trim();
                } else {
                    // Fallback: check DOM directly
                    const contentDiv = bubble.element?.querySelector('.bubble-content');
                    if (contentDiv) {
                        content = contentDiv.textContent.trim();
                    } else {
                        content = (bubble.content || '').trim();
                    }
                }

                return content.length > 0;
            });

        const ideaCount = brainstormIdeas.length;
        const hasEnoughIdeas = ideaCount >= 5;

        console.log('Ask AI Outline Button State Update:', {
            totalBubbles: this.bubbles.size,
            brainstormIdeas: ideaCount,
            hasEnoughIdeas: hasEnoughIdeas,
            bubbles: Array.from(this.bubbles.values()).map(b => ({
                id: b.id,
                location: b.location,
                content: b.getContent ? b.getContent() : b.content
            }))
        });

        // Enable/disable button
        askAIOutlineButton.disabled = !hasEnoughIdeas;
        console.log('Outline button disabled state:', askAIOutlineButton.disabled, 'hasEnoughIdeas:', hasEnoughIdeas);

        // Update tooltip
        if (hasEnoughIdeas) {
            askAIOutlineButton.title = 'Ask AI to generate an outline based on your brainstorm ideas';
            askAIOutlineButton.classList.remove('disabled');
        } else {
            askAIOutlineButton.title = 'You have to add atleast 4 ideas in brainstorm before';
            askAIOutlineButton.classList.add('disabled');
        }
    }

    async handleAskAIOutlineClick() {
        console.log('=== handleAskAIOutlineClick called ===');

        const askAIOutlineButton = document.getElementById('askAIOutlineButton');
        console.log('Button found:', !!askAIOutlineButton);
        console.log('Button disabled:', askAIOutlineButton?.disabled);

        if (!askAIOutlineButton) {
            console.error('Ask AI Outline button not found in DOM');
            return;
        }

        if (askAIOutlineButton.disabled) {
            console.log('Ask AI Outline button is disabled');
            return;
        }

        console.log('Ask AI Outline button clicked, collecting ideas...');

        // Get brainstorm ideas - use getContent() to get current DOM content
        const brainstormIdeas = Array.from(this.bubbles.values())
            .filter(bubble => {
                // Check location first
                if (bubble.location !== 'brainstorm') {
                    return false;
                }

                // Get content from DOM (current state) or from bubble.content
                let content = '';
                if (bubble.getContent) {
                    content = bubble.getContent().trim();
                } else {
                    // Fallback: check DOM directly
                    const contentDiv = bubble.element?.querySelector('.bubble-content');
                    if (contentDiv) {
                        content = contentDiv.textContent.trim();
                    } else {
                        content = (bubble.content || '').trim();
                    }
                }

                return content.length > 0;
            })
            .map(bubble => {
                // Get content using same method as filter
                if (bubble.getContent) {
                    return bubble.getContent().trim();
                } else {
                    const contentDiv = bubble.element?.querySelector('.bubble-content');
                    if (contentDiv) {
                        return contentDiv.textContent.trim();
                    } else {
                        return (bubble.content || '').trim();
                    }
                }
            });

        console.log('Brainstorm ideas collected:', brainstormIdeas);

        if (brainstormIdeas.length < 4) {
            console.log('Not enough ideas:', brainstormIdeas.length);
            return;
        }

        // Get topic/goal from assignment goal element or state
        let topic = '';
        const goalElement = document.getElementById('assignmentGoal');
        if (goalElement) {
            topic = goalElement.textContent.trim();
        } else {
            // Fallback to state
            const state = this.globalState.getState();
            topic = state?.metadata?.goal || '';
        }

        console.log('Topic/goal:', topic);

        // Format ideas list (comma-separated for inline insertion)
        const ideasList = brainstormIdeas.join(', ');

        // Calculate number of paragraphs based on number of ideas (minimum 3, maximum 8)
        // Rough estimate: 2-3 ideas per paragraph
        const estimatedParagraphs = Math.max(3, Math.min(8, Math.ceil(brainstormIdeas.length / 2.5)));

        // Create the prompt
        const prompt = `I am a student completing a writing assignment on the topic of [${topic || 'No topic provided'}]. I have come up with some ideas that are related to this topic: [${ideasList}]. Provide me with an outline that incorporates my ideas into a ${estimatedParagraphs}-paragraph essay, where the ideas are tied into related groups that will then become my body paragraphs.`;

        console.log('Prompt created:', prompt);

        // Send to chat
        if (window.aiWritingAssistant && window.aiWritingAssistant.chatSystem) {
            // Scroll chat into view if needed
            const chatSection = document.querySelector('.chat-section');
            if (chatSection) {
                chatSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }

            // Send the message
            console.log('Sending message to chat system...');
            await window.aiWritingAssistant.chatSystem.sendMessage(prompt);
            console.log('Message sent successfully');
        } else {
            console.error('Chat system not available', {
                aiWritingAssistant: window.aiWritingAssistant,
                chatSystem: window.aiWritingAssistant?.chatSystem
            });
        }
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

        // For WriteModule, also track selection changes for AI tools
        if (this.moduleName === 'Write') {
            this.setupSelectionTracking();
        }
    }

    setupSelectionTracking() {
        if (!this.editor) return;

        // Wait a bit for DOM to be ready, then setup
        setTimeout(() => {
            // Track selection changes to enable/disable AI tool buttons
            this.editor.on('selection-change', (range) => {
                this.updateAIToolButtons(range);
            });

            // Also track on mouseup and keyup for better responsiveness
            const editorElement = this.editor.root;
            editorElement.addEventListener('mouseup', () => {
                setTimeout(() => {
                    const range = this.editor.getSelection();
                    this.updateAIToolButtons(range);
                }, 10);
            });

            editorElement.addEventListener('keyup', () => {
                setTimeout(() => {
                    const range = this.editor.getSelection();
                    this.updateAIToolButtons(range);
                }, 10);
            });

            // Setup button click handlers
            this.setupAIToolButtons();

            // Initialize button states
            const range = this.editor.getSelection();
            this.updateAIToolButtons(range);
        }, 100);
    }

    updateAIToolButtons(range) {
        const transitionBtn = document.getElementById('transitionBtn');
        const rephraseBtn = document.getElementById('rephraseBtn');

        if (!transitionBtn || !rephraseBtn) return;

        // Check if there's a valid selection with text
        if (range && range.length > 0) {
            const selectedText = this.editor.getText(range.index, range.length).trim();
            if (selectedText.length > 0) {
                this.selectedText = selectedText;
                this.selectedRange = range;

                // Count sentences in selected text for transition button
                const sentenceCount = this.countSentences(selectedText);

                // Update transition button
                if (sentenceCount >= 2) {
                    transitionBtn.disabled = false;
                    transitionBtn.classList.remove('disabled');
                    transitionBtn.title = `Get transition suggestions for ${sentenceCount} selected sentences`;
                } else {
                    transitionBtn.disabled = true;
                    transitionBtn.classList.add('disabled');
                    transitionBtn.title = `Select at least 2 sentences (currently ${sentenceCount})`;
                }

                // Update rephrase button (works for any text selection)
                rephraseBtn.disabled = false;
                rephraseBtn.classList.remove('disabled');
                const textType = this.detectTextType(selectedText);
                rephraseBtn.title = `Rephrase ${textType}`;
                return;
            }
        }

        // No valid selection
        this.selectedText = '';
        this.selectedRange = null;
        transitionBtn.disabled = true;
        transitionBtn.classList.add('disabled');
        transitionBtn.title = 'Select at least two sentences to get transition suggestions';
        rephraseBtn.disabled = true;
        rephraseBtn.classList.add('disabled');
        rephraseBtn.title = 'Select a sentence or paragraph to rephrase';
    }

    detectTextType(text) {
        // Detect if text is a sentence, paragraph, or multiple sentences
        const sentenceCount = this.countSentences(text);
        const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

        if (sentenceCount === 1) {
            return 'sentence';
        } else if (sentenceCount > 1 || wordCount > 20) {
            return 'paragraph';
        } else {
            return 'text';
        }
    }

    countSentences(text) {
        // Count sentences by looking for sentence-ending punctuation
        // Handle periods, exclamation marks, and question marks
        // Exclude common abbreviations like "Mr.", "Dr.", "etc."
        const cleanedText = text.trim();
        if (!cleanedText) return 0;

        // Split by sentence-ending punctuation followed by space, newline, or end of string
        // This regex looks for . ! or ? followed by whitespace or end of string
        const sentences = cleanedText.split(/[.!?]+(?:\s+|$)/).filter(s => s.trim().length > 0);

        // If no clear sentence breaks found, check if text ends with punctuation
        if (sentences.length === 0 && cleanedText.length > 0) {
            // If text ends with punctuation, count as one sentence
            return /[.!?]$/.test(cleanedText) ? 1 : 0;
        }

        // If last sentence doesn't end with punctuation but has content, count it
        const lastChar = cleanedText[cleanedText.length - 1];
        if (sentences.length > 0 && !/[.!?]/.test(lastChar)) {
            // Last sentence might not have ending punctuation
            return sentences.length;
        }

        return sentences.length;
    }

    setupActionButtons() {
        const saveExitBtn = document.getElementById('saveExitBtn');

        if (saveExitBtn) saveExitBtn.addEventListener('click', () => this.handleSaveAndExit());
    }

    async handleSaveAndExit() {
        await this._handleSaveOperation('saveExitBtn', true);
    }

    setupAIToolButtons() {
        const transitionBtn = document.getElementById('transitionBtn');
        const rephraseBtn = document.getElementById('rephraseBtn');

        if (transitionBtn) {
            transitionBtn.addEventListener('click', () => this.handleTransitionHelper());
        }

        if (rephraseBtn) {
            rephraseBtn.addEventListener('click', () => this.handleRephrase());
        }
    }

    async handleTransitionHelper() {
        if (!this.selectedText || this.selectedText.trim().length === 0) {
            alert('Please select at least two sentences to get transition suggestions.');
            return;
        }

        const sentenceCount = this.countSentences(this.selectedText);
        if (sentenceCount < 2) {
            alert(`Please select at least 2 sentences. Currently selected: ${sentenceCount} sentence(s).`);
            return;
        }

        const prompt = `I am a student writing an essay. I have selected two sentences from my writing and need help connecting them smoothly. Please provide some words that I can use to tie these two sentences together to make a smooth transition.

Selected sentences:
${this.selectedText}

Please provide:
1. A list of transition words/phrases (e.g., "Furthermore", "In addition", "However", "On the other hand", etc.)
2. A brief explanation of when each transition would be most appropriate
3. An example of how to use one of the transitions to connect the sentences`;

        // Send to chat system
        if (window.aiWritingAssistant && window.aiWritingAssistant.chatSystem) {
            const chatSection = document.querySelector('.chat-section');
            if (chatSection) {
                chatSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            await window.aiWritingAssistant.chatSystem.sendMessage(prompt);
        } else {
            console.error('Chat system not available');
            alert('Chat system is not available. Please try again later.');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async handleRephrase() {
        if (!this.selectedText || this.selectedText.trim().length === 0) {
            alert('Please select a sentence or paragraph to rephrase.');
            return;
        }

        // Format the prompt as specified by the user
        const prompt = `I am a student writing an essay. Here is a phrase that I have written: ["${this.selectedText}"]. I have used the words in this phrase previously and would like you to provide some options on how I can reword this phrase, while keeping the original meaning.`;

        // Send to chat system
        if (window.aiWritingAssistant && window.aiWritingAssistant.chatSystem) {
            const chatSection = document.querySelector('.chat-section');
            if (chatSection) {
                chatSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            await window.aiWritingAssistant.chatSystem.sendMessage(prompt);
        } else {
            console.error('Chat system not available');
            alert('Chat system is not available. Please try again later.');
        }
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
        this.templateInserted = false; // Track if template has been inserted
        this.selectedText = ''; // Track currently selected text
        this.selectedRange = null; // Track selection range
    }

    handleTextChange(content) {
        // Text changes are handled locally, state updated only during save
    }

    /**
     * Generate template content from outline sections and insert/append into editor
     * If editor is empty, inserts all sections
     * If editor has content, appends only missing sections
     */
    insertOutlineTemplate() {
        if (!this.editor) {
            console.warn('WriteModule: Editor not initialized, cannot insert template');
            return;
        }

        // Check if editor already has content
        // Quill might have empty content like <p><br></p>, <p></p>, or just whitespace
        const currentContent = this.editor.root.innerHTML.trim();
        const isEmpty = !currentContent ||
            currentContent === '<p><br></p>' ||
            currentContent === '<p></p>' ||
            currentContent === '<br>' ||
            currentContent.replace(/<[^>]*>/g, '').trim() === '';

        // Get outline sections from PlanModule
        let sections = [];
        if (window.aiWritingAssistant && window.aiWritingAssistant.modules && window.aiWritingAssistant.modules.plan) {
            const planModule = window.aiWritingAssistant.modules.plan;
            if (planModule.sections && planModule.sections.size > 0) {
                // Get sections in order from outlineItems DOM
                const outlineItems = document.getElementById('outlineItems');
                if (outlineItems) {
                    const sectionOrder = Array.from(outlineItems.children).map(child => {
                        return child.dataset.sectionId || child.id.replace('section-', '');
                    }).filter(id => id);

                    // Build sections array in order
                    sectionOrder.forEach(sectionId => {
                        const section = planModule.sections.get(sectionId);
                        if (section && section.title) {
                            sections.push({
                                id: section.id,
                                title: section.title,
                                description: section.description || ''
                            });
                        }
                    });
                } else {
                    // Fallback: get all sections from Map
                    planModule.sections.forEach((section, id) => {
                        if (section && section.title) {
                            sections.push({
                                id: section.id,
                                title: section.title,
                                description: section.description || ''
                            });
                        }
                    });
                }
            }
        }

        // If no sections found, try template data
        if (sections.length === 0 && window.templateData && window.templateData.sections) {
            sections = window.templateData.sections;
        }

        if (sections.length === 0) {
            console.log('WriteModule: No outline sections found, skipping template insertion');
            return;
        }

        // If editor is empty, insert all sections
        if (isEmpty) {
            // Generate template HTML with headings
            const templateHTML = sections.map((section, index) => {
                // Use h2 for section headings
                let html = `<h2>${this.escapeHtml(section.title)}</h2>`;
                // Add description if available
                if (section.description && section.description.trim()) {
                    html += `<p><em>${this.escapeHtml(section.description)}</em></p>`;
                }
                // Add empty paragraph for user to write content
                html += `<p><br></p>`;
                // Add spacing between sections (except last)
                if (index < sections.length - 1) {
                    html += `<p><br></p>`;
                }
                return html;
            }).join('');

            // Insert template into editor
            this.editor.clipboard.dangerouslyPasteHTML(templateHTML);
            this.templateInserted = true;
            console.log('WriteModule: Outline template inserted with', sections.length, 'sections');
        } else {
            // Editor has content - find and append only missing sections
            const existingHeadings = this.extractExistingHeadings();
            const missingSections = sections.filter(section => {
                // Check if this section's heading already exists in editor
                const sectionTitle = section.title.trim().toLowerCase();
                return !existingHeadings.some(existing =>
                    existing.toLowerCase() === sectionTitle
                );
            });

            if (missingSections.length === 0) {
                console.log('WriteModule: All outline sections already exist in editor');
                return;
            }

            // Append missing sections at the end
            const appendHTML = missingSections.map((section, index) => {
                // Add spacing before new section
                let html = `<p><br></p>`;
                // Use h2 for section headings
                html += `<h2>${this.escapeHtml(section.title)}</h2>`;
                // Add description if available
                if (section.description && section.description.trim()) {
                    html += `<p><em>${this.escapeHtml(section.description)}</em></p>`;
                }
                // Add empty paragraph for user to write content
                html += `<p><br></p>`;
                return html;
            }).join('');

            // Append missing sections at the end
            // Get the current length and insert at the end
            const length = this.editor.getLength();
            // Set selection to the end (before the final newline)
            this.editor.setSelection(length - 1);
            // Convert HTML to Delta format and insert
            const Delta = Quill.import('delta');
            const delta = this.editor.clipboard.convert({ html: appendHTML });
            // Create a new delta that retains existing content and appends new content
            const appendDelta = new Delta()
                .retain(length - 1)
                .concat(delta);
            this.editor.updateContents(appendDelta, 'user');
            // Move cursor to end of newly appended content
            const newLength = this.editor.getLength();
            this.editor.setSelection(newLength - 1);
            console.log('WriteModule: Appended', missingSections.length, 'missing sections to editor');
        }
    }

    /**
     * Extract existing H2 headings from editor to check which sections already exist
     */
    extractExistingHeadings() {
        if (!this.editor) return [];

        const headings = [];
        const editorElement = this.editor.root;
        const h2Elements = editorElement.querySelectorAll('h2');

        h2Elements.forEach(h2 => {
            const text = h2.textContent.trim();
            if (text) {
                headings.push(text);
            }
        });

        return headings;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Method called by ProjectManager to collect all write data
    collectData() {
        const content = this.editor ? this.editor.root.innerHTML : '';
        const wordCount = this.calculateWordCount();
        const changeSummary = this.lastSaveWasManual ? 'Manual save' : 'Auto-saved';

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
    constructor(globalState, projectManager, api) {
        super(globalState, projectManager, 'editEditor', 'Edit');

        // Register with project manager for data collection
        this.projectManager.registerModule('edit', this);
        this.api = api; // Store API reference
        this.lastSaveWasManual = false; // Track manual saves for version history

        // AI Review state
        this.reviewSuggestions = [];
        this.activeHighlights = new Map(); // Map of highlight IDs to suggestion data
        this.reviewPanel = null;
        this.reviewStats = null;
        this.reviewSuggestionsContainer = null;
        this.isReviewing = false;

        // Setup AI Review after editor is initialized
        setTimeout(() => {
            this.setupAIReview();
            this.setupImportWriteContent();
            // Move Quill toolbar to our custom container
            this.moveToolbarToContainer();
        }, 500);
    }

    moveToolbarToContainer() {
        if (!this.editor) return;

        const customToolbar = document.getElementById('editToolbar');
        const quillToolbar = this.editor.container.querySelector('.ql-toolbar');

        if (customToolbar && quillToolbar) {
            // Move the Quill toolbar into our custom container
            customToolbar.appendChild(quillToolbar);
        }
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

    setupAIReview() {
        const reviewBtn = document.getElementById('aiReviewBtn');
        const reviewPanel = document.getElementById('editReviewPanel');
        const reviewPanelClose = document.getElementById('reviewPanelClose');
        const reviewStats = document.getElementById('reviewStats');
        const reviewSuggestionsContainer = document.getElementById('reviewSuggestions');

        if (!reviewBtn || !reviewPanel) return;

        this.reviewPanel = reviewPanel;
        this.reviewStats = reviewStats;
        this.reviewSuggestionsContainer = reviewSuggestionsContainer;

        reviewBtn.addEventListener('click', () => this.handleAIReview());
        reviewPanelClose?.addEventListener('click', () => this.closeReviewPanel());

        // Load saved review results after editor is ready
        setTimeout(() => {
            this.loadSavedReviewResults();
        }, 1000);
    }

    setupImportWriteContent() {
        const importBtn = document.getElementById('importWriteContentBtn');
        if (!importBtn) {
            return;
        }

        // Check if listener is already attached
        if (importBtn.hasAttribute('data-listener-attached')) {
            return;
        }

        importBtn.addEventListener('click', () => this.importWriteContent());
        importBtn.setAttribute('data-listener-attached', 'true');
    }

    /**
     * Import content from Write tab into Edit editor
     */
    importWriteContent() {
        if (!this.editor) {
            alert('Editor not ready. Please try again in a moment.');
            return;
        }

        // Get write content from global state
        const currentState = this.globalState.getState();
        const writeContent = currentState.write?.content;

        if (!writeContent || !writeContent.trim() ||
            writeContent === '<p><br></p>' ||
            writeContent === '<p></p>' ||
            writeContent === '<br>' ||
            writeContent.replace(/<[^>]*>/g, '').trim() === '') {
            // No write content available
            alert('No content available in the Write tab. Please write some content first.');
            return;
        }

        // Check if editor already has content
        const currentEditContent = this.editor.root.innerHTML.trim();
        const isEmpty = !currentEditContent ||
            currentEditContent === '<p><br></p>' ||
            currentEditContent === '<p></p>' ||
            currentEditContent === '<br>' ||
            currentEditContent.replace(/<[^>]*>/g, '').trim() === '';

        // Ask for confirmation if editor has content
        if (!isEmpty) {
            const confirmMessage = 'The editor already contains content. Importing from Write tab will replace the current content. Do you want to continue?';
            if (!confirm(confirmMessage)) {
                return;
            }
        }

        // Insert write content into edit editor
        this.editor.clipboard.dangerouslyPasteHTML(writeContent);
        
        // Track import activity
        if (window.aiWritingAssistant && window.aiWritingAssistant.activityTracker) {
            const importedLength = writeContent.replace(/<[^>]*>/g, '').length;
            window.aiWritingAssistant.activityTracker.trackImport('edit', importedLength);
        }
        
        // Show success message
        const importBtn = document.getElementById('importWriteContentBtn');
        if (importBtn) {
            const originalText = importBtn.querySelector('span').textContent;
            importBtn.querySelector('span').textContent = 'Imported!';
            importBtn.style.opacity = '0.7';
            setTimeout(() => {
                importBtn.querySelector('span').textContent = originalText;
                importBtn.style.opacity = '1';
            }, 2000);
        }
    }

    getReviewStorageKey() {
        const state = this.globalState.getState();
        const projectId = state.currentProject?.id || 'default';
        return `writeassist_ai_review_${projectId}`;
    }

    saveReviewResults() {
        if (!this.reviewSuggestions || this.reviewSuggestions.length === 0) {
            // Clear storage if no suggestions
            localStorage.removeItem(this.getReviewStorageKey());
            return;
        }

        const reviewData = {
            suggestions: this.reviewSuggestions,
            timestamp: new Date().toISOString()
        };

        try {
            localStorage.setItem(this.getReviewStorageKey(), JSON.stringify(reviewData));
        } catch (error) {
            console.error('EditModule: Error saving review results:', error);
        }
    }

    loadSavedReviewResults() {
        if (!this.editor) return;

        try {
            const storageKey = this.getReviewStorageKey();
            const savedData = localStorage.getItem(storageKey);

            if (!savedData) return;

            const reviewData = JSON.parse(savedData);

            if (!reviewData.suggestions || reviewData.suggestions.length === 0) {
                return;
            }

            // Check if the current editor content matches (basic check)
            const currentText = this.editor.getText();
            if (!currentText || currentText.trim().length === 0) {
                return;
            }

            // Restore suggestions
            this.reviewSuggestions = reviewData.suggestions;

            // Apply highlights
            this.applyHighlights();

            // Display results
            this.displayReviewResults();

            // Show panel
            this.showReviewPanel();
        } catch (error) {
            console.error('EditModule: Error loading saved review results:', error);
        }
    }

    async handleAIReview() {
        if (!this.editor) {
            console.error('EditModule: Editor not initialized');
            return;
        }

        const text = this.editor.getText();
        if (!text || text.trim().length === 0) {
            alert('Please add some content to review.');
            return;
        }

        if (this.isReviewing) {
            return; // Already reviewing
        }

        this.isReviewing = true;
        const reviewBtn = document.getElementById('aiReviewBtn');
        if (reviewBtn) {
            reviewBtn.disabled = true;
            const originalHTML = reviewBtn.innerHTML;
            reviewBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M8 2L2 6v8h12V6L8 2z" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M6 8h4M6 11h2" stroke-linecap="round"/>
                </svg>
                <span>Reviewing...</span>
            `;
            reviewBtn.dataset.originalHTML = originalHTML;
        }

        try {
            // Clear previous highlights
            this.clearHighlights();

            // Get plain text content for AI review
            const plainText = this.editor.getText();

            // Call AI API for review
            const suggestions = await this.requestAIReview(plainText);

            if (suggestions && suggestions.length > 0) {
                // Store all suggestions - ensure we have the full array
                // Make a deep copy to prevent any modifications
                this.reviewSuggestions = Array.isArray(suggestions)
                    ? JSON.parse(JSON.stringify(suggestions))
                    : [JSON.parse(JSON.stringify(suggestions))];

                console.log('EditModule: Received suggestions from AI:', this.reviewSuggestions.length);
                console.log('EditModule: Full suggestions array:', JSON.stringify(this.reviewSuggestions, null, 2));
                console.log('EditModule: Count by type:', {
                    spelling: this.reviewSuggestions.filter(s => s.type === 'spelling').length,
                    grammar: this.reviewSuggestions.filter(s => s.type === 'grammar').length,
                    run_on_sentence: this.reviewSuggestions.filter(s => s.type === 'run_on_sentence').length
                });

                this.applyHighlights();

                // Verify suggestions array wasn't modified by applyHighlights
                console.log('EditModule: Suggestions after applyHighlights:', this.reviewSuggestions.length);

                this.displayReviewResults();
                this.showReviewPanel();
                // Save to localStorage
                this.saveReviewResults();
            } else {
                // Show success notification modal instead of alert
                this.showSuccessNotification('No suggestions found. Your document looks good!');
                // Clear saved results if no suggestions
                this.saveReviewResults();
            }
        } catch (error) {
            console.error('EditModule: AI Review error:', error);
            alert('Error performing AI review. Please try again.');
        } finally {
            this.isReviewing = false;
            if (reviewBtn) {
                reviewBtn.disabled = false;
                if (reviewBtn.dataset.originalHTML) {
                    reviewBtn.innerHTML = reviewBtn.dataset.originalHTML;
                    delete reviewBtn.dataset.originalHTML;
                } else {
                    reviewBtn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M8 2L2 6v8h12V6L8 2z" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M6 8h4M6 11h2" stroke-linecap="round"/>
                        </svg>
                        <span>AI Review</span>
                    `;
                }
            }
        }
    }

    async requestAIReview(text) {
        // Use the existing chat API to get AI review
        // Focus on three specific checks: spelling, grammar, and run-on sentences
        // Only flag clear, objective errors - not stylistic preferences
        const prompt = `Please review the following document and check for ONLY clear, objective errors in three categories:
1. Spelling errors - Only flag words that are clearly misspelled (e.g., "recieve" instead of "receive")
2. Grammar mistakes - Only flag clear grammatical errors (e.g., "it's" vs "its" when incorrect, subject-verb disagreement, missing punctuation that creates confusion)
3. Run-on sentences - Only flag sentences that are genuinely run-on (two independent clauses joined without proper punctuation or conjunction)

IMPORTANT GUIDELINES:
- Do NOT suggest stylistic changes or preferences
- Do NOT flag sentences that are long but grammatically correct
- Do NOT suggest changes to word choice unless it's a clear spelling error
- Only flag errors that are objectively wrong, not matters of style or preference
- If the text is well-written with no clear errors, return an empty array []

Return your response as a JSON array where each suggestion has:
- "type": one of "spelling", "grammar", "run_on_sentence"
- "original": the exact text that needs improvement (quote it exactly as it appears)
- "suggestion": the improved version
- "reason": brief explanation of the objective error
- "position": approximate position in text (character index or sentence number)

Document to review:
${text}

Return ONLY a valid JSON array, no other text. If there are no clear errors, return an empty array: []. Example format:
[
  {
    "type": "spelling",
    "original": "recieve",
    "suggestion": "receive",
    "reason": "Incorrect spelling",
    "position": 45
  },
  {
    "type": "grammar",
    "original": "The cat sat on it's mat",
    "suggestion": "The cat sat on its mat",
    "reason": "Incorrect use of apostrophe - 'it's' means 'it is', should be possessive 'its'",
    "position": 120
  },
  {
    "type": "run_on_sentence",
    "original": "I went to the store I bought some milk.",
    "suggestion": "I went to the store. I bought some milk.",
    "reason": "Run-on sentence - two independent clauses need proper punctuation",
    "position": 200
  }
]`;

        try {
            if (!this.api) {
                throw new Error('API not available');
            }

            // Get current project data from global state (required by API)
            const currentProject = this.globalState.getState();

            // Use the sendChatMessage method from API
            const result = await this.api.sendChatMessage(prompt, currentProject);

            if (!result || !result.assistantReply) {
                throw new Error('No response from AI');
            }

            const aiResponse = result.assistantReply;

            // Parse JSON from AI response
            // Try to extract JSON array from the response
            let jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                // Try to find JSON in code blocks
                jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) ||
                    aiResponse.match(/```\s*([\s\S]*?)\s*```/);
                if (jsonMatch) {
                    jsonMatch = [jsonMatch[0], jsonMatch[1]];
                }
            }

            if (jsonMatch) {
                const jsonStr = jsonMatch[1] || jsonMatch[0];
                const suggestions = JSON.parse(jsonStr);
                return Array.isArray(suggestions) ? suggestions : [];
            }

            // Fallback: try to parse the entire response as JSON
            try {
                const suggestions = JSON.parse(aiResponse);
                return Array.isArray(suggestions) ? suggestions : [];
            } catch (e) {
                console.warn('EditModule: Could not parse AI response as JSON:', aiResponse);
                return [];
            }
        } catch (error) {
            console.error('EditModule: Error requesting AI review:', error);
            throw error;
        }
    }

    applyHighlights() {
        if (!this.editor || !this.reviewSuggestions.length) return;

        // Get the full text content
        const fullText = this.editor.getText();
        const delta = this.editor.getContents();

        // Track used positions to handle duplicate text
        const usedPositions = new Set();

        // First, find positions for all suggestions (without using usedPositions for sorting)
        const suggestionsWithPositions = this.reviewSuggestions.map((suggestion, originalIndex) => {
            const originalText = suggestion.original.trim();
            const position = this.findTextPosition(fullText, originalText, null); // Don't use usedPositions for initial find
            return {
                suggestion,
                originalIndex,
                position,
                originalText
            };
        }).filter(item => item.position !== -1); // Filter out suggestions we can't find

        // Sort by position (reverse order to maintain indices when applying)
        suggestionsWithPositions.sort((a, b) => b.position - a.position);

        // Apply highlights from end to beginning to maintain positions
        suggestionsWithPositions.forEach((item, sortedIndex) => {
            const { suggestion, originalIndex, originalText } = item;

            // Find the next available position (handling duplicates)
            let position = this.findTextPosition(fullText, originalText, usedPositions);

            if (position === -1) {
                console.warn('EditModule: Could not find available position for suggestion:', originalText);
                return;
            }

            // Mark this position as used
            usedPositions.add(position);

            // Convert text position to Quill index
            const quillIndex = this.textPositionToQuillIndex(position, originalText.length);

            if (quillIndex !== -1) {
                const highlightId = `review-${originalIndex}`;
                this.highlightText(quillIndex, originalText.length, highlightId, suggestion);
            }
        });
    }

    findTextPosition(text, searchText, usedPositions = null) {
        // Find the position of the text, handling case-insensitive and whitespace variations
        const normalizedText = text.toLowerCase();
        const normalizedSearch = searchText.toLowerCase().trim();

        let position = normalizedText.indexOf(normalizedSearch);

        // If we need to avoid used positions, find the next available occurrence
        if (usedPositions && position !== -1) {
            // Keep searching until we find a position that hasn't been used
            while (position !== -1 && usedPositions.has(position)) {
                // Find next occurrence starting after current position
                position = normalizedText.indexOf(normalizedSearch, position + 1);
            }
        }

        if (position === -1) {
            // Try with more flexible matching
            const words = normalizedSearch.split(/\s+/);
            if (words.length > 1) {
                // Try to find as phrase
                position = normalizedText.indexOf(normalizedSearch);

                // If we need to avoid used positions, find the next available occurrence
                if (usedPositions && position !== -1) {
                    while (position !== -1 && usedPositions.has(position)) {
                        position = normalizedText.indexOf(normalizedSearch, position + 1);
                    }
                }
            }
        }

        return position;
    }

    textPositionToQuillIndex(textPosition, length) {
        // Convert plain text position to Quill index
        // Quill uses a different indexing system (includes formatting)
        if (!this.editor) return -1;

        const text = this.editor.getText();
        if (textPosition < 0 || textPosition >= text.length) {
            console.warn('EditModule: Invalid text position:', textPosition, 'text length:', text.length);
            return -1;
        }

        // Get the Delta and find the corresponding index
        const delta = this.editor.getContents();
        if (!delta || !delta.ops) {
            console.warn('EditModule: Invalid delta structure');
            return -1;
        }

        let quillIndex = 0;
        let textIndex = 0;

        for (let i = 0; i < delta.ops.length; i++) {
            const op = delta.ops[i];
            if (typeof op.insert === 'string') {
                const opLength = op.insert.length;
                if (textIndex + opLength > textPosition) {
                    // Found the position within this operation
                    quillIndex += textPosition - textIndex;
                    // Validate the result
                    const editorLength = this.editor.getLength();
                    if (quillIndex >= editorLength) {
                        console.warn('EditModule: Calculated Quill index exceeds editor length:', quillIndex, 'editor length:', editorLength);
                        return -1;
                    }
                    return quillIndex;
                }
                textIndex += opLength;
                quillIndex += opLength;
            } else if (op.insert && typeof op.insert === 'object') {
                // Formatting characters (images, etc.) - skip in text count but add to quill index
                quillIndex += 1;
            }
        }

        // If we reach here, position is at or beyond the end
        const editorLength = this.editor.getLength();
        if (quillIndex >= editorLength) {
            console.warn('EditModule: Calculated Quill index exceeds editor length:', quillIndex, 'editor length:', editorLength);
            return -1;
        }

        return quillIndex;
    }

    highlightText(index, length, highlightId, suggestion) {
        if (!this.editor) return;

        try {
            // Validate indices
            const editorLength = this.editor.getLength();
            if (index < 0 || index >= editorLength) {
                console.warn('EditModule: Invalid index for highlight:', index, 'editor length:', editorLength);
                return;
            }

            // Ensure length doesn't exceed editor bounds
            // Quill's getLength() includes the trailing newline, so we need to account for that
            const maxLength = editorLength - index - 1; // -1 for the trailing newline
            const actualLength = Math.max(1, Math.min(length, maxLength));
            if (actualLength <= 0 || index + actualLength > editorLength) {
                console.warn('EditModule: Invalid length for highlight:', length, 'at index:', index, 'max length:', maxLength, 'editor length:', editorLength);
                return;
            }

            // Apply highlight format using Quill's API correctly
            // Use 'silent' source to avoid triggering text-change events
            // Ensure we're not trying to format the trailing newline
            const formatLength = Math.min(actualLength, editorLength - index - 1);
            if (formatLength <= 0) {
                console.warn('EditModule: Format length is invalid:', formatLength, 'index:', index, 'editor length:', editorLength);
                return;
            }

            try {
                // IMPORTANT: Only apply formatting (colors), NEVER modify text content
                // formatText with only 'background' and 'color' properties does NOT change text
                // This is read-only highlighting - the text content remains unchanged
                this.editor.formatText(index, formatLength, {
                    'background': this.getHighlightColor(suggestion.type),
                    'color': '#000'
                }, 'silent');
            } catch (formatError) {
                console.error('EditModule: Error in formatText:', formatError, 'index:', index, 'length:', formatLength);
                return;
            }

            // Store highlight data
            this.activeHighlights.set(highlightId, {
                index,
                length: formatLength,
                suggestion,
                highlightId
            });

            // Add click handler to the highlighted text
            this.setupHighlightClick(index, formatLength, highlightId, suggestion);
        } catch (error) {
            console.error('EditModule: Error highlighting text:', error);
            console.error('EditModule: Index:', index, 'Length:', length, 'Editor length:', this.editor?.getLength());
        }
    }

    getHighlightColor(type) {
        const colors = {
            'spelling': '#ffeb3b',      // Yellow for spelling
            'grammar': '#ff9800',       // Orange for grammar
            'run_on_sentence': '#f44336' // Red for run-on sentences
        };
        return colors[type] || '#ffeb3b';
    }

    setupHighlightClick(index, length, highlightId, suggestion) {
        // We'll handle clicks on the editor and check if they're on highlighted text
        // This is set up once in setupEventListeners
    }

    clearHighlights() {
        if (!this.editor) return;

        // Remove all highlights - ONLY remove formatting, NEVER modify text content
        // Setting background and color to empty strings removes formatting but keeps text unchanged
        this.activeHighlights.forEach((data, highlightId) => {
            try {
                this.editor.formatText(data.index, data.length, {
                    'background': '',
                    'color': ''
                }, 'user');
            } catch (error) {
                // Ignore errors for already removed highlights
            }
        });

        this.activeHighlights.clear();

        // Clear saved results when highlights are cleared
        this.reviewSuggestions = [];
        this.saveReviewResults();
    }

    displayReviewResults() {
        if (!this.reviewStats || !this.reviewSuggestionsContainer) return;

        // Ensure we have an array
        if (!Array.isArray(this.reviewSuggestions)) {
            console.error('EditModule: reviewSuggestions is not an array:', this.reviewSuggestions);
            this.reviewSuggestions = [];
            return;
        }

        console.log('EditModule: Displaying review results, total suggestions:', this.reviewSuggestions.length);

        // Count suggestions by type
        const counts = {
            spelling: 0,
            grammar: 0,
            run_on_sentence: 0
        };

        this.reviewSuggestions.forEach(s => {
            if (s && s.type && counts.hasOwnProperty(s.type)) {
                counts[s.type]++;
            }
        });

        // Display stats
        this.reviewStats.innerHTML = `
            <div class="review-stat-item">
                <span class="stat-label">Total Issues:</span>
                <span class="stat-value">${this.reviewSuggestions.length}</span>
            </div>
            ${Object.entries(counts).filter(([_, count]) => count > 0).map(([type, count]) => `
                <div class="review-stat-item">
                    <span class="stat-label">${this.formatTypeName(type)}:</span>
                    <span class="stat-value">${count}</span>
                </div>
            `).join('')}
        `;

        // Display ALL suggestions list - no filtering
        // Log all suggestions before rendering
        console.log('EditModule: All suggestions to display:', this.reviewSuggestions);
        console.log('EditModule: Count by type:', {
            spelling: this.reviewSuggestions.filter(s => s.type === 'spelling').length,
            grammar: this.reviewSuggestions.filter(s => s.type === 'grammar').length,
            run_on_sentence: this.reviewSuggestions.filter(s => s.type === 'run_on_sentence').length
        });

        const suggestionHTMLs = this.reviewSuggestions.map((suggestion, index) => {
            if (!suggestion || !suggestion.original) {
                console.warn('EditModule: Invalid suggestion at index', index, suggestion);
                return '';
            }
            const highlightId = `review-${index}`;
            console.log(`EditModule: Rendering suggestion ${index}:`, {
                type: suggestion.type,
                original: suggestion.original.substring(0, 50) + '...',
                highlightId
            });
            return `
                <div class="review-suggestion-item" data-highlight-id="${highlightId}" data-suggestion-index="${index}">
                    <div class="suggestion-header">
                        <span class="suggestion-type ${suggestion.type}">${this.formatTypeName(suggestion.type)}</span>
                    </div>
                    <div class="suggestion-content">
                        <div class="suggestion-original">
                            <strong>Original:</strong> "${suggestion.original}"
                        </div>
                        <div class="suggestion-improved">
                            <strong>Suggested:</strong> "${suggestion.suggestion || suggestion.suggested || 'N/A'}"
                        </div>
                        <div class="suggestion-reason">
                            ${suggestion.reason || 'No reason provided'}
                        </div>
                    </div>
                </div>
            `;
        }).filter(html => html !== '');

        console.log('EditModule: Generated', suggestionHTMLs.length, 'HTML items');
        this.reviewSuggestionsContainer.innerHTML = suggestionHTMLs.join('');

        // Verify what was actually rendered
        const renderedItems = this.reviewSuggestionsContainer.querySelectorAll('.review-suggestion-item');
        console.log('EditModule: Actually rendered', renderedItems.length, 'suggestion items in DOM');

        // Log each rendered item
        renderedItems.forEach((item, idx) => {
            const type = item.querySelector('.suggestion-type')?.textContent;
            const original = item.querySelector('.suggestion-original')?.textContent?.substring(0, 50);
            console.log(`EditModule: Rendered item ${idx}:`, { type, original: original + '...' });
        });

        // Add click handler to scroll to highlight
        this.reviewSuggestionsContainer.querySelectorAll('.review-suggestion-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const highlightId = item.dataset.highlightId;
                this.scrollToHighlight(highlightId);
            });
        });
    }

    formatTypeName(type) {
        const names = {
            'spelling': 'Spelling',
            'grammar': 'Grammar',
            'run_on_sentence': 'Run-on Sentence'
        };
        return names[type] || type;
    }


    showSuccessNotification(message) {
        const modal = document.getElementById('successNotificationModal');
        const messageEl = document.getElementById('successNotificationMessage');
        const closeBtn = document.getElementById('successNotificationClose');

        if (!modal || !messageEl) return;

        // Set message
        messageEl.textContent = message || 'Your document looks good!';

        // Show modal
        modal.style.display = 'flex';

        // Close handlers
        const closeModal = () => {
            modal.style.display = 'none';
        };

        if (closeBtn) {
            closeBtn.onclick = closeModal;
        }

        // Close on background click
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeModal();
            }
        };

        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    scrollToHighlight(highlightId) {
        const highlightData = this.activeHighlights.get(highlightId);
        if (!highlightData) return;

        // Set selection to highlight
        this.editor.setSelection(highlightData.index, highlightData.length);

        // Scroll into view
        const editorElement = this.editor.root;
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.getBoundingClientRect();
            editorElement.scrollTop = range.getBoundingClientRect().top - editorElement.getBoundingClientRect().top + editorElement.scrollTop - 100;
        }
    }

    showReviewPanel() {
        if (this.reviewPanel) {
            this.reviewPanel.style.display = 'block';
        }
    }

    closeReviewPanel() {
        if (this.reviewPanel) {
            this.reviewPanel.style.display = 'none';
        }
        this.clearHighlights();
        this.reviewSuggestions = [];
        this.activeHighlights.clear();
    }

    setupEventListeners() {
        super.setupEventListeners();

        // Add click handler for highlighted text
        if (this.editor) {
            this.editor.root.addEventListener('click', (e) => {
                // Check if click is on highlighted text
                const selection = this.editor.getSelection();
                if (selection) {
                    // Check if any highlight overlaps with selection
                    this.activeHighlights.forEach((data, highlightId) => {
                        if (selection.index >= data.index && selection.index < data.index + data.length) {
                            // Show suggestion popup or scroll to it
                            const index = parseInt(highlightId.replace('review-', ''));
                            this.showSuggestionPopup(index, data.suggestion);
                        }
                    });
                }
            });
        }
    }

    showSuggestionPopup(index, suggestion) {
        // Create or update popup to show suggestion
        let popup = document.getElementById('suggestionPopup');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'suggestionPopup';
            popup.className = 'suggestion-popup';
            document.body.appendChild(popup);
        }

        popup.innerHTML = `
            <div class="popup-header">
                <span class="popup-type ${suggestion.type}">${this.formatTypeName(suggestion.type)}</span>
                <button class="popup-close" onclick="this.closest('.suggestion-popup').remove()">×</button>
            </div>
            <div class="popup-content">
                <div><strong>Original:</strong> "${suggestion.original}"</div>
                <div><strong>Suggested:</strong> "${suggestion.suggestion}"</div>
                <div>${suggestion.reason || ''}</div>
            </div>
        `;

        // Position popup near cursor
        const selection = this.editor.getSelection();
        if (selection) {
            const bounds = this.editor.getBounds(selection.index);
            if (bounds) {
                popup.style.top = `${bounds.top + bounds.height + 10}px`;
                popup.style.left = `${bounds.left}px`;
            }
        }
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
        this.activityTracker = null; // Activity tracking

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
            this.tabManager = new TabManager(this.globalState, this.projectManager);
            console.log('TabManager created:', this.tabManager);

            // Wait for project manager to be ready
            await this.waitForProjectManager();

            // Setup action buttons
            this.setupActionButtons();
            this.setupSubmission();
            this.setupExport();

            // Setup global event listeners
            this.setupGlobalEvents();

            // Setup chat resizer
            this.setupChatResizer();

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
        this.modules.edit = new EditModule(this.globalState, this.projectManager, this.api);
        // Make editModule globally accessible for popup handlers
        window.editModule = this.modules.edit;

        // Register chat manager for data collection
        this.projectManager.registerModule('chat', this.chatSystem);

        // Initialize version history manager
        this.versionHistory = new VersionHistoryManager(this.api);
        
        // Initialize activity tracker (if ActivityTracker is available)
        if (typeof ActivityTracker !== 'undefined' && window.writeassistdevId && window.userId) {
            this.activityTracker = new ActivityTracker(
                this.globalState,
                this.api,
                window.writeassistdevId,
                window.userId
            );
            this.activityTracker.setupUnloadHandler();
        }
        
        // Connect chat manager to global state for UI updates
        this.setupChatManagerConnection();
    }

    setupChatManagerConnection() {
        // Subscribe to state changes to update chat UI
        // NOTE: We're more careful here to avoid overwriting fresh database data
        this.globalState.subscribe('stateChanged', (state) => {
            if (state.chatHistory && Array.isArray(state.chatHistory)) {
                // Only update if the chat history has actually changed AND we're not loading from DB
                const currentMessages = this.chatSystem.getMessages();
                // Only reload if state has MORE messages (new messages added) and we're not loading from DB
                if (state.chatHistory.length > currentMessages.length &&
                    !this.chatSystem.isLoadingHistory &&
                    !this.chatSystem.isLoadingFromDatabase) {
                    // Use syncWithGlobalState instead of loadMessages to add only new messages
                    this.chatSystem.syncWithGlobalState(state.chatHistory);
                }
            }
        });

        // Don't load from state on ready - let loadChatHistory() handle it from database
        // This prevents old cached state from overwriting fresh database data
        // this.globalState.subscribe('ready', (state) => {
        //     if (state.chatHistory && Array.isArray(state.chatHistory)) {
        //         this.chatSystem.loadMessages(state.chatHistory);
        //     }
        // });
    }

    setupActionButtons() {
        const saveExitBtn = document.getElementById('saveExitBtn');

        if (saveExitBtn) saveExitBtn.addEventListener('click', () => this.handleSaveAndExit());
    }

    setupSubmission() {
        const submitBtn = document.getElementById('submitAssignmentBtn');
        if (!submitBtn) return;

        // Initial state check
        if (window.submissionStatus === 'submitted') {
            this.setSubmittedState(submitBtn);
        }

        submitBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to submit your assignment? You will not be able to make further changes.')) {
                try {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = 'Submitting...';

                    // Save first to ensure latest changes are captured
                    await this.projectManager.saveProject();

                    const success = await this.api.submitProject();
                    if (success) {
                        window.submissionStatus = 'submitted';
                        this.setSubmittedState(submitBtn);
                        this.modules.edit.showSuccessNotification('Assignment submitted successfully!');
                    } else {
                        alert('Failed to submit assignment. Please try again.');
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = `
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                            <span>Submit Assignment</span>
                        `;
                    }
                } catch (error) {
                    console.error('Submission error:', error);
                    alert('An error occurred during submission.');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Submit Assignment';
                }
            }
        });
    }

    setupExport() {
        const exportBtn = document.getElementById('exportWorkBtn');
        if (!exportBtn) return;

        // Create dropdown menu
        const dropdown = document.createElement('div');
        dropdown.className = 'export-dropdown';
        dropdown.style.cssText = 'position: absolute; background: white; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 8px 0; min-width: 150px; z-index: 1000; display: none;';
        
        const docxOption = document.createElement('a');
        docxOption.href = '#';
        docxOption.className = 'export-option';
        docxOption.style.cssText = 'display: block; padding: 8px 16px; text-decoration: none; color: #333; cursor: pointer;';
        docxOption.innerHTML = '📄 Export as DOCX';
        docxOption.addEventListener('click', (e) => {
            e.preventDefault();
            this.exportWork('docx');
            dropdown.style.display = 'none';
        });

        const pdfOption = document.createElement('a');
        pdfOption.href = '#';
        pdfOption.className = 'export-option';
        pdfOption.style.cssText = 'display: block; padding: 8px 16px; text-decoration: none; color: #333; cursor: pointer; border-top: 1px solid #eee;';
        pdfOption.innerHTML = '📑 Export as PDF';
        pdfOption.addEventListener('click', (e) => {
            e.preventDefault();
            this.exportWork('pdf');
            dropdown.style.display = 'none';
        });

        dropdown.appendChild(docxOption);
        dropdown.appendChild(pdfOption);
        document.body.appendChild(dropdown);

        // Position dropdown relative to button
        const positionDropdown = () => {
            const rect = exportBtn.getBoundingClientRect();
            dropdown.style.top = (rect.bottom + 5) + 'px';
            dropdown.style.left = rect.left + 'px';
        };

        // Toggle dropdown on button click
        exportBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            positionDropdown();
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!exportBtn.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });

        // Hover effects
        [docxOption, pdfOption].forEach(option => {
            option.addEventListener('mouseenter', () => {
                option.style.backgroundColor = '#f5f5f5';
            });
            option.addEventListener('mouseleave', () => {
                option.style.backgroundColor = 'transparent';
            });
        });
    }

    exportWork(format) {
        // Save project first to ensure latest content is exported
        this.projectManager.saveProject().then(() => {
            // Get the base URL from Moodle
            const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.indexOf('/mod/writeassistdev/'));
            const url = baseUrl + '/mod/writeassistdev/export.php';
            const params = new URLSearchParams({
                id: window.cmid || new URLSearchParams(window.location.search).get('id'),
                format: format
            });
            
            // Open in new window to trigger download
            window.open(url + '?' + params.toString(), '_blank');
        }).catch(error => {
            console.error('Error saving before export:', error);
            // Still try to export even if save fails
            const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.indexOf('/mod/writeassistdev/'));
            const url = baseUrl + '/mod/writeassistdev/export.php';
            const params = new URLSearchParams({
                id: window.cmid || new URLSearchParams(window.location.search).get('id'),
                format: format
            });
            window.open(url + '?' + params.toString(), '_blank');
        });
    }

    setSubmittedState(btn) {
        btn.disabled = true;
        btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>Submitted</span>
        `;
        btn.style.backgroundColor = '#6c757d';

        // Disable editors
        if (this.modules.write && this.modules.write.editor) {
            this.modules.write.editor.disable();
        }
        if (this.modules.edit && this.modules.edit.editor) {
            this.modules.edit.editor.disable();
        }

        // Disable other controls
        const controls = document.querySelectorAll('.ai-tool-btn, #addIdeaBubble, #addCustomSection');
        controls.forEach(el => {
            el.disabled = true;
            el.classList.add('disabled');
        });
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
                this.projectManager.saveProject().catch(() => { });
            }
        });

        // Save on page unload (best-effort)
        window.addEventListener('beforeunload', () => {
            // Fire-and-forget; browsers may not wait, but it helps
            this.projectManager.saveProject().catch(() => { });
        });
    }

    setupChatResizer() {
        const resizer = document.getElementById('chatResizer');
        const chatSection = document.querySelector('.chat-section');

        if (!resizer || !chatSection) {
            console.warn('Chat resizer elements not found');
            return;
        }

        // Load saved width from localStorage
        const savedWidth = localStorage.getItem('writeassistdev_chat_width');
        if (savedWidth) {
            const width = parseInt(savedWidth, 10);
            if (width >= 250 && width <= 600) {
                document.documentElement.style.setProperty('--chat-width', `${width}px`);
            }
        }

        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        const startResize = (e) => {
            isResizing = true;
            startX = e.clientX || e.touches?.[0]?.clientX;
            startWidth = chatSection.offsetWidth;

            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            resizer.style.background = 'var(--accent-primary)';

            e.preventDefault();
        };

        const resize = (e) => {
            if (!isResizing) return;

            const currentX = e.clientX || e.touches?.[0]?.clientX;
            const diff = currentX - startX;
            const newWidth = startWidth + diff;

            // Constrain width between min and max
            const minWidth = 250;
            const maxWidth = 600;
            const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

            document.documentElement.style.setProperty('--chat-width', `${constrainedWidth}px`);

            e.preventDefault();
        };

        const stopResize = () => {
            if (!isResizing) return;

            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            resizer.style.background = '';

            // Save width to localStorage
            const currentWidth = chatSection.offsetWidth;
            localStorage.setItem('writeassistdev_chat_width', currentWidth.toString());
        };

        // Mouse events
        resizer.addEventListener('mousedown', startResize);
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);

        // Touch events for mobile
        resizer.addEventListener('touchstart', startResize);
        document.addEventListener('touchmove', resize);
        document.addEventListener('touchend', stopResize);

        console.log('Chat resizer initialized');
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
        console.log('=== restoreUIFromState START ===');
        console.log('Full state:', JSON.stringify(state, null, 2));
        console.log('Metadata:', state?.metadata);
        console.log('Goal value:', state?.metadata?.goal);
        console.log('Goal type:', typeof state?.metadata?.goal);

        // Get goal value to restore (store it now before any async operations)
        const goalToRestore = (state?.metadata?.goal !== undefined && state?.metadata?.goal !== null)
            ? String(state.metadata.goal)
            : '';
        console.log('Goal to restore:', goalToRestore);

        // Restore current tab FIRST, then restore goal (since goal input is in Plan tab)
        // Use a callback to ensure tab switch completes before restoring goal
        if (state.metadata && state.metadata.currentTab) {
            this.tabManager.switchTab(state.metadata.currentTab);

            // Ensure Plan tab content is visible before restoring goal
            const planTab = document.getElementById('plan');
            if (planTab && !planTab.classList.contains('active')) {
                planTab.classList.add('active');
            }
        }

        // Goals are now read-only and come from backend (instructor-set)
        // No need to restore goals from state - they are set by instructor in mod_form.php
        // and displayed via updateGoalForTab() which uses window.instructorGoals
        console.log('Goal restoration skipped - goals are instructor-set and come from backend');

        // Restore chat messages - but only if not already loaded from database
        // This prevents old cached state from overwriting fresh database data
        if (state.chatHistory && Array.isArray(state.chatHistory)) {
            // Only restore from state if we haven't loaded from database yet
            // Once database is loaded, it's the source of truth
            if (!this.chatSystem.chatHistoryLoaded &&
                !this.chatSystem.isLoadingHistory &&
                !this.chatSystem.isLoadingFromDatabase) {
                this.chatSystem.loadMessages(state.chatHistory);
            } else {
                console.log('Skipping chat history restore from state - database is source of truth');
            }
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
window.checkVersions = function () {
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
