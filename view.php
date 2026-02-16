<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * AI Writing Assistant view page
 * @package    mod_researchflow
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once('../../config.php');
require_once($CFG->dirroot . '/mod/researchflow/lib.php');
require_once($CFG->dirroot . '/mod/researchflow/version.php');



$id = required_param('id', PARAM_INT);

if (!$cm = get_coursemodule_from_id('researchflow', $id, 0, false, MUST_EXIST)) {
    print_error('invalidcoursemodule');
}

$course = $DB->get_record('course', array('id' => $cm->course), '*', MUST_EXIST);
$instance = $DB->get_record('researchflow', ['id' => $cm->instance], '*', MUST_EXIST);

// Ensure goal fields are always strings (never null) to prevent JavaScript errors
// This prevents "TypeError: null is not an object" when editing existing activities
if (!isset($instance->plan_goal) || $instance->plan_goal === null) {
    $instance->plan_goal = '';
}
if (!isset($instance->write_goal) || $instance->write_goal === null) {
    $instance->write_goal = '';
}
if (!isset($instance->edit_goal) || $instance->edit_goal === null) {
    $instance->edit_goal = '';
}

require_login($course, true, $cm);

$context = context_module::instance($cm->id);
require_capability('mod/researchflow:view', $context);

// Check if user can edit (instructor)
$canEditGoals = has_capability('mod/researchflow:addinstance', $context) || 
                has_capability('moodle/course:manageactivities', $context);

$PAGE->set_url(new moodle_url('/mod/researchflow/view.php', ['id' => $cm->id]));
$PAGE->set_title(format_string($instance->name));
$PAGE->set_heading(format_string($course->fullname));
$PAGE->set_context($context);
$PAGE->set_pagelayout('embedded'); // Use popup layout for full-page experience


// Multi-level cache busting strategy for web server, Moodle, and browser levels

// 1. Plugin version for cache busting
$pluginversion = $plugin->version;

// 2. File hash-based cache busting (simple and reliable)
$cssStylesHash = md5_file($CFG->dirroot . '/mod/researchflow/styles/styles.css');
$cssQuillHash = md5_file($CFG->dirroot . '/mod/researchflow/styles/quill-editor.css');
$jsMainHash = md5_file($CFG->dirroot . '/mod/researchflow/scripts/main.js');
$jsApiHash = md5_file($CFG->dirroot . '/mod/researchflow/scripts/api.js');
$jsDomHash = md5_file($CFG->dirroot . '/mod/researchflow/scripts/dom.js');
$jsUtilsHash = md5_file($CFG->dirroot . '/mod/researchflow/scripts/utils.js');

// 3. Simple cache busters: plugin version + file hash
$jsMainCacheBuster = $pluginversion . '_' . substr($jsMainHash, 0, 8);
$jsApiCacheBuster = $pluginversion . '_' . substr($jsApiHash, 0, 8);
$jsDomCacheBuster = $pluginversion . '_' . substr($jsDomHash, 0, 8) . '_' . time();
$jsUtilsCacheBuster = $pluginversion . '_' . substr($jsUtilsHash, 0, 8);
$cssStylesCacheBuster = $pluginversion . '_' . substr($cssStylesHash, 0, 8);
$cssQuillCacheBuster = $pluginversion . '_' . substr($cssQuillHash, 0, 8);

// 4. Set basic cache control headers
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0, private");
header("Pragma: no-cache");
header("Expires: 0");

// Load CSS files with robust cache busting
$PAGE->requires->css(new moodle_url('https://cdn.quilljs.com/1.3.7/quill.snow.css'));

// Add custom CSS with simplified cache busting
$cssStylesUrl = new moodle_url('/mod/researchflow/styles/styles.css?v=' . $cssStylesCacheBuster);
$cssQuillUrl = new moodle_url('/mod/researchflow/styles/quill-editor.css?v=' . $cssQuillCacheBuster);

// Load CSS files with simplified cache busting
$PAGE->requires->css($cssStylesUrl);
$PAGE->requires->css($cssQuillUrl);

// Load external JavaScript libraries
$PAGE->requires->js(new moodle_url('https://cdn.quilljs.com/1.3.7/quill.min.js'), true);
$PAGE->requires->js(new moodle_url('https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js'), true);
$PAGE->requires->js(new moodle_url('https://cdn.jsdelivr.net/npm/marked/marked.min.js'), true);
$PAGE->requires->js(new moodle_url('https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js'), true);

// Log the view event
$event = \mod_researchflow\event\course_module_viewed::create([
    'objectid' => $instance->id,
    'context'  => $context,
]);
$event->add_record_snapshot('course_modules', $cm);
$event->add_record_snapshot('course', $course);
$event->add_record_snapshot('researchflow', $instance);
$event->trigger();

echo $OUTPUT->header();

// Remove intro box and other Moodle elements for full-page experience
?>
<div class="app-container">
    <!-- AI Chat Section with Tabs -->
    <div class="chat-section">
        <div class="chat-header">
            <h2><?php echo get_string('ai_writing_assistant', 'mod_researchflow'); ?></h2>
            <div class="chat-controls">
                <button id="clearChatBtn" class="clear-chat-btn" title="<?php echo get_string('clear_chat', 'mod_researchflow'); ?>">
                    <?php echo get_string('clear_chat', 'mod_researchflow'); ?>
                </button>
            </div>
        </div>
        <div class="chat-content">
            <div class="chat-messages active" id="chatMessages" data-chat-id="chat-1">
                <!-- Chat messages will be inserted here -->
            </div>
            <div class="chat-input">
                <textarea id="userInput" placeholder="<?php echo get_string('ask_for_help', 'mod_researchflow'); ?>"></textarea>
                <button id="sendMessage"><?php echo get_string('send', 'mod_researchflow'); ?></button>
            </div>
        </div>
    </div>
    <!-- Resizer for chat section -->
    <div class="chat-resizer" id="chatResizer"></div>
    <!-- Activities Section -->
    <div class="activities-section">
        <div class="tabs">
            <button class="tab-btn active" data-tab="plan"><?php echo get_string('plan_organize', 'mod_researchflow'); ?></button>
            <button class="tab-btn" data-tab="write"><?php echo get_string('write', 'mod_researchflow'); ?></button>
            <button class="tab-btn" data-tab="edit"><?php echo get_string('edit_revise', 'mod_researchflow'); ?></button>
            <div class="action-buttons">
                <?php if ($canEditGoals): ?>
                    <a href="<?php echo new moodle_url('/mod/researchflow/submissions.php', ['id' => $cm->id]); ?>" class="action-btn" title="View Student Submissions" style="text-decoration: none; color: inherit; display: inline-flex; align-items: center; gap: 6px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        Submissions
                    </a>
                <?php endif; ?>
                <button class="action-btn version-history-btn" id="versionHistoryBtn" title="Version History">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12z"/>
                        <path d="M8 4v4l3 2" stroke-linecap="round"/>
                    </svg>
                </button>
                <button class="action-btn save-exit-btn" id="saveExitBtn">Save &amp; Exit</button>
            </div>
        </div>
        <!-- Goal Section - Visible on all tabs, shows different goal per tab -->
        <div class="goal-wrapper" id="goalSection">
            <div class="goal-header">
                <span class="goal-title">Assignment Goal</span>
            </div>
            <!-- Read-only display - goal comes from backend set by instructor -->
            <div id="assignmentGoal" class="goal-field goal-field-readonly"><?php 
                $initialGoal = isset($instance->plan_goal) && $instance->plan_goal !== null ? htmlspecialchars((string)$instance->plan_goal, ENT_QUOTES, 'UTF-8') : '';
                echo $initialGoal ?: '<em>No goal set for this phase.</em>';
            ?></div>
        </div>
        <!-- Plan & Organize Tab -->
        <div class="tab-content active" id="plan">
            <?php if (!empty($instance->intro)): ?>
            <div class="module-description">
                <div class="description-content">
                    <?php echo format_text($instance->intro, $instance->introformat, array('context' => $context)); ?>
                </div>
            </div>
            <?php endif; ?>
            <div class="idea-bubbles-section">
                <div class="idea-dropzone" id="brainstormDropzone">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-sm);">
                        <h3 style="margin: 0;"><?php echo get_string('brainstorm', 'mod_researchflow'); ?></h3>
                        <button id="askAIButton" class="ask-ai-btn" title="You have to add atleast 4 ideas before" disabled>
                            <span>Ask AI to Generate Ideas</span>
                        </button>
                    </div>
                    <div class="bubble-actions-container">
                        <button id="addIdeaBubble"><?php echo get_string('add_idea', 'mod_researchflow'); ?></button>
                    </div>
                    <div class="idea-bubbles" id="ideaBubbles"></div>
                </div>
                <div class="outline-dropzone" id="outlineDropzone">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-sm);">
                        <h3 style="margin: 0;"><?php echo get_string('outline', 'mod_researchflow'); ?></h3>
                        <div style="display: flex; gap: var(--spacing-xs); align-items: center;">
                            <button id="askAIOutlineButton" class="ask-ai-btn" title="You have to add atleast 4 ideas in brainstorm before" disabled>
                                <span>Ask AI to Generate Outline</span>
                            </button>
                            <button id="addCustomSection" class="add-section-btn" title="Add Custom Section">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M7 3v8M3 7h8" stroke-linecap="round"/>
                                </svg>
                                <span>Add Section</span>
                            </button>
                        </div>
                    </div>
                    <div class="outline-items" id="outlineItems"></div>
                </div>
            </div>
        </div>
        <!-- Write Tab -->
        <div id="write" class="tab-content">
            <div class="write-flex-container">
                <div class="outline-sidebar" id="outlineSidebar">
                    <h3><?php echo get_string('my_outline', 'mod_researchflow'); ?></h3>
                </div>
                <div class="write-editor-container">
                    <div class="write-ai-tools">
                        <button id="transitionBtn" class="ai-tool-btn" disabled title="Select at least two sentences to get transition suggestions">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M2 8h12M8 2l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <span>Transition Helper</span>
                        </button>
                        <button id="rephraseBtn" class="ai-tool-btn" disabled title="Select a sentence or paragraph to rephrase">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M8 2L2 6v8h12V6L8 2z" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M6 8h4M6 11h2" stroke-linecap="round"/>
                            </svg>
                            <span>Rephrase</span>
                        </button>
                    </div>
                    <div id="writeToolbar"></div>
                    <div id="writeEditor"></div>
                </div>
            </div>
        </div>
        <!-- Edit & Revise Tab -->
        <div class="tab-content" id="edit">
            <div class="edit-flex-container">
                <div class="edit-editor-container">
                    <div class="edit-toolbar-wrapper">
                        <div class="edit-ai-toolbar">
                            <button id="importWriteContentBtn" class="ai-tool-btn" title="Import content from Write tab">
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <path d="M8 2v12M2 8l6-6 6 6" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <span>Import from Write</span>
                            </button>
                            <button id="aiReviewBtn" class="ai-tool-btn">
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <path d="M8 2L2 6v8h12V6L8 2z" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M6 8h4M6 11h2" stroke-linecap="round"/>
                                </svg>
                                <span>AI Review</span>
                            </button>
                            <div style="margin-left: auto; display: flex; gap: 8px;">
                                <button id="exportWorkBtn" class="export-work-btn" title="Export your work">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    <span>Export</span>
                                </button>
                                <button id="submitAssignmentBtn" class="submit-assignment-btn">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                    </svg>
                                    <span>Submit Assignment</span>
                                </button>
                            </div>
                        </div>
                        <div id="editToolbar"></div>
                    </div>
                    <div id="editEditor"></div>
                </div>
                <div class="edit-review-panel" id="editReviewPanel" style="display: none;">
                    <div class="review-panel-header">
                        <h3>AI Review Results</h3>
                        <button class="review-panel-close" id="reviewPanelClose" title="Close review panel">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 4L4 12M4 4l8 8" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                    <div class="review-stats" id="reviewStats"></div>
                    <div class="review-suggestions" id="reviewSuggestions"></div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Load minified JavaScript bundle -->
<!-- Load minified JavaScript bundle -->
<!-- <script src="<?php echo $CFG->wwwroot; ?>/mod/researchflow/scripts/researchflow.min.js?v=<?php echo $jsMainCacheBuster; ?>"></script> -->

<!-- Load individual scripts for development -->
<script src="<?php echo $CFG->wwwroot; ?>/mod/researchflow/scripts/utils.js?v=<?php echo $jsUtilsCacheBuster; ?>"></script>
<script src="<?php echo $CFG->wwwroot; ?>/mod/researchflow/scripts/api.js?v=<?php echo $jsApiCacheBuster; ?>"></script>
<script src="<?php echo $CFG->wwwroot; ?>/mod/researchflow/scripts/dom.js?v=<?php echo $jsDomCacheBuster; ?>"></script>
<script src="<?php echo $CFG->wwwroot; ?>/mod/researchflow/scripts/complete-chat.js?v=<?php echo $jsMainCacheBuster; ?>"></script>
<script src="<?php echo $CFG->wwwroot; ?>/mod/researchflow/scripts/activity-tracker.js?v=<?php echo $jsMainCacheBuster; ?>"></script>
<script src="<?php echo $CFG->wwwroot; ?>/mod/researchflow/scripts/main.js?v=<?php echo $jsMainCacheBuster; ?>"></script>

<script>
// Pass the instructor-selected template to the JavaScript modules
window.selectedTemplate = <?php echo json_encode($instance->template ?: 'argumentative'); ?>;
window.instructorDescription = <?php echo json_encode($instance->intro ?: ''); ?>;

// Pass instructor goals and permissions
// Ensure goals are always strings (never null) to prevent JavaScript errors
window.instructorGoals = {
    plan: <?php echo json_encode(isset($instance->plan_goal) && $instance->plan_goal !== null ? (string)$instance->plan_goal : ''); ?>,
    write: <?php echo json_encode(isset($instance->write_goal) && $instance->write_goal !== null ? (string)$instance->write_goal : ''); ?>,
    edit: <?php echo json_encode(isset($instance->edit_goal) && $instance->edit_goal !== null ? (string)$instance->edit_goal : ''); ?>
};
window.canEditGoals = <?php echo $canEditGoals ? 'true' : 'false'; ?>;
window.researchflowId = <?php echo $instance->id; ?>;
window.userId = <?php echo $USER->id; ?>;
window.cmid = <?php echo $cm->id; ?>;

<?php
// Get submission status
$metadata = $DB->get_record('researchflow_metadata', [
    'researchflowid' => $instance->id,
    'userid' => $USER->id
]);
$submissionStatus = $metadata ? ($metadata->status ?? 'draft') : 'draft';
?>
window.submissionStatus = <?php echo json_encode($submissionStatus); ?>;

// Load template data directly from PHP to avoid HTTP 404 issues
window.templateData = <?php 
    $templateId = $instance->template ?: 'argumentative';
    $templateFile = $CFG->dirroot . '/mod/researchflow/data/templates/' . $templateId . '.json';
    if (file_exists($templateFile)) {
        echo file_get_contents($templateFile);
    } else {
        echo '{"name": "Default Template", "sections": []}';
    }
?>;
window.cmId = <?php echo $cm->id; ?>;
window.courseId = <?php echo $course->id; ?>;
window.sesskey = <?php echo json_encode(sesskey()); ?>;
window.ajaxUrl = <?php echo json_encode($CFG->wwwroot . '/mod/researchflow/ajax.php'); ?>;
window.apiEndpoint = <?php 
    $api_endpoint = get_config('mod_researchflow', 'api_endpoint');
    echo ($api_endpoint === false || empty(trim($api_endpoint))) ? 'null' : json_encode($api_endpoint);
?>;

// Simplified version information
window.versionInfo = {
    plugin_version: '<?php echo $pluginversion; ?>',
    files: {
        main: {
            version: '<?php echo $jsMainCacheBuster; ?>',
            hash: '<?php echo substr($jsMainHash, 0, 8); ?>'
        },
        api: {
            version: '<?php echo $jsApiCacheBuster; ?>',
            hash: '<?php echo substr($jsApiHash, 0, 8); ?>'
        },
        dom: {
            version: '<?php echo $jsDomCacheBuster; ?>',
            hash: '<?php echo substr($jsDomHash, 0, 8); ?>'
        },
        utils: {
            version: '<?php echo $jsUtilsCacheBuster; ?>',
            hash: '<?php echo substr($jsUtilsHash, 0, 8); ?>'
        }
    }
};

// Cache busting configuration for all scripts
window.cacheBusters = {
    main: '<?php echo $jsMainCacheBuster; ?>',
    api: '<?php echo $jsApiCacheBuster; ?>',
    dom: '<?php echo $jsDomCacheBuster; ?>',
    utils: '<?php echo $jsUtilsCacheBuster; ?>'
};

// Display version information in console
console.log('=== AI Writing Assistant - Version Info ===');
console.log('Plugin Version:', window.versionInfo.plugin_version);
console.log('File Versions:', window.versionInfo.files);
console.log('==========================================');
</script>

<!-- Version History Modal -->
<div id="versionHistoryModal" class="version-modal" style="display: none;">
    <div class="version-modal-content">
        <div class="version-modal-header">
            <h3>Version History</h3>
            <button class="version-modal-close" id="versionModalClose">×</button>
        </div>
        <div class="version-modal-tabs">
            <button class="version-tab-btn active" data-phase="write">Write</button>
            <button class="version-tab-btn" data-phase="edit">Edit</button>
        </div>
        <div class="version-list" id="versionList">
            <div class="version-loading">Loading versions...</div>
        </div>
        <div class="version-modal-footer">
            <button class="version-preview-btn" id="versionPreviewBtn" disabled>Preview</button>
            <button class="version-restore-btn" id="versionRestoreBtn" disabled>Restore This Version</button>
        </div>
    </div>
</div>

<!-- Success Notification Modal -->
<div id="successNotificationModal" class="success-notification-modal" style="display: none;">
    <div class="success-notification-content">
        <div class="success-notification-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="22 4 12 14.01 9 11.01" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
        <h3 class="success-notification-title">Great Job!</h3>
        <p class="success-notification-message" id="successNotificationMessage">Your document looks good!</p>
        <button class="success-notification-btn" id="successNotificationClose">OK</button>
    </div>
</div>

<?php
echo $OUTPUT->footer();
?>
