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
    async loadChatHistoryOnly(sessionId = null) {
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'load_chat_history_only');
            formData.append('cmid', this.cmId);
            formData.append('sesskey', this.sesskey);
            if (sessionId) {
                formData.append('session_id', sessionId);
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
    async loadChatHistoryPage(limit = 50, beforeTimestamp = null, timeoutMs = 0, sessionId = null) {
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'load_chat_history_only');
            formData.append('cmid', this.cmId);
            formData.append('sesskey', this.sesskey);
            if (limit !== null && limit > 0) {
                formData.append('limit', String(limit));
            }
            if (beforeTimestamp !== null) {
                formData.append('before', String(beforeTimestamp));
            }
            if (sessionId) {
                formData.append('session_id', sessionId);
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

            // Backend returns messages sorted DESC (newest first)
            // For initial load (beforeTimestamp is null), we want the NEWEST messages
            // For pagination (beforeTimestamp is set), we want OLDER messages before that timestamp
            let filtered = list;

            if (beforeTimestamp !== null) {
                // Pagination: Get messages older than beforeTimestamp
                // Backend returns DESC, so we filter and take first N (oldest of the filtered set)
                const beforeTime = typeof beforeTimestamp === 'string'
                    ? Date.parse(beforeTimestamp)
                    : (beforeTimestamp < 10000000000 ? beforeTimestamp * 1000 : beforeTimestamp);
                filtered = filtered.filter(m => {
                    const msgTime = typeof m.timestamp === 'string'
                        ? Date.parse(m.timestamp)
                        : (typeof m.timestamp === 'number' ? (m.timestamp < 10000000000 ? m.timestamp * 1000 : m.timestamp) : 0);
                    return msgTime < beforeTime;
                });
                // For older messages, take first N (they're already sorted DESC, so first N are the newest of the older set)
                if (filtered.length > limit) {
                    filtered = filtered.slice(0, limit);
                }
            } else {
                // Initial load: Backend returns DESC (newest first), so take FIRST N for newest messages
                if (filtered.length > limit) {
                    filtered = filtered.slice(0, limit); // First N = newest N
                }
            }

            return filtered;
        } catch (e) {
            console.error('Failed to load chat history page:', e);
            return [];
        }
    }

    // Append a single chat message to the database (no overwrite, duplicate-safe backend)
    async appendChatMessage(sessionId, role, content, timestamp = new Date().toISOString()) {
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

            // Log the data being sent (for debugging)
            const projectDataString = JSON.stringify(projectData);
            console.log('ProjectAPI.saveProject(): Sending data, size:', projectDataString.length, 'bytes');
            console.log('ProjectAPI.saveProject(): plan outline count:', projectData?.plan?.outline?.length || 0);
            console.log('ProjectAPI.saveProject(): customSections count:', projectData?.plan?.customSections?.length || 0);

            // Simple form data with just the JSON string
            const formData = new URLSearchParams();
            formData.append('action', 'save_project');
            formData.append('cmid', this.cmId);
            formData.append('sesskey', this.sesskey);
            formData.append('project_data', projectDataString);

            console.log('ProjectAPI.saveProject(): Making fetch request to:', this.ajaxUrl);
            console.log('ProjectAPI.saveProject(): Form data size:', formData.toString().length, 'bytes');

            let response;
            try {
                response = await fetch(this.ajaxUrl, {
                    method: 'POST',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    credentials: 'same-origin',
                    body: formData,
                    mode: 'same-origin' // Explicitly set same-origin mode
                });
            } catch (networkError) {
                console.error('ProjectAPI.saveProject(): Network error:', networkError);
                console.error('ProjectAPI.saveProject(): Error name:', networkError.name);
                console.error('ProjectAPI.saveProject(): Error message:', networkError.message);
                throw new Error('Network error: ' + networkError.message);
            }

            console.log('ProjectAPI.saveProject(): Response status:', response.status, response.statusText);

            // Get response text once (can only read once)
            const responseText = await response.text();
            console.log('ProjectAPI.saveProject(): Response text length:', responseText.length);
            console.log('ProjectAPI.saveProject(): Response text (first 500 chars):', responseText.substring(0, 500));

            // Check content type to ensure we got JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.error('ProjectAPI.saveProject(): Received non-JSON response:', contentType);
                console.error('ProjectAPI.saveProject(): Response body:', responseText.substring(0, 500));
                throw new Error(`Expected JSON but got ${contentType}`);
            }

            if (!response.ok) {
                console.error('ProjectAPI.saveProject(): Response error:', responseText);
                try {
                    const errorJson = JSON.parse(responseText);
                    console.error('ProjectAPI.saveProject(): Error JSON:', errorJson);
                    throw new Error(errorJson.error || `HTTP ${response.status}: ${response.statusText}`);
                } catch (e) {
                    if (e.message && e.message.includes('Error JSON')) {
                        throw e; // Re-throw parsed error
                    }
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            }

            let result;
            try {
                result = JSON.parse(responseText);
                console.log('ProjectAPI.saveProject(): Response success:', result.success);
                console.log('ProjectAPI.saveProject(): Full result:', JSON.stringify(result, null, 2));
            } catch (parseError) {
                console.error('ProjectAPI.saveProject(): JSON parse error:', parseError);
                console.error('ProjectAPI.saveProject(): Response text that failed to parse:', responseText);
                throw new Error('Failed to parse response as JSON: ' + parseError.message);
            }

            if (!result.success) {
                console.error('Save failed:', result.error || 'Unknown error');
                console.error('Full result:', JSON.stringify(result, null, 2));
                throw new Error(result.error || 'Save failed');
            }

            return result;
        } catch (error) {
            console.error('Failed to save project:', error);
            console.error('Error stack:', error.stack);
            return false;
        }
    }

    // Delete project data from Moodle database
    async logActivity(activities) {
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'log_activity');
            formData.append('cmid', this.cmId);
            formData.append('sesskey', this.sesskey);
            formData.append('activities', JSON.stringify(activities));

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
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to log activity');
            }

            return result;
        } catch (error) {
            console.error('ProjectAPI: Error logging activity:', error);
            throw error;
        }
    }

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
            const templateUrl = `${window.location.origin}/mod/researchflow/data/templates/${templateId}.json`;
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

    // Send chat message to AI via Moodle proxy (keeps API key server-side)
    async sendChatMessage(userMessage, currentProject = null) {
        if (!this.ajaxUrl || !this.sesskey || !this.cmId) {
            console.error('Missing required API configuration');
            return {
                assistantReply: 'Configuration error. Please refresh the page and try again.',
                updatedProject: null
            };
        }

        const sanitizedProject = this.sanitizeProjectForAPI(currentProject);
        let projectDataString;
        try {
            projectDataString = JSON.stringify(sanitizedProject || {});
        } catch (serializeError) {
            console.error('Failed to serialize request data:', serializeError);
            return {
                assistantReply: 'Error: Could not prepare request data for AI service.',
                updatedProject: null
            };
        }

        try {
            const formData = new URLSearchParams();
            formData.append('action', 'proxy_chat');
            formData.append('cmid', this.cmId);
            formData.append('sesskey', this.sesskey);
            formData.append('user_input', userMessage);
            formData.append('project_data', projectDataString);

            const response = await fetch(this.ajaxUrl, {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                credentials: 'same-origin',
                body: formData
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                return {
                    assistantReply: `API Error: Received ${response.status} ${response.statusText}. Expected JSON but got ${contentType}`,
                    updatedProject: null
                };
            }

            const result = await response.json();

            if (!result.success) {
                return {
                    assistantReply: result.assistantReply || result.error || 'AI service error.',
                    updatedProject: result.project || null
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

    // Save instructor goal for a specific tab
    async saveInstructorGoal(tab, goalValue) {
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'save_instructor_goal');
            formData.append('cmid', this.cmId);
            formData.append('sesskey', this.sesskey);
            formData.append('tab', tab);
            formData.append('goal', goalValue);

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
                const errorMsg = result.error || 'Failed to save instructor goal';
                console.error('ProjectAPI.saveInstructorGoal(): Server error:', errorMsg);
                throw new Error(errorMsg);
            }

            return true;
        } catch (error) {
            console.error('ProjectAPI.saveInstructorGoal():', error);
            throw error;
        }
    }
    // Submit the project
    async submitProject() {
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'submit_project');
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
            console.error('Failed to submit project:', error);
            return false;
        }
    }
}

// End of ProjectAPI class