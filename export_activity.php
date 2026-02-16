<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Export activity tracking data as CSV
 * @package    mod_researchflow
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once('../../config.php');
require_once($CFG->dirroot . '/mod/researchflow/lib.php');

$id = required_param('id', PARAM_INT); // Course Module ID
$userid = optional_param('userid', 0, PARAM_INT); // Optional: specific user, 0 = all users
$format = optional_param('format', 'csv', PARAM_ALPHA); // csv or detailed

if (!$cm = get_coursemodule_from_id('researchflow', $id, 0, false, MUST_EXIST)) {
    print_error('invalidcoursemodule');
}

$course = $DB->get_record('course', array('id' => $cm->course), '*', MUST_EXIST);
$instance = $DB->get_record('researchflow', ['id' => $cm->instance], '*', MUST_EXIST);

require_login($course, true, $cm);

$context = context_module::instance($cm->id);
require_capability('mod/researchflow:addinstance', $context); // Instructor only

// Build query to get activity logs
$sql = "SELECT 
            al.*,
            u.firstname,
            u.lastname,
            u.email,
            u.username
        FROM {researchflow_activity_log} al
        INNER JOIN {user} u ON al.userid = u.id
        WHERE al.researchflowid = :researchflowid";

$params = ['researchflowid' => $instance->id];

// Filter by user if specified
if ($userid > 0) {
    $sql .= " AND al.userid = :userid";
    $params['userid'] = $userid;
    $user = $DB->get_record('user', ['id' => $userid], '*', MUST_EXIST);
    $filename = clean_filename($instance->name . '_' . fullname($user) . '_activity_' . date('Y-m-d'));
} else {
    $filename = clean_filename($instance->name . '_all_students_activity_' . date('Y-m-d'));
}

// Order by timestamp (oldest first)
$sql .= " ORDER BY al.timestamp ASC, al.created_at ASC";

// Get all activity logs
$activities = $DB->get_records_sql($sql, $params);

// Check if there's any data
if (empty($activities)) {
    // Redirect back with error message
    $redirecturl = new moodle_url('/mod/researchflow/submissions.php', ['id' => $cm->id]);
    if ($userid > 0) {
        $redirecturl = new moodle_url('/mod/researchflow/activity_report.php', ['id' => $cm->id, 'userid' => $userid]);
    }
    redirect($redirecturl, 'No activity data found to export.', null, \core\output\notification::NOTIFY_WARNING);
}

// Prepare CSV output
header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="' . $filename . '.csv"');
header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
header('Pragma: public');

// Open output stream
$output = fopen('php://output', 'w');

// Add UTF-8 BOM for Excel compatibility
fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

// CSV Headers
$headers = [
    'ID',
    'Activity ID',
    'User ID',
    'Student Name',
    'Username',
    'Email',
    'Phase',
    'Action Type',
    'Content Length',
    'Word Count',
    'Typed Content',
    'Pasted Content',
    'Pasted Length',
    'Typing Speed (CPM)',
    'Session ID',
    'Timestamp',
    'Timestamp (Readable)',
    'Created At',
    'Created At (Readable)'
];

fputcsv($output, $headers);

// Write data rows
foreach ($activities as $activity) {
    $row = [
        $activity->id,
        $activity->researchflowid,
        $activity->userid,
        fullname($activity),
        $activity->username,
        $activity->email,
        $activity->phase,
        $activity->action_type,
        $activity->content_length,
        $activity->word_count,
        // Clean typed content for CSV (remove newlines - fputcsv handles escaping)
        $activity->typed_content ? str_replace(["\r\n", "\r", "\n"], ' ', $activity->typed_content) : '',
        // Clean pasted content for CSV (remove newlines - fputcsv handles escaping)
        $activity->pasted_content ? str_replace(["\r\n", "\r", "\n"], ' ', $activity->pasted_content) : '',
        $activity->pasted_length,
        $activity->typing_speed,
        $activity->session_id,
        $activity->timestamp,
        userdate($activity->timestamp, '%Y-%m-%d %H:%M:%S'),
        $activity->created_at,
        userdate($activity->created_at, '%Y-%m-%d %H:%M:%S')
    ];
    
    fputcsv($output, $row);
}

fclose($output);
exit;
