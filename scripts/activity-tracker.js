/**
 * Activity Tracker - Tracks student writing activities
 * Tracks: typing, copy, paste, delete, and calculates original vs copied content
 */

class ActivityTracker {
    constructor(globalState, api, writeassistdevId, userId) {
        this.globalState = globalState;
        this.api = api;
        this.writeassistdevId = writeassistdevId;
        this.userId = userId;
        this.sessionId = this.generateSessionId();
        this.currentPhase = 'write';
        
        // Activity tracking data
        this.activityBuffer = [];
        this.bufferSize = 10; // Batch send every 10 activities
        this.lastTypingTime = null;
        this.typingStartTime = new Map(); // Per-phase typing start time
        this.keystrokes = new Map(); // Per-phase keystroke count
        this.lastContentLength = 0;
        this.lastWordCount = 0;
        
        // Track original vs pasted content
        this.totalTyped = 0; // Total characters typed
        this.totalPasted = 0; // Total characters pasted
        this.pasteEvents = []; // Store paste events with content
        
        // Content snapshots for comparison
        this.contentSnapshots = new Map(); // phase -> content
        
        // Track previous content lengths for better typing detection
        this.previousLengths = new Map(); // phase -> length
        this.previousTexts = new Map(); // phase -> full text (for word extraction)
        this.isPasting = false; // Flag to prevent double-counting paste events
        
        // Initialize tracking
        this.init();
    }
    
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    init() {
        console.log('ActivityTracker: Initializing activity tracking for writeassistdev ID:', this.writeassistdevId);
        
        // Track phase changes
        this.globalState.subscribe('stateChanged', (state) => {
            if (state.currentTab) {
                this.setPhase(state.currentTab);
            }
        });
        
        // Start tracking when editors are ready
        // Use a longer delay to ensure editors are initialized
        setTimeout(() => {
            console.log('ActivityTracker: Starting editor tracking setup');
            this.setupEditorTracking();
        }, 1500);
    }
    
    setPhase(phase) {
        if (phase === 'write' || phase === 'edit') {
            this.currentPhase = phase;
            // Save snapshot of current content
            this.saveContentSnapshot(phase);
        }
    }
    
    saveContentSnapshot(phase) {
        const editor = this.getEditorForPhase(phase);
        if (editor) {
            const content = editor.root.innerHTML || '';
            const text = editor.getText() || '';
            this.contentSnapshots.set(phase, {
                content: content,
                text: text,
                length: text.length,
                wordCount: this.calculateWordCount(text),
                timestamp: Date.now()
            });
        }
    }
    
    getEditorForPhase(phase) {
        if (window.aiWritingAssistant && window.aiWritingAssistant.modules) {
            if (phase === 'write' && window.aiWritingAssistant.modules.write) {
                return window.aiWritingAssistant.modules.write.editor;
            }
            if (phase === 'edit' && window.aiWritingAssistant.modules.edit) {
                return window.aiWritingAssistant.modules.edit.editor;
            }
        }
        return null;
    }
    
    setupEditorTracking() {
        // Track editors that are already available
        this.attemptEditorTracking();
        
        // Also listen for editor initialization events
        // Subscribe to state changes to catch when editors become available
        this.globalState.subscribe('stateChanged', () => {
            // Re-check for editors periodically when state changes
            setTimeout(() => {
                this.attemptEditorTracking();
            }, 500);
        });
        
        // Also retry periodically to catch late-loading editors
        let attempts = 0;
        const maxAttempts = 20; // Increased attempts
        const retryInterval = setInterval(() => {
            attempts++;
            const writeEditor = this.getEditorForPhase('write');
            const editEditor = this.getEditorForPhase('edit');
            
            // If both editors are tracked, stop retrying
            if (writeEditor && editEditor && 
                writeEditor.root.hasAttribute('data-activity-tracked') &&
                editEditor.root.hasAttribute('data-activity-tracked')) {
                clearInterval(retryInterval);
                return;
            }
            
            // Try to track any missing editors
            this.attemptEditorTracking();
            
            // Stop after max attempts
            if (attempts >= maxAttempts) {
                clearInterval(retryInterval);
                console.log('ActivityTracker: Stopped retrying editor setup after', maxAttempts, 'attempts');
            }
        }, 1000);
    }
    
    attemptEditorTracking() {
        // Track Write editor
        const writeEditor = this.getEditorForPhase('write');
        if (writeEditor && !writeEditor.root.hasAttribute('data-activity-tracked')) {
            console.log('ActivityTracker: Setting up tracking for Write editor');
            this.trackEditor(writeEditor, 'write');
            writeEditor.root.setAttribute('data-activity-tracked', 'true');
        }
        
        // Track Edit editor
        const editEditor = this.getEditorForPhase('edit');
        if (editEditor && !editEditor.root.hasAttribute('data-activity-tracked')) {
            console.log('ActivityTracker: Setting up tracking for Edit editor');
            this.trackEditor(editEditor, 'edit');
            editEditor.root.setAttribute('data-activity-tracked', 'true');
        }
    }
    
    trackEditor(editor, phase) {
        if (!editor) {
            console.warn('ActivityTracker: Cannot track editor for phase', phase, '- editor is null');
            return;
        }
        
        // Prevent duplicate tracking
        if (editor.root.hasAttribute('data-activity-tracked')) {
            console.log('ActivityTracker: Editor for phase', phase, 'already tracked, skipping');
            return;
        }
        
        console.log('ActivityTracker: Setting up event listeners for', phase, 'phase');
        
        // Track text changes (typing)
        editor.on('text-change', (delta, oldDelta, source) => {
            if (source === 'user') {
                this.handleTextChange(editor, phase, delta, oldDelta);
            }
        });
        
        // Track paste events
        editor.root.addEventListener('paste', (e) => {
            this.handlePaste(editor, phase, e);
        }, true); // Use capture phase
        
        // Track copy events
        editor.root.addEventListener('copy', (e) => {
            this.handleCopy(editor, phase, e);
        }, true); // Use capture phase
        
        // Track keyboard events for typing speed
        editor.root.addEventListener('keydown', (e) => {
            this.handleKeyDown(editor, phase, e);
        }, true); // Use capture phase
        
        // Track selection changes (for copy detection)
        editor.on('selection-change', (range, oldRange, source) => {
            if (source === 'user' && range) {
                // User selected text (might be for copying)
            }
        });
        
        // Mark as tracked
        editor.root.setAttribute('data-activity-tracked', 'true');
        editor.root.setAttribute('data-tracked-phase', phase);
        
        console.log('ActivityTracker: Successfully set up tracking for', phase, 'phase');
    }
    
    handleKeyDown(editor, phase, e) {
        // Track typing speed per phase
        const now = Date.now();
        
        // Initialize phase-specific tracking if needed
        if (!this.typingStartTime.has(phase)) {
            this.typingStartTime.set(phase, now);
        }
        
        if (!this.keystrokes.has(phase)) {
            this.keystrokes.set(phase, 0);
        }
        
        const phaseStartTime = this.typingStartTime.get(phase);
        let phaseKeystrokes = this.keystrokes.get(phase);
        
        // Count printable characters
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            phaseKeystrokes++;
            this.keystrokes.set(phase, phaseKeystrokes);
            this.totalTyped++;
        }
        
        // Calculate typing speed every 10 seconds for this phase
        if (now - phaseStartTime > 10000) {
            const minutes = (now - phaseStartTime) / 60000;
            const typingSpeed = Math.round(phaseKeystrokes / minutes);
            
            if (typingSpeed > 0) {
                this.logActivity({
                    action_type: 'typing_speed',
                    typing_speed: typingSpeed,
                    keystrokes: phaseKeystrokes
                }, phase);
            }
            
            // Reset for this phase
            this.typingStartTime.set(phase, now);
            this.keystrokes.set(phase, 0);
        }
        
        this.lastTypingTime = now;
    }
    
    handleTextChange(editor, phase, delta, oldDelta) {
        // Skip if we're currently processing a paste
        if (this.isPasting) {
            return;
        }
        
        const text = editor.getText() || '';
        const contentLength = text.length;
        const wordCount = this.calculateWordCount(text);
        
        // Get previous length for this specific phase
        const previousLength = this.previousLengths.get(phase) || 0;
        const lengthChange = contentLength - previousLength;
        
        // Extract typed content from delta
        // Quill delta format: {ops: [{insert: "text"}, {retain: 5}, {delete: 3}, ...]}
        let typedContent = '';
        
        if (delta && delta.ops) {
            // Extract all inserted text from delta operations
            delta.ops.forEach(op => {
                if (typeof op.insert === 'string') {
                    // Text was inserted - this is what was typed
                    // Filter out newlines and format characters, keep actual text
                    const insertedText = op.insert;
                    if (insertedText.trim().length > 0 || insertedText === ' ') {
                        typedContent += insertedText;
                    }
                }
            });
        }
        
        // Fallback: If delta extraction didn't work, compare text lengths
        // This is less accurate but catches cases where delta parsing fails
        if (!typedContent || typedContent.trim().length === 0) {
            const previousText = this.previousTexts ? this.previousTexts.get(phase) : '';
            if (text.length > previousText.length) {
                // Simple approach: assume new text was added at the end
                // This is approximate but better than nothing
                const addedLength = text.length - previousText.length;
                if (addedLength > 0 && addedLength <= 30) {
                    // Extract the last N characters as typed content
                    typedContent = text.substring(text.length - addedLength);
                }
            }
        }
        
        // Store current text for next comparison
        if (!this.previousTexts) {
            this.previousTexts = new Map();
        }
        this.previousTexts.set(phase, text);
        
        // Determine action type based on change
        let actionType = 'typing';
        let typedChars = 0;
        
        if (lengthChange < -5) {
            // Deletion
            actionType = 'delete';
        } else if (lengthChange > 0 && lengthChange <= 30) {
            // Small to medium change - likely typing
            actionType = 'typing';
            typedChars = lengthChange;
            this.totalTyped += typedChars;
        } else if (lengthChange > 30) {
            // Large change - might be paste or bulk insert
            // Don't count as typing, let paste handler deal with it
            actionType = 'large_insert';
        }
        
        // Extract words from typed content (limit to reasonable size for storage)
        let typedWords = '';
        if (typedContent && actionType === 'typing') {
            // Clean and extract words (limit to 500 chars to match pasted_content)
            typedWords = typedContent.trim().substring(0, 500);
        }
        
        // Log activity with correct phase and typed content
        this.logActivity({
            action_type: actionType,
            content_length: contentLength,
            word_count: wordCount,
            length_change: lengthChange,
            typed_content: typedWords || null
        }, phase);
        
        // Update phase-specific tracking
        this.previousLengths.set(phase, contentLength);
        
        // Also update global tracking (for backward compatibility)
        if (phase === this.currentPhase) {
            this.lastContentLength = contentLength;
            this.lastWordCount = wordCount;
        }
    }
    
    handlePaste(editor, phase, e) {
        // Get pasted content BEFORE preventing default
        const clipboardData = e.clipboardData || window.clipboardData;
        const pastedText = clipboardData.getData('text/plain') || '';
        const pastedLength = pastedText.length;
        
        if (pastedLength > 0) {
            // Set flag to prevent double-counting
            this.isPasting = true;
            
            // Get current content before paste
            const beforeText = editor.getText() || '';
            const beforeLength = beforeText.length;
            
            // Let the paste happen (don't prevent default for Quill)
            // Quill handles paste internally
            
            // Track paste after a short delay
            setTimeout(() => {
                const afterText = editor.getText() || '';
                const afterLength = afterText.length;
                const actualPasted = Math.max(0, afterLength - beforeLength);
                
                if (actualPasted > 0) {
                    // Store paste event
                    this.pasteEvents.push({
                        phase: phase,
                        content: pastedText.substring(0, 500), // Store first 500 chars
                        length: actualPasted,
                        timestamp: Date.now()
                    });
                    
                    this.totalPasted += actualPasted;
                    
                    // Log paste activity
                    this.logActivity({
                        action_type: 'paste',
                        pasted_content: pastedText.substring(0, 500), // Limit stored content
                        pasted_length: actualPasted,
                        content_length: afterLength,
                        word_count: this.calculateWordCount(afterText)
                    }, phase);
                }
                
                this.isPasting = false;
                this.previousLengths.set(phase, afterLength);
            }, 200);
        }
    }
    
    handleCopy(editor, phase, e) {
        const selection = editor.getSelection();
        if (selection && selection.length > 0) {
            const selectedText = editor.getText().substring(selection.index, selection.index + selection.length);
            
            this.logActivity({
                action_type: 'copy',
                copied_length: selectedText.length,
                copied_content: selectedText.substring(0, 100) // Store first 100 chars
            }, phase);
        }
    }
    
    calculateWordCount(text) {
        if (!text || !text.trim()) return 0;
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }
    
    // Helper method to extract text from Quill delta
    getTextFromDelta(delta) {
        if (!delta || !delta.ops) return '';
        let text = '';
        delta.ops.forEach(op => {
            if (typeof op.insert === 'string') {
                text += op.insert;
            }
        });
        return text;
    }
    
    logActivity(data, phase) {
        const activity = {
            writeassistdevid: this.writeassistdevId,
            userid: this.userId,
            phase: phase || this.currentPhase,
            action_type: data.action_type,
            content_length: data.content_length || 0,
            word_count: data.word_count || 0,
            pasted_content: data.pasted_content || null,
            pasted_length: data.pasted_length || 0,
            typed_content: data.typed_content || null,
            typing_speed: data.typing_speed || 0,
            session_id: this.sessionId,
            timestamp: Math.floor(Date.now() / 1000),
            created_at: Math.floor(Date.now() / 1000)
        };
        
        this.activityBuffer.push(activity);
        
        // Send batch if buffer is full
        if (this.activityBuffer.length >= this.bufferSize) {
            this.flushBuffer();
        }
    }
    
    async flushBuffer() {
        if (this.activityBuffer.length === 0) return;
        
        const activities = [...this.activityBuffer];
        this.activityBuffer = [];
        
        try {
            await this.api.logActivity(activities);
        } catch (error) {
            console.error('ActivityTracker: Failed to log activities:', error);
            // Re-add to buffer on failure (with limit to prevent memory issues)
            if (this.activityBuffer.length < 100) {
                this.activityBuffer.unshift(...activities);
            }
        }
    }
    
    // Track content import (like importing from Write tab)
    trackImport(phase, importedLength) {
        this.logActivity({
            action_type: 'import',
            content_length: 0,
            word_count: 0,
            pasted_length: importedLength,
            pasted_content: 'Imported from ' + (phase === 'edit' ? 'Write tab' : 'other source')
        }, phase);
        
        this.totalPasted += importedLength;
    }
    
    // Get statistics for current session (combined across all phases)
    getStatistics(phase = null) {
        // If phase is specified, return stats for that phase only
        if (phase) {
            const snapshot = this.contentSnapshots.get(phase);
            if (!snapshot) return null;
            
            return {
                totalTyped: this.totalTyped, // Global total (combined)
                totalPasted: this.totalPasted, // Global total (combined)
                originalPercentage: this.totalTyped > 0 
                    ? Math.round((this.totalTyped / (this.totalTyped + this.totalPasted)) * 100)
                    : 0,
                pastedPercentage: this.totalPasted > 0
                    ? Math.round((this.totalPasted / (this.totalTyped + this.totalPasted)) * 100)
                    : 0,
                currentLength: snapshot.length,
                currentWordCount: snapshot.wordCount,
                pasteCount: this.pasteEvents.filter(e => e.phase === phase).length
            };
        }
        
        // Return combined statistics for all phases
        return {
            totalTyped: this.totalTyped,
            totalPasted: this.totalPasted,
            originalPercentage: this.totalTyped > 0 
                ? Math.round((this.totalTyped / (this.totalTyped + this.totalPasted)) * 100)
                : 0,
            pastedPercentage: this.totalPasted > 0
                ? Math.round((this.totalPasted / (this.totalTyped + this.totalPasted)) * 100)
                : 0,
            writePasteCount: this.pasteEvents.filter(e => e.phase === 'write').length,
            editPasteCount: this.pasteEvents.filter(e => e.phase === 'edit').length,
            totalPasteCount: this.pasteEvents.length
        };
    }
    
    // Get tracking status for debugging
    getTrackingStatus() {
        const writeEditor = this.getEditorForPhase('write');
        const editEditor = this.getEditorForPhase('edit');
        
        return {
            writePhaseTracked: writeEditor ? writeEditor.root.hasAttribute('data-activity-tracked') : false,
            editPhaseTracked: editEditor ? editEditor.root.hasAttribute('data-activity-tracked') : false,
            writeEditorExists: !!writeEditor,
            editEditorExists: !!editEditor,
            currentPhase: this.currentPhase,
            totalTyped: this.totalTyped,
            totalPasted: this.totalPasted,
            bufferSize: this.activityBuffer.length
        };
    }
    
    // Force flush before page unload
    setupUnloadHandler() {
        window.addEventListener('beforeunload', () => {
            this.flushBuffer();
        });
        
        // Also flush periodically (every 30 seconds)
        setInterval(() => {
            this.flushBuffer();
        }, 30000);
    }
}

// Export for use in main.js
if (typeof window !== 'undefined') {
    window.ActivityTracker = ActivityTracker;
}

