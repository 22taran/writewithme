// Utility functions and constants for the writing assistant

// Display version information when the module loads
if (window.versionInfo) {
    console.log('Utils.js module loaded');
}

// Default structure for a new project
const DEFAULT_PROJECT_SCHEMA = {
    metadata: {
        title: '',
        description: '',
        created: null,
        modified: null,
        version: '1.0'
    },
    plan: {
        templateName: '',
        templateDisplayName: '',
        ideas: [],
        outline: [],
        customSectionTitles: {},
        customSectionDescriptions: {}
    },
    write: {
        content: '',
        wordCount: 0
    },
    edit: {
        content: '',
        suggestions: []
    },
    chatHistory: [],
    ui: {
        currentTab: 'plan'
    }
};

// ---- Utility Functions ----

function createElement(tag, className, textContent = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
}

function generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function formatDate(date) {
    return new Date(date).toISOString();
}

function calculateWordCount(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function mergeObjects(target, source) {
    return { ...target, ...source };
}

// Validate that required fields are present in an object
function validateRequiredFields(obj, requiredFields) {
    const missing = requiredFields.filter(field => !obj[field]);
    if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
    return true;
}

// Remove HTML tags from text content
function sanitizeHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

// Truncate text to specified length with ellipsis
function truncateText(text, maxLength = 100) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

// Check if an element is currently visible in the viewport
function isElementInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Smoothly scroll to an element with optional offset
function scrollToElement(element, offset = 0) {
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;
    
    window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
    });
}

// Limit function execution to once per specified time period
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}


