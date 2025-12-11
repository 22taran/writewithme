<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * AI Writing Assistant submissions page
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once('../../config.php');
require_once($CFG->dirroot . '/mod/writeassistdev/lib.php');
require_once($CFG->dirroot . '/mod/writeassistdev/classes/data/ProjectDataManager.php');

$id = required_param('id', PARAM_INT);

if (!$cm = get_coursemodule_from_id('writeassistdev', $id, 0, false, MUST_EXIST)) {
    print_error('invalidcoursemodule');
}

$course = $DB->get_record('course', array('id' => $cm->course), '*', MUST_EXIST);
$instance = $DB->get_record('writeassistdev', ['id' => $cm->instance], '*', MUST_EXIST);

require_login($course, true, $cm);

$context = context_module::instance($cm->id);
require_capability('mod/writeassistdev:addinstance', $context); // Instructor only

$PAGE->set_url(new moodle_url('/mod/writeassistdev/submissions.php', ['id' => $cm->id]));
$PAGE->set_title(format_string($instance->name) . ' - Submissions');
$PAGE->set_heading(format_string($course->fullname));
$PAGE->set_context($context);
$PAGE->set_pagelayout('incourse');

// Load CSS
$PAGE->requires->css(new moodle_url('/mod/writeassistdev/styles/submissions.css'));

echo $OUTPUT->header();

// Get submissions
$dataManager = new \mod_writeassistdev\data\ProjectDataManager();
$submissions = $dataManager->getAllSubmissions($instance->id);

?>
<div class="submissions-container">
    <div class="submissions-header">
        <h2>Student Submissions</h2>
        <div class="header-actions">
            <a href="<?php echo new moodle_url('/mod/writeassistdev/export_activity.php', ['id' => $cm->id]); ?>" class="btn btn-success" title="Export all activity tracking data as CSV">
                📊 Export Activity Data (CSV)
            </a>
            <a href="<?php echo new moodle_url('/mod/writeassistdev/view.php', ['id' => $cm->id]); ?>" class="btn btn-secondary">Back to Activity</a>
        </div>
    </div>

    <?php if (empty($submissions)): ?>
        <div class="alert alert-info">No submissions found yet.</div>
    <?php else: ?>
        <div class="submissions-table-wrapper">
            <table class="submissions-table">
                <thead>
                    <tr>
                        <th>Student</th>
                        <th>Email</th>
                        <th>Last Modified</th>
                        <th>Write Phase (Words)</th>
                        <th>Edit Phase (Words)</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($submissions as $submission): ?>
                        <tr>
                            <td class="student-cell">
                                <?php echo $OUTPUT->user_picture($submission, ['size' => 35, 'courseid' => $course->id]); ?>
                                <span class="student-name"><?php echo fullname($submission); ?></span>
                            </td>
                            <td><?php echo s($submission->email); ?></td>
                            <td><?php echo userdate($submission->last_modified); ?></td>
                            <td><?php echo $submission->write_word_count; ?></td>
                            <td><?php echo $submission->edit_word_count; ?></td>
                            <td>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                    <a href="<?php echo new moodle_url('/mod/writeassistdev/submission_view.php', ['id' => $cm->id, 'userid' => $submission->userid]); ?>" class="btn btn-sm btn-primary">View Document</a>
                                    <a href="<?php echo new moodle_url('/mod/writeassistdev/chat_history.php', ['id' => $cm->id, 'userid' => $submission->userid]); ?>" class="btn btn-sm btn-info">Chat History</a>
                                    <a href="<?php echo new moodle_url('/mod/writeassistdev/export_activity.php', ['id' => $cm->id, 'userid' => $submission->userid]); ?>" class="btn btn-sm btn-success" title="Export this student's activity data">📊 Export Data</a>
                                </div>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php endif; ?>
</div>

<?php
echo $OUTPUT->footer();
?>
