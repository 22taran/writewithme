<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * AI Writing Assistant submission view page
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once('../../config.php');
require_once($CFG->dirroot . '/mod/writeassistdev/lib.php');
require_once($CFG->dirroot . '/mod/writeassistdev/classes/data/ProjectDataManager.php');

$id = required_param('id', PARAM_INT); // Course Module ID
$userid = required_param('userid', PARAM_INT); // Student User ID

if (!$cm = get_coursemodule_from_id('writeassistdev', $id, 0, false, MUST_EXIST)) {
    print_error('invalidcoursemodule');
}

$course = $DB->get_record('course', array('id' => $cm->course), '*', MUST_EXIST);
$instance = $DB->get_record('writeassistdev', ['id' => $cm->instance], '*', MUST_EXIST);
$student = $DB->get_record('user', ['id' => $userid], '*', MUST_EXIST);

require_login($course, true, $cm);

$context = context_module::instance($cm->id);
require_capability('mod/writeassistdev:addinstance', $context); // Instructor only

$PAGE->set_url(new moodle_url('/mod/writeassistdev/submission_view.php', ['id' => $cm->id, 'userid' => $userid]));
$PAGE->set_title(format_string($instance->name) . ' - ' . fullname($student));
$PAGE->set_heading(format_string($course->fullname));
$PAGE->set_context($context);
$PAGE->set_pagelayout('incourse');

// Load project data
$dataManager = new \mod_writeassistdev\data\ProjectDataManager();
$project = $dataManager->loadProject($instance->id, $userid);

// Get content from 'edit' phase (final version), fallback to 'write' phase
$content = '';
$wordCount = 0;
$contentPhase = 'edit';
if ($project && isset($project['edit']) && !empty($project['edit']['content'])) {
    $content = $project['edit']['content'];
    $wordCount = $project['edit']['wordCount'];
    $contentPhase = 'edit';
} elseif ($project && isset($project['write']) && !empty($project['write']['content'])) {
    $content = $project['write']['content'];
    $wordCount = $project['write']['wordCount'];
    $contentPhase = 'write';
}

$status = $project['metadata']['status'] ?? 'draft'; // Assuming status is in metadata now

// Get activity logs to identify pasted content
$activityLogs = $DB->get_records('writeassistdev_activity_log', [
    'writeassistdevid' => $instance->id,
    'userid' => $userid
], 'timestamp ASC');

// Calculate statistics for the view
$stats = writeassistdev_calculate_activity_stats($activityLogs);

// Analyze document for color-coding
// Color coding logic removed in favor of side-by-side view

echo $OUTPUT->header();
?>

<div class="container-fluid p-4" style="background: #f8f9fa; min-height: calc(100vh - 200px);">
    <div class="row mb-4">
        <div class="col-md-8">
            <div class="d-flex align-items-center">
                <?php echo $OUTPUT->user_picture($student, ['size' => 50, 'courseid' => $course->id, 'class' => 'mr-3']); ?>
                <div>
                    <h2 class="h4 mb-0"><?php echo fullname($student); ?></h2>
                    <div class="text-muted"><?php echo s($student->email); ?></div>
                </div>
            </div>
        </div>
        <div class="col-md-4 text-right">
            <a href="<?php echo new moodle_url('/mod/writeassistdev/submissions.php', ['id' => $cm->id]); ?>" class="btn btn-secondary mr-2">Back to List</a>
            <button onclick="window.print()" class="btn btn-primary">Print / PDF</button>
        </div>
    </div>

    <div class="row">
        <!-- LEFT COLUMN: Document Content -->
        <div class="col-md-8">
            <div class="card shadow-sm">
                <div class="card-header bg-white d-flex justify-content-between align-items-center">
                    <h3 class="h5 mb-0">Document Content</h3>
                    <div class="text-muted small">
                        <?php echo $wordCount; ?> words
                    </div>
                </div>
                <div class="card-body document-viewer" id="documentContent" style="min-height: 600px; font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; overflow-y: auto; max-height: 800px;">
                    <?php if (empty($content)): ?>
                        <div class="text-center text-muted py-5">
                            <p>No content found for this submission.</p>
                        </div>
                    <?php else: ?>
                        <?php echo $content; ?>
                    <?php endif; ?>
                </div>
            </div>
        </div>
        
        <!-- RIGHT COLUMN: Activity & Paste Analysis -->
        <div class="col-md-4">
            <!-- Stats Card -->
            <div class="card mb-3">
                <div class="card-header bg-white font-weight-bold">Activity Summary</div>
                <div class="card-body">
                    <div class="row text-center mb-3">
                        <div class="col-4">
                            <div class="h4 mb-0 <?php echo ($stats['original_percentage'] >= 70 ? 'text-success' : 'text-warning'); ?>">
                                <?php echo $stats['original_percentage']; ?>%
                            </div>
                            <div class="small text-muted">Original</div>
                        </div>
                        <div class="col-4">
                            <div class="h4 mb-0"><?php echo $stats['paste_count']; ?></div>
                            <div class="small text-muted">Pastes</div>
                        </div>
                        <div class="col-4">
                            <div class="h4 mb-0"><?php echo $stats['avg_typing_speed']; ?></div>
                            <div class="small text-muted">CPM</div>
                        </div>
                    </div>
                    
                    <hr>
                    
                    <!-- Detailed Stats -->
                    <div class="mb-2">
                        <small class="text-muted">Total Characters Typed:</small>
                        <div class="font-weight-bold"><?php echo number_format($stats['total_typed']); ?></div>
                    </div>
                    <div class="mb-2">
                        <small class="text-muted">Total Characters Pasted:</small>
                        <div class="font-weight-bold"><?php echo number_format($stats['total_pasted']); ?></div>
                    </div>
                    <div class="mb-2">
                        <small class="text-muted">Total Actions:</small>
                        <div class="font-weight-bold"><?php echo count($activityLogs); ?></div>
                    </div>
                    
                    <hr>
                    
                    <!-- Activity Timeline -->
                    <h6 class="font-weight-bold mb-2">Recent Activity</h6>
                    <div style="max-height: 200px; overflow-y: auto;">
                        <?php 
                        $recentActivities = array_slice(array_reverse($activityLogs), 0, 10);
                        foreach ($recentActivities as $activity): 
                            $actionIcon = '';
                            $actionColor = '';
                            switch($activity->action_type) {
                                case 'typing':
                                    $actionIcon = 'fa-keyboard';
                                    $actionColor = 'text-primary';
                                    break;
                                case 'paste':
                                case 'large_insert':
                                case 'import':
                                    $actionIcon = 'fa-paste';
                                    $actionColor = 'text-warning';
                                    break;
                                case 'delete':
                                    $actionIcon = 'fa-eraser';
                                    $actionColor = 'text-danger';
                                    break;
                                default:
                                    $actionIcon = 'fa-edit';
                                    $actionColor = 'text-secondary';
                            }
                        ?>
                        <div class="d-flex align-items-center mb-2 pb-2 border-bottom">
                            <i class="fa <?php echo $actionIcon; ?> <?php echo $actionColor; ?> mr-2"></i>
                            <div class="flex-grow-1">
                                <div class="small">
                                    <strong><?php echo ucfirst($activity->action_type); ?></strong>
                                    <?php if ($activity->action_type === 'paste' && $activity->pasted_length > 0): ?>
                                        <span class="text-muted">(<?php echo $activity->pasted_length; ?> chars)</span>
                                    <?php endif; ?>
                                </div>
                                <div class="text-muted" style="font-size: 0.75rem;">
                                    <?php echo userdate($activity->timestamp, '%H:%M:%S'); ?>
                                </div>
                            </div>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>
            
            <!-- Paste Events List -->
            <div class="card">
                <div class="card-header bg-white font-weight-bold d-flex justify-content-between align-items-center">
                    <span>Detected Pastes</span>
                    <span class="badge badge-secondary"><?php echo count($stats['paste_details']); ?></span>
                </div>
                <div class="card-body p-0" style="max-height: 600px; overflow-y: auto;">
                    <?php if (empty($stats['paste_details'])): ?>
                        <div class="p-3 text-center text-muted">No paste events detected.</div>
                    <?php else: ?>
                        <div class="list-group list-group-flush">
                            <?php foreach ($stats['paste_details'] as $index => $paste): ?>
                                <div class="list-group-item">
                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                        <small class="text-muted"><?php echo userdate($paste['timestamp'], '%H:%M:%S'); ?></small>
                                        <span class="badge badge-light"><?php echo $paste['length']; ?> chars</span>
                                    </div>
                                    <div class="p-2 bg-light border rounded small paste-content-clickable" 
                                         style="font-family: monospace; max-height: 100px; overflow-y: auto; cursor: pointer; transition: background-color 0.2s;"
                                         onclick="highlightText(<?php echo htmlspecialchars(json_encode($paste['content'])); ?>)"
                                         onmouseover="this.style.backgroundColor='#e9ecef'"
                                         onmouseout="this.style.backgroundColor='#f8f9fa'"
                                         title="Click to find in document">
                                        <?php echo htmlspecialchars(mb_substr($paste['content'], 0, 200)) . (mb_strlen($paste['content']) > 200 ? '...' : ''); ?>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
.document-viewer p {
    margin-bottom: 1em;
}

@media print {
    body {
        background: white !important;
    }
    .container-fluid {
        padding: 0 !important;
        min-height: auto !important;
    }
    .btn, .no-print {
        display: none !important;
    }
    .card {
        border: none !important;
        box-shadow: none !important;
    }
    .card-header {
        background: white !important;
        border-bottom: 2px solid #333 !important;
    }
    .col-md-3, .col-md-9 { /* These print styles are now somewhat obsolete due to layout change, but kept as they were not explicitly removed */
        flex: 0 0 100%;
        max-width: 100%;
    }
    .col-md-3 {
        margin-bottom: 20px;
        border-bottom: 1px solid #eee;
    }
    /* Force background colors for highlights */
    .highlight-original {
        background-color: #d4edda !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .highlight-pasted {
        background-color: #fff3cd !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
}
</style>
<script>
// Pass paste events to JavaScript
var pasteEvents = <?php echo json_encode($stats['paste_details']); ?>;

function highlightText(text) {
    if (!text) return;
    
    // Simple find functionality
    if (window.find && window.getSelection) {
        document.designMode = "on";
        var sel = window.getSelection();
        sel.collapse(document.body, 0);
        
        while (window.find(text)) {
            // Check if the selection is within the document viewer
            var anchorNode = sel.anchorNode;
            var parent = anchorNode.parentElement;
            var inDocViewer = false;
            
            // Traverse up to find if we are in the document content
            while (parent) {
                if (parent.id === 'documentContent') {
                    inDocViewer = true;
                    break;
                }
                parent = parent.parentElement;
            }
            
            if (inDocViewer) {
                document.execCommand("HiliteColor", false, "#fff3cd"); // Light yellow
            }
        }
        document.designMode = "off";
        
        // Reset selection
        sel.removeAllRanges();
    } else {
        alert("Your browser does not support direct text searching. Please use Ctrl+F.");
    }
}

function autoHighlight() {
    if (!pasteEvents || pasteEvents.length === 0) return;
    
    // Enable design mode temporarily
    document.designMode = "on";
    var sel = window.getSelection();
    
    pasteEvents.forEach(function(paste) {
        if (!paste.content) return;
        
        // Reset selection to top of document for each search
        sel.collapse(document.getElementById('documentContent'), 0);
        
        try {
            // We use a specific loop to find ALL occurrences of this paste
            while (window.find(paste.content)) {
                // Verify we are inside the document content div
                var anchorNode = sel.anchorNode;
                // Handle text nodes
                if (anchorNode.nodeType === 3) {
                    anchorNode = anchorNode.parentNode;
                }
                
                var parent = anchorNode;
                var inDocViewer = false;
                
                // Check if we are inside #documentContent
                while (parent) {
                    if (parent.id === 'documentContent') {
                        inDocViewer = true;
                        break;
                    }
                    parent = parent.parentNode;
                }
                
                if (inDocViewer) {
                    document.execCommand("HiliteColor", false, "#fff3cd");
                }
            }
        } catch (e) {
            console.error("Highlight error:", e);
        }
    });
    
    document.designMode = "off";
    if (sel) sel.removeAllRanges();
}

// Run automatically on load
window.addEventListener('load', function() {
    // Small delay to ensure rendering
    setTimeout(autoHighlight, 500);
});
</script>

<?php
echo $OUTPUT->footer();
?>
