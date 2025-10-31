// API interface for Moodle database and AI endpoint communication

// Display version information when the module loads
if (window.versionInfo) {
    console.log('API.js module loaded');
}


// Main API class for project data and AI operations
class ProjectAPI {
    constructor() {
        // Get configuration from global variables set by PHP
        this.ajaxUrl = window.ajaxUrl;
        this.apiEndpoint = window.apiEndpoint;
        this.sesskey = window.sesskey;
        this.cmId = window.cmId;
        
        // Log configuration status
        if (this.apiEndpoint === null || this.apiEndpoint === '' || this.apiEndpoint === 'null') {
            console.warn('⚠️ API Endpoint is not configured. AI features will not be available.');
            console.warn('Please configure the API endpoint in Site Administration → Plugins → Activity modules → AI Writing Assistant');
            this.apiEndpoint = null;
        } else {
            console.log('API Endpoint configured:', this.apiEndpoint);
        }
        
        if (!this.ajaxUrl || !this.sesskey || !this.cmId) {
            console.error('Missing required API configuration');
        }
    }


    // Load project data from Moodle database
    async loadProject() {
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'load_project');
            formData.append('cmid', this.cmId);
            formData.append('sesskey', this.sesskey);
            
            const response = await fetch(this.ajaxUrl, {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                credentials: 'same-origin',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            return result.success ? result.project : null;
        } catch (error) {
            console.error('Failed to load project:', error);
            return null;
        }
    }
    
    // OPTIMIZED: Load ONLY chat history (for fast initialization)
    async loadChatHistoryOnly() {
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'load_chat_history_only');
            formData.append('cmid', this.cmId);
            formData.append('sesskey', this.sesskey);
            
            const response = await fetch(this.ajaxUrl, {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                credentials: 'same-origin',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            return result.success ? result.chatHistory : [];
        } catch (error) {
            console.error('Failed to load chat history:', error);
            return [];
        }
    }

    // Paginated chat history: latest first, with optional before timestamp
    async loadChatHistoryPage(limit = 50, beforeTimestamp = null, timeoutMs = 0) {
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'load_chat_history_only'); // backend fallback
            formData.append('cmid', this.cmId);
            formData.append('sesskey', this.sesskey);
            formData.append('limit', String(limit));
            if (beforeTimestamp !== null) {
                formData.append('before', String(beforeTimestamp));
            }
            
            const controller = timeoutMs > 0 ? new AbortController() : null;
            let timeoutId = null;
            if (controller) {
                timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            }

            const response = await fetch(this.ajaxUrl, {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                credentials: 'same-origin',
                body: formData,
                signal: controller ? controller.signal : undefined
            });
            
            if (timeoutId) clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            const result = await response.json();
            const list = Array.isArray(result.chatHistory) ? result.chatHistory : [];
            
            // Fallback pagination client-side if backend ignores limit/before
            let filtered = list;
            if (beforeTimestamp !== null) {
                filtered = filtered.filter(m => (m.timestamp || 0) < beforeTimestamp);
            }
            if (filtered.length > limit) {
                filtered = filtered.slice(-limit); // latest N
            }
            
            return filtered;
        } catch (e) {
            console.error('Failed to load chat history page:', e);
            return [];
        }
    }

    // Append a single chat message to the database (no overwrite, duplicate-safe backend)
    async appendChatMessage(sessionId, role, content, timestamp = Math.floor(Date.now()/1000)) {
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'append_message');
            formData.append('cmid', this.cmId);
            formData.append('sesskey', this.sesskey);
            formData.append('session_id', sessionId || 'default');
            formData.append('role', role);
            formData.append('content', content);
            formData.append('timestamp', String(timestamp));

            console.log('appendChatMessage sending:', { sessionId, role, contentLength: content.length, timestamp });

            const response = await fetch(this.ajaxUrl, {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                credentials: 'same-origin',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('appendChatMessage HTTP error:', response.status, errorText);
                try {
                    const errorJson = JSON.parse(errorText);
                    console.error('appendChatMessage error details:', errorJson);
                } catch (e) {
                    // Not JSON, that's fine
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const result = await response.json();
            if (!result.success) {
                console.error('appendChatMessage returned success=false:', result);
            }
            return !!result.success;
        } catch (e) {
            console.error('Failed to append chat message:', e);
            return false;
        }
    }

    // Delete a single idea. Accepts either numeric id or fields {content, location, sectionId}
    async deleteIdea(ideaOrId) {
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'delete_idea');
            formData.append('cmid', this.cmId);
            formData.append('sesskey', this.sesskey);
            if (typeof ideaOrId === 'number' || (typeof ideaOrId === 'string' && /^\d+$/.test(ideaOrId))) {
                formData.append('idea_id', String(ideaOrId));
            } else if (ideaOrId && typeof ideaOrId === 'object') {
                const { content = '', location = 'brainstorm', sectionId = '' } = ideaOrId;
                formData.append('content', content);
                formData.append('location', location);
                if (sectionId) formData.append('sectionId', sectionId);
            } else {
                throw new Error('Invalid deleteIdea payload');
            }

            const response = await fetch(this.ajaxUrl, {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                credentials: 'same-origin',
                body: formData
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            const result = await response.json();
            return !!result.success;
        } catch (e) {
            console.error('Failed to delete idea:', e);
            return false;
        }
    }

    // Save project data to Moodle database
    async saveProject(projectData) {
        try {
            // Update the modified timestamp
            if (projectData.metadata) {
                projectData.metadata.modified = formatDate(new Date());
            }
            
            // Simple form data with just the JSON string
            const formData = new URLSearchParams();
            formData.append('action', 'save_project');
            formData.append('cmid', this.cmId);
            formData.append('sesskey', this.sesskey);
            formData.append('project_data', JSON.stringify(projectData));
            
            const response = await fetch(this.ajaxUrl, {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                credentials: 'same-origin',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                console.error('Save failed:', result.error || 'Unknown error');
                throw new Error(result.error || 'Save failed');
            }
            
            return result.success === true;
        } catch (error) {
            console.error('Failed to save project:', error);
            return false;
        }
    }

    // Delete project data from Moodle database
    async deleteProject() {
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'delete_project');
            formData.append('cmid', this.cmId);
            formData.append('sesskey', this.sesskey);
            
            const response = await fetch(this.ajaxUrl, {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                credentials: 'same-origin',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            return result.success === true;
        } catch (error) {
            console.error('Failed to delete project:', error);
            return false;
        }
    }

    // Load template JSON file from server
    async loadTemplate(templateId) {
        try {
            // Use embedded template data from PHP (more reliable than HTTP fetch)
            if (window.templateData && window.templateData.sections) {
                console.log('Using embedded template data');
                return window.templateData;
            }
            
            // Fallback: try direct file access
            const templateUrl = `${window.location.origin}/mod/writeassistdev/data/templates/${templateId}.json`;
            const response = await fetch(templateUrl, { 
                cache: 'no-store',
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                throw new Error(`Failed to load template: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Failed to load template:', error);
            // Return empty template as last resort
            return {
                name: 'Empty Template',
                sections: []
            };
        }
    }

    // Test AJAX connection
    async testConnection() {
        try {
            const response = await fetch(this.ajaxUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin',
                body: new URLSearchParams({
                    action: 'test',
                    cmid: this.cmId,
                    sesskey: this.sesskey
                })
            });
            
            const result = await response.json();
            console.log('AJAX test result:', result);
            return result.success;
        } catch (error) {
            console.error('AJAX test failed:', error);
            return false;
        }
    }

    // Send chat message to AI and get response with updated project data
    async sendChatMessage(userMessage, currentProject = null) {
        if (!this.apiEndpoint || this.apiEndpoint === null || this.apiEndpoint === '' || this.apiEndpoint === 'null') {
            console.error('API endpoint is not configured');
            return { 
                assistantReply: 'The AI Writing Assistant API endpoint has not been configured. Please contact your site administrator to configure the API endpoint in Site Administration → Plugins → Activity modules → AI Writing Assistant.',
                updatedProject: null 
            };
        }
        
        const fullUrl = `${this.apiEndpoint}/api/chat`;

        // Sanitize project data for API consumption
        const sanitizedProject = this.sanitizeProjectForAPI(currentProject);

        try {
            // Validate that we can serialize the data
            const requestBody = {
                userInput: userMessage,
                currentProject: sanitizedProject
            };
            
            let jsonString;
            try {
                jsonString = JSON.stringify(requestBody);
            } catch (serializeError) {
                console.error('Failed to serialize request data:', serializeError);
                return { 
                    assistantReply: 'Error: Could not prepare request data for AI service.',
                    updatedProject: null 
                };
            }

            const response = await fetch(fullUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: jsonString
            });

            // Check if we got HTML instead of JSON (common with 404 errors)
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                return { 
                    assistantReply: `API Error: Received ${response.status} ${response.statusText}. Expected JSON but got ${contentType}`,
                    updatedProject: null 
                };
            }

            const result = await response.json();
            
            if (!response.ok) {
                return { 
                    assistantReply: result.assistantReply || `API Error: ${response.status}`,
                    updatedProject: null 
                };
            }

            return {
                assistantReply: result.assistantReply || null,
                updatedProject: result.project || null
            };
        } catch (error) {
            console.error('Chat message failed:', error);
            return { assistantReply: null, updatedProject: null };
        }
    }

    // Sanitize project data for API consumption - convert HTML to plain text and clean up
    sanitizeProjectForAPI(project) {
        if (!project) return null;

        // Create a deep copy to avoid modifying the original
        const sanitized = JSON.parse(JSON.stringify(project));

        // Helper function to convert HTML to plain text
        const htmlToText = (html) => {
            if (!html || typeof html !== 'string') return html;
            
            // Create a temporary div to parse HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            
            // Get text content and clean up whitespace
            return tempDiv.textContent || tempDiv.innerText || '';
        };

        // Sanitize write content (HTML from editor)
        if (sanitized.write && sanitized.write.content) {
            sanitized.write.content = htmlToText(sanitized.write.content);
        }

        // Sanitize edit content (HTML from editor)
        if (sanitized.edit && sanitized.edit.content) {
            sanitized.edit.content = htmlToText(sanitized.edit.content);
        }

        // Sanitize idea bubbles content (might contain HTML)
        if (sanitized.plan && sanitized.plan.ideas) {
            // Handle both array and object formats
            let ideasArray;
            if (Array.isArray(sanitized.plan.ideas)) {
                ideasArray = sanitized.plan.ideas;
            } else if (typeof sanitized.plan.ideas === 'object' && sanitized.plan.ideas !== null) {
                ideasArray = Object.values(sanitized.plan.ideas);
            } else {
                ideasArray = [];
            }
            
            sanitized.plan.ideas = ideasArray.map(idea => ({
                ...idea,
                content: htmlToText(idea.content)
            }));
        }

        // Sanitize outline sections content
        if (sanitized.plan && sanitized.plan.outline) {
            sanitized.plan.outline = sanitized.plan.outline.map(section => ({
                ...section,
                title: htmlToText(section.title),
                description: htmlToText(section.description),
                bubbles: section.bubbles ? section.bubbles.map(bubble => ({
                    ...bubble,
                    content: htmlToText(bubble.content)
                })) : []
            }));
        }

        // Remove any functions or non-serializable objects
        const cleanObject = (obj) => {
            if (obj === null || typeof obj !== 'object') return obj;
            if (Array.isArray(obj)) return obj.map(cleanObject);
            
            const cleaned = {};
            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'function') continue;
                if (value instanceof HTMLElement) continue;
                cleaned[key] = cleanObject(value);
            }
            return cleaned;
        };

        return cleanObject(sanitized);
    }

    // Merge updated project data from AI response with current state
    mergeUpdatedProject(currentProject, updatedProject) {
        if (!updatedProject) return currentProject;
        
        // Create a deep copy of current project
        const merged = JSON.parse(JSON.stringify(currentProject));
        
        // Merge each section of the project
        Object.keys(updatedProject).forEach(key => {
            if (key === 'chatHistory') {
                // For chat history, we want to preserve the existing messages
                // and only add new ones if they don't already exist
                if (Array.isArray(updatedProject[key])) {
                    const existingMessages = merged[key] || [];
                    const newMessages = updatedProject[key];
                    
                    // Only add messages that don't already exist
                    newMessages.forEach(newMsg => {
                        const exists = existingMessages.some(existingMsg => 
                            existingMsg.role === newMsg.role && 
                            existingMsg.content === newMsg.content &&
                            existingMsg.timestamp === newMsg.timestamp
                        );
                        if (!exists) {
                            existingMessages.push(newMsg);
                        }
                    });
                    merged[key] = existingMessages;
                }
            } else if (typeof updatedProject[key] === 'object' && updatedProject[key] !== null) {
                // For other objects, merge them deeply
                merged[key] = this.deepMerge(merged[key] || {}, updatedProject[key]);
            } else {
                // For primitive values, use the updated value
                merged[key] = updatedProject[key];
            }
        });
        
        return merged;
    }

    // Deep merge two objects
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }

    // Get version history for a phase
    async getVersionHistory(phase) {
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'get_version_history');
            formData.append('cmid', this.cmId);
            formData.append('sesskey', this.sesskey);
            formData.append('phase', phase);

            const response = await fetch(this.ajaxUrl, {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                credentials: 'same-origin',
                body: formData
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            const result = await response.json();
            return result.success ? result.versions : [];
        } catch (e) {
            console.error('Failed to get version history:', e);
            return [];
        }
    }

    // Get a specific version
    async getVersion(phase, versionNumber) {
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'get_version');
            formData.append('cmid', this.cmId);
            formData.append('sesskey', this.sesskey);
            formData.append('phase', phase);
            formData.append('version_number', String(versionNumber));

            const response = await fetch(this.ajaxUrl, {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                credentials: 'same-origin',
                body: formData
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            const result = await response.json();
            return result.success ? result.version : null;
        } catch (e) {
            console.error('Failed to get version:', e);
            return null;
        }
    }

    // Restore a version
    async restoreVersion(phase, versionNumber) {
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'restore_version');
            formData.append('cmid', this.cmId);
            formData.append('sesskey', this.sesskey);
            formData.append('phase', phase);
            formData.append('version_number', String(versionNumber));

            const response = await fetch(this.ajaxUrl, {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                credentials: 'same-origin',
                body: formData
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            const result = await response.json();
            return result.success === true;
        } catch (e) {
            console.error('Failed to restore version:', e);
            return false;
        }
    }

    // Check if AI endpoint is running and accessible
    async checkAIHealth() {
        if (!this.apiEndpoint || this.apiEndpoint === null || this.apiEndpoint === '' || this.apiEndpoint === 'null') {
            return { 
                available: false, 
                message: 'AI endpoint not configured. Please contact your site administrator.' 
            };
        }

        const cleanEndpoint = this.apiEndpoint;

        try {
            const response = await fetch(`${cleanEndpoint}/health`, {
                method: 'GET',
                timeout: 5000
            });
            
            return { 
                available: response.ok, 
                message: response.ok ? 'AI endpoint is available' : 'AI endpoint not responding'
            };
        } catch (error) {
            return { 
                available: false, 
                message: `AI endpoint error: ${error.message}` 
            };
        }
    }
}

// End of ProjectAPI class