<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Activity Report - Shows student writing activity analytics
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once('../../config.php');
require_once($CFG->dirroot . '/mod/writeassistdev/lib.php');

$id = required_param('id', PARAM_INT);
$userid = optional_param('userid', 0, PARAM_INT);

if (!$cm = get_coursemodule_from_id('writeassistdev', $id, 0, false, MUST_EXIST)) {
    print_error('invalidcoursemodule');
}

$course = $DB->get_record('course', array('id' => $cm->course), '*', MUST_EXIST);
$instance = $DB->get_record('writeassistdev', ['id' => $cm->instance], '*', MUST_EXIST);

require_login($course, true, $cm);

$context = context_module::instance($cm->id);
require_capability('mod/writeassistdev:addinstance', $context); // Instructor only

$PAGE->set_url(new moodle_url('/mod/writeassistdev/activity_report.php', ['id' => $cm->id, 'userid' => $userid]));
$PAGE->set_title(format_string($instance->name) . ' - Activity Report');
$PAGE->set_heading(format_string($course->fullname));
$PAGE->set_context($context);
$PAGE->set_pagelayout('incourse');

// Load CSS
$PAGE->requires->css(new moodle_url('/mod/writeassistdev/styles/activity-report.css'));

echo $OUTPUT->header();

// Get all enrolled students if no specific user
$students = get_enrolled_users($context, 'mod/writeassistdev:submit');

if ($userid > 0 && isset($students[$userid])) {
    // Show report for specific student
    $student = $students[$userid];
    displayStudentReport($student, $instance->id, $cm);
} else {
    // Show list of all students with activity summary
    displayStudentList($students, $instance->id, $cm);
}

echo $OUTPUT->footer();

/**
 * Display activity report for a specific student
 */
function displayStudentReport($student, $writeassistdevid, $cm) {
    global $DB, $OUTPUT, $PAGE;
    
    echo '<div class="activity-report-container">';
    echo '<div class="report-header">';
    echo '<h2>Writing Activity Report</h2>';
    echo '<div class="student-info">';
    echo $OUTPUT->user_picture($student, ['size' => 50, 'courseid' => $PAGE->course->id]);
    echo '<div>';
    echo '<h3>' . fullname($student) . '</h3>';
    echo '<p>' . s($student->email) . '</p>';
    echo '</div>';
    echo '</div>';
    echo '<div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;">';
    echo '<a href="' . new moodle_url('/mod/writeassistdev/export_activity.php', ['id' => $cm->id, 'userid' => $student->id]) . '" class="btn btn-success" title="Export this student\'s raw activity data as CSV">📊 Export Raw Data (CSV)</a>';
    echo '<a href="' . new moodle_url('/mod/writeassistdev/activity_report.php', ['id' => $cm->id]) . '" class="btn btn-secondary">Back to All Students</a>';
    echo '</div>';
    echo '</div>';
    
    // Get activity logs for this student
    $logs = $DB->get_records('writeassistdev_activity_log', [
        'writeassistdevid' => $writeassistdevid,
        'userid' => $student->id
    ], 'timestamp DESC', '*', 0, 1000); // Limit to 1000 most recent
    
    if (empty($logs)) {
        echo '<div class="alert alert-info">No activity recorded for this student yet.</div>';
        return;
    }
    
    // Calculate statistics
    $stats = writeassistdev_calculate_activity_stats($logs);
    
    // Display statistics
    echo '<div class="activity-stats">';
    echo '<div class="stat-card">';
    echo '<div class="stat-value">' . $stats['total_actions'] . '</div>';
    echo '<div class="stat-label">Total Actions</div>';
    echo '</div>';
    
    echo '<div class="stat-card">';
    echo '<div class="stat-value">' . $stats['total_typed'] . '</div>';
    echo '<div class="stat-label">Characters Typed</div>';
    echo '</div>';
    
    echo '<div class="stat-card">';
    echo '<div class="stat-value">' . $stats['total_pasted'] . '</div>';
    echo '<div class="stat-label">Characters Pasted</div>';
    echo '</div>';
    
    echo '<div class="stat-card">';
    echo '<div class="stat-value">' . $stats['original_percentage'] . '%</div>';
    echo '<div class="stat-label">Original Content</div>';
    echo '</div>';
    
    echo '<div class="stat-card">';
    echo '<div class="stat-value">' . $stats['paste_count'] . '</div>';
    echo '<div class="stat-label">Paste Events</div>';
    echo '</div>';
    
    echo '<div class="stat-card">';
    echo '<div class="stat-value">' . $stats['avg_typing_speed'] . '</div>';
    echo '<div class="stat-label">Avg Typing Speed (CPM)</div>';
    echo '</div>';
    echo '</div>';
    
    // Display paste events
    if (!empty($stats['paste_details'])) {
        echo '<div class="paste-events-section">';
        echo '<h3>Paste Events</h3>';
        echo '<table class="activity-table">';
        echo '<thead><tr><th>Time</th><th>Phase</th><th>Length</th><th>Content Preview</th></tr></thead>';
        echo '<tbody>';
        foreach ($stats['paste_details'] as $paste) {
            echo '<tr>';
            echo '<td>' . userdate($paste['timestamp']) . '</td>';
            echo '<td>' . ucfirst($paste['phase']) . '</td>';
            echo '<td>' . $paste['length'] . ' chars</td>';
            echo '<td class="paste-preview">' . s(substr($paste['content'], 0, 100)) . (strlen($paste['content']) > 100 ? '...' : '') . '</td>';
            echo '</tr>';
        }
        echo '</tbody>';
        echo '</table>';
        echo '</div>';
    }
    
    // Display activity timeline
    echo '<div class="activity-timeline-section">';
    echo '<h3>Activity Timeline</h3>';
    echo '<div class="timeline">';
    
    $groupedLogs = [];
    foreach ($logs as $log) {
        $date = date('Y-m-d', $log->timestamp);
        if (!isset($groupedLogs[$date])) {
            $groupedLogs[$date] = [];
        }
        $groupedLogs[$date][] = $log;
    }
    
    foreach ($groupedLogs as $date => $dayLogs) {
        echo '<div class="timeline-day">';
        echo '<div class="timeline-date">' . userdate(strtotime($date . ' 00:00:00'), '%B %d, %Y') . '</div>';
        
        $actionCounts = [];
        foreach ($dayLogs as $log) {
            $actionCounts[$log->action_type] = ($actionCounts[$log->action_type] ?? 0) + 1;
        }
        
        echo '<div class="timeline-actions">';
        foreach ($actionCounts as $action => $count) {
            echo '<span class="action-badge ' . $action . '">' . ucfirst($action) . ': ' . $count . '</span>';
        }
        echo '</div>';
        echo '</div>';
    }
    
    echo '</div>';
    echo '</div>';
    
    echo '</div>';
}

/**
 * Display list of all students with activity summary
 */
function displayStudentList($students, $writeassistdevid, $cm) {
    global $DB, $OUTPUT, $PAGE;
    
    echo '<div class="activity-report-container">';
    echo '<div class="report-header">';
    echo '<h2>Student Activity Reports</h2>';
    echo '<div style="display: flex; gap: 8px; flex-wrap: wrap;">';
    echo '<a href="' . new moodle_url('/mod/writeassistdev/export_activity.php', ['id' => $cm->id]) . '" class="btn btn-success" title="Export all students\' raw activity data as CSV">📊 Export All Activity Data (CSV)</a>';
    echo '<a href="' . new moodle_url('/mod/writeassistdev/submissions.php', ['id' => $cm->id]) . '" class="btn btn-secondary">Back to Submissions</a>';
    echo '</div>';
    echo '</div>';
    
    if (empty($students)) {
        echo '<div class="alert alert-info">No students enrolled in this activity.</div>';
        echo '</div>';
        return;
    }
    
    echo '<table class="activity-summary-table">';
    echo '<thead>';
    echo '<tr>';
    echo '<th>Student</th>';
    echo '<th>Total Actions</th>';
    echo '<th>Typed</th>';
    echo '<th>Pasted</th>';
    echo '<th>Original %</th>';
    echo '<th>Paste Events</th>';
    echo '<th>Last Activity</th>';
    echo '<th>Actions</th>';
    echo '</tr>';
    echo '</thead>';
    echo '<tbody>';
    
    foreach ($students as $student) {
        $logs = $DB->get_records('writeassistdev_activity_log', [
            'writeassistdevid' => $writeassistdevid,
            'userid' => $student->id
        ], 'timestamp DESC', '*', 0, 1000);
        
        $stats = writeassistdev_calculate_activity_stats($logs);
        
        echo '<tr>';
        echo '<td class="student-cell">';
        echo $OUTPUT->user_picture($student, ['size' => 35, 'courseid' => $PAGE->course->id]);
        echo '<span class="student-name">' . fullname($student) . '</span>';
        echo '</td>';
        echo '<td>' . $stats['total_actions'] . '</td>';
        echo '<td>' . number_format($stats['total_typed']) . '</td>';
        echo '<td>' . number_format($stats['total_pasted']) . '</td>';
        echo '<td><span class="percentage-badge ' . ($stats['original_percentage'] >= 70 ? 'good' : ($stats['original_percentage'] >= 50 ? 'medium' : 'low')) . '">' . $stats['original_percentage'] . '%</span></td>';
        echo '<td>' . $stats['paste_count'] . '</td>';
        echo '<td>' . ($stats['last_activity'] ? userdate($stats['last_activity']) : 'Never') . '</td>';
        echo '<td>';
        echo '<div style="display: flex; gap: 4px; flex-wrap: wrap;">';
        echo '<a href="' . new moodle_url('/mod/writeassistdev/activity_report.php', ['id' => $cm->id, 'userid' => $student->id]) . '" class="btn btn-sm btn-primary">View Report</a>';
        echo '<a href="' . new moodle_url('/mod/writeassistdev/export_activity.php', ['id' => $cm->id, 'userid' => $student->id]) . '" class="btn btn-sm btn-success" title="Export raw data">📊 CSV</a>';
        echo '</div>';
        echo '</td>';
        echo '</tr>';
    }
    
    echo '</tbody>';
    echo '</table>';
    echo '</div>';
}



