<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * AI Writing Assistant chat history page
 * @package    mod_researchflow
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once('../../config.php');
require_once($CFG->dirroot . '/mod/researchflow/lib.php');
require_once($CFG->dirroot . '/mod/researchflow/classes/data/ProjectDataManager.php');

$id = required_param('id', PARAM_INT); // Course Module ID
$userid = required_param('userid', PARAM_INT); // Student User ID

if (!$cm = get_coursemodule_from_id('researchflow', $id, 0, false, MUST_EXIST)) {
    print_error('invalidcoursemodule');
}

$course = $DB->get_record('course', array('id' => $cm->course), '*', MUST_EXIST);
$instance = $DB->get_record('researchflow', ['id' => $cm->instance], '*', MUST_EXIST);
$student = $DB->get_record('user', ['id' => $userid], '*', MUST_EXIST);

require_login($course, true, $cm);

$context = context_module::instance($cm->id);
require_capability('mod/researchflow:addinstance', $context); // Instructor only

$PAGE->set_url(new moodle_url('/mod/researchflow/chat_history.php', ['id' => $cm->id, 'userid' => $userid]));
$PAGE->set_title(format_string($instance->name) . ' - Chat History - ' . fullname($student));
$PAGE->set_heading(format_string($course->fullname));
$PAGE->set_context($context);
$PAGE->set_pagelayout('incourse');

// Load project data to get chat history
$dataManager = new \mod_researchflow\data\ProjectDataManager();
$project = $dataManager->loadProject($instance->id, $userid);

// Extract chat history from project data
// Chat history can be in multiple locations depending on how it was saved
$chatHistory = [];
if ($project) {
    // Try different possible locations for chat history
    if (isset($project['chatHistory']) && is_array($project['chatHistory'])) {
        $chatHistory = $project['chatHistory'];
    } elseif (isset($project['chat']) && isset($project['chat']['history'])) {
        $chatHistory = $project['chat']['history'];
    }
}

// Also try to get from the database directly
if (empty($chatHistory)) {
    global $DB;
    $chatRecords = $DB->get_records('researchflow_chat', [
        'researchflowid' => $instance->id,
        'userid' => $userid
    ], 'timestamp ASC');
    
    if ($chatRecords) {
        foreach ($chatRecords as $record) {
            $chatHistory[] = [
                'role' => $record->role,
                'content' => $record->content,
                'timestamp' => $record->timestamp
            ];
        }
    }
}


echo $OUTPUT->header();
?>

<div class="container-fluid p-4" style="background: #f8f9fa; min-height: calc(100vh - 200px);">
    <div class="row mb-4">
        <div class="col-md-8">
            <div class="d-flex align-items-center">
                <?php echo $OUTPUT->user_picture($student, ['size' => 50, 'courseid' => $course->id, 'class' => 'mr-3']); ?>
                <div>
                    <h2 class="h4 mb-0"><?php echo fullname($student); ?> - Chat History</h2>
                    <div class="text-muted"><?php echo s($student->email); ?></div>
                </div>
            </div>
        </div>
        <div class="col-md-4 text-right">
            <a href="<?php echo new moodle_url('/mod/researchflow/submission_view.php', ['id' => $cm->id, 'userid' => $userid]); ?>" class="btn btn-secondary mr-2">Back to Document</a>
            <a href="<?php echo new moodle_url('/mod/researchflow/submissions.php', ['id' => $cm->id]); ?>" class="btn btn-secondary">Back to List</a>
        </div>
    </div>

    <div class="row">
        <div class="col-12">
            <div class="card shadow-sm">
                <div class="card-header bg-white">
                    <h3 class="h5 mb-0">AI Chat Conversation</h3>
                </div>
                <div class="card-body" style="max-height: 700px; overflow-y: auto;">
                    <?php if (empty($chatHistory)): ?>
                        <div class="text-center text-muted py-5">
                            <i class="fa fa-comments fa-3x mb-3"></i>
                            <p>No chat history found for this student.</p>
                        </div>
                    <?php else: ?>
                        <div class="chat-history">
                            <?php foreach ($chatHistory as $index => $message): ?>
                                <?php 
                                $isUser = ($message['role'] === 'user');
                                $alignClass = $isUser ? 'justify-content-end' : 'justify-content-start';
                                $bgClass = $isUser ? 'bg-primary text-white' : 'bg-light';
                                $timestamp = isset($message['timestamp']) ? $message['timestamp'] : null;
                                // Convert timestamp to Unix for userdate: MySQL TIMESTAMP string, Unix seconds, or milliseconds
                                $timestampUnix = null;
                                if ($timestamp !== null) {
                                    if (is_string($timestamp)) {
                                        $timestampUnix = strtotime($timestamp);
                                    } else if (is_numeric($timestamp)) {
                                        $timestampUnix = ($timestamp > 10000000000) ? (int)($timestamp / 1000) : (int)$timestamp;
                                    }
                                }
                                ?>
                                <div class="d-flex <?php echo $alignClass; ?> mb-3">
                                    <div class="message-bubble <?php echo $bgClass; ?> p-3 rounded" style="max-width: 70%;">
                                        <div class="d-flex align-items-center mb-1">
                                            <strong class="mr-2">
                                                <?php echo $isUser ? fullname($student) : 'AI Assistant'; ?>
                                            </strong>
                                            <?php if ($timestampUnix !== false && $timestampUnix > 0): ?>
                                                <small class="<?php echo $isUser ? 'text-white-50' : 'text-muted'; ?>">
                                                    <?php echo userdate($timestampUnix, '%d %b %Y, %H:%M'); ?>
                                                </small>
                                            <?php endif; ?>
                                        </div>
                                        <div class="message-content">
                                            <?php 
                                            // Convert markdown to HTML for better display
                                            $content = $message['content'];
                                            // Simple markdown conversion
                                            $content = preg_replace('/\*\*(.*?)\*\*/', '<strong>$1</strong>', $content);
                                            $content = preg_replace('/\*(.*?)\*/', '<em>$1</em>', $content);
                                            $content = nl2br(htmlspecialchars($content, ENT_NOQUOTES));
                                            echo $content;
                                            ?>
                                        </div>
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
.message-bubble {
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}
.chat-history {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
.message-content {
    line-height: 1.5;
}
</style>

<?php
echo $OUTPUT->footer();
?>
