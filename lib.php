<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Library functions for the writeassistdev module
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Adds a new instance of the writeassistdev module.
 *
 * @param stdClass $data An object from the form in mod_form.php
 * @param mod_writeassistdev_mod_form $form The form instance (optional).
 * @return int The id of the newly inserted writeassistdev record
 */
function writeassistdev_add_instance($data, $form) {
    global $DB, $COURSE;

    // Set default course if not provided.
    if (empty($data->course)) {
        $data->course = $COURSE->id;
    }

    // Set timestamps.
    $data->timecreated = time();
    $data->timemodified = time();

    // Handle intro field if present.
    if (isset($data->intro)) {
        $data->introformat = $data->intro['format'];
        $data->intro = $data->intro['text'];
    }

    // Handle template field
    if (empty($data->template)) {
        $data->template = 'argumentative'; // Default template
    }

    // Handle goal fields (ensure they're strings and never null)
    // Convert null to empty string to prevent database and form errors
    $data->plan_goal = isset($data->plan_goal) && $data->plan_goal !== null ? (string)$data->plan_goal : '';
    $data->write_goal = isset($data->write_goal) && $data->write_goal !== null ? (string)$data->write_goal : '';
    $data->edit_goal = isset($data->edit_goal) && $data->edit_goal !== null ? (string)$data->edit_goal : '';

    // Handle date_time_selector fields - convert arrays to timestamps
    if (isset($data->startdate) && is_array($data->startdate)) {
        $data->startdate = !empty($data->startdate['enabled']) 
            ? make_timestamp($data->startdate['year'], $data->startdate['month'], 
                           $data->startdate['day'], $data->startdate['hour'], 
                           $data->startdate['minute']) : null;
    }
    if (isset($data->duedate) && is_array($data->duedate)) {
        $data->duedate = !empty($data->duedate['enabled']) 
            ? make_timestamp($data->duedate['year'], $data->duedate['month'], 
                           $data->duedate['day'], $data->duedate['hour'], 
                           $data->duedate['minute']) : null;
    }
    if (isset($data->enddate) && is_array($data->enddate)) {
        $data->enddate = !empty($data->enddate['enabled']) 
            ? make_timestamp($data->enddate['year'], $data->enddate['month'], 
                           $data->enddate['day'], $data->enddate['hour'], 
                           $data->enddate['minute']) : null;
    }

    // Handle custom_outline - validate and store JSON
    if (isset($data->custom_outline)) {
        $outline = trim($data->custom_outline);
        if (!empty($outline)) {
            // Validate JSON
            $decoded = json_decode($outline, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                // Store as pretty-printed JSON
                $data->custom_outline = json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            } else {
                // Invalid JSON, set to null
                $data->custom_outline = null;
            }
        } else {
            $data->custom_outline = null;
        }
    }

    // Insert the new writeassistdev instance.
    $data->id = $DB->insert_record('writeassistdev', $data);

    return $data->id;
}

/**
 * Updates an existing instance of the writeassistdev module.
 *
 * Given an object containing all the necessary data (defined in the form),
 * this function will update an existing instance with new data.
 *
 * @param stdClass $data An object from the form in mod_form.php
 * @param mod_writeassistdev_mod_form $form The form instance (optional).
 * @return boolean Success/Failure
 */
function writeassistdev_update_instance($data, $form) {
    global $DB;

    $data->timemodified = time();
    $data->id = $data->instance;

    // Handle intro field if present.
    if (isset($data->intro)) {
        $data->introformat = $data->intro['format'];
        $data->intro = $data->intro['text'];
    }

    // Handle template field
    if (empty($data->template)) {
        $data->template = 'argumentative'; // Default template
    }

    // Handle goal fields (ensure they're strings and never null)
    // Convert null to empty string to prevent database and form errors
    $data->plan_goal = isset($data->plan_goal) && $data->plan_goal !== null ? (string)$data->plan_goal : '';
    $data->write_goal = isset($data->write_goal) && $data->write_goal !== null ? (string)$data->write_goal : '';
    $data->edit_goal = isset($data->edit_goal) && $data->edit_goal !== null ? (string)$data->edit_goal : '';

    // Handle date_time_selector fields - convert arrays to timestamps
    if (isset($data->startdate) && is_array($data->startdate)) {
        $data->startdate = !empty($data->startdate['enabled']) 
            ? make_timestamp($data->startdate['year'], $data->startdate['month'], 
                           $data->startdate['day'], $data->startdate['hour'], 
                           $data->startdate['minute']) : null;
    }
    if (isset($data->duedate) && is_array($data->duedate)) {
        $data->duedate = !empty($data->duedate['enabled']) 
            ? make_timestamp($data->duedate['year'], $data->duedate['month'], 
                           $data->duedate['day'], $data->duedate['hour'], 
                           $data->duedate['minute']) : null;
    }
    if (isset($data->enddate) && is_array($data->enddate)) {
        $data->enddate = !empty($data->enddate['enabled']) 
            ? make_timestamp($data->enddate['year'], $data->enddate['month'], 
                           $data->enddate['day'], $data->enddate['hour'], 
                           $data->enddate['minute']) : null;
    }

    // Handle custom_outline - validate and store JSON
    if (isset($data->custom_outline)) {
        $outline = trim($data->custom_outline);
        if (!empty($outline)) {
            // Validate JSON
            $decoded = json_decode($outline, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                // Store as pretty-printed JSON
                $data->custom_outline = json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            } else {
                // Invalid JSON, set to null
                $data->custom_outline = null;
            }
        } else {
            $data->custom_outline = null;
        }
    }

    $DB->update_record('writeassistdev', $data);

    return true;
}

/**
 * Deletes an instance of the writeassistdev module from the database.
 *
 * Given an ID of an instance of this module, this function will
 * permanently delete the instance and any data that depends on it.
 *
 * @param int $id Id of the module instance
 * @return boolean Success/Failure
 */
function writeassistdev_delete_instance($id) {
    global $DB;

    if (!$writeassistdev = $DB->get_record('writeassistdev', ['id' => $id])) {
        return false;
    }

    // Delete related work records.
    if ($DB->record_exists('writeassistdev_work', ['writeassistdevid' => $id])) {
        $DB->delete_records('writeassistdev_work', ['writeassistdevid' => $id]);
    }

    // Delete files.
    try {
        $cm = get_coursemodule_from_instance('writeassistdev', $id, $writeassistdev->course, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
    } catch (Exception $e) {
        debugging("Course module record not found in writeassistdev_delete_instance; using course context. Error: " . $e->getMessage(), DEBUG_DEVELOPER);
        $context = context_course::instance($writeassistdev->course);
    }
    $fs = get_file_storage();
    $fs->delete_area_files($context->id);

    $DB->delete_records('writeassistdev', ['id' => $id]);

    return true;
}

/**
 * Returns the icon URL for the writeassistdev module.
 *
 * @return string The icon URL
 */
function writeassistdev_get_icon() {
    global $CFG;
    return $CFG->wwwroot . '/mod/writeassistdev/pix/icon.png';
}

/**
 * Returns a list of view actions for the writeassistdev module.
 *
 * @param stdClass $writeassistdev
 * @return array of strings
 */
function writeassistdev_get_view_actions() {
    return array('view');
}

/**
 * Returns a list of post actions for the writeassistdev module.
 *
 * @param stdClass $writeassistdev
 * @return array of strings
 */
function writeassistdev_get_post_actions() {
    return array('add', 'update');
}

/**
 * Extends the global navigation tree by adding writeassistdev nodes if there is a corresponding capability.
 *
 * @param navigation_node $writeassistdevnode
 * @param stdClass $course
 * @param stdClass $cm
 * @param cm_info $writeassistdev
 */
function writeassistdev_extend_navigation(navigation_node $writeassistdevnode, stdClass $course, stdClass $cm, cm_info $writeassistdev) {
    // Add navigation items here if needed.
}

/**
 * Extends the settings navigation with the writeassistdev settings.
 *
 * @param settings_navigation $settingsnav
 * @param navigation_node $writeassistdevnode
 */
function writeassistdev_extend_settings_navigation(settings_navigation $settingsnav, navigation_node $writeassistdevnode) {
    // Add settings navigation items here if needed.
}

/**
 * Returns a list of page types for the writeassistdev module.
 *
 * @param string $pagetype Current page type
 * @param stdClass $parentcontext Block's parent context
 * @param stdClass $currentcontext Current context of block
 * @return array
 */
function writeassistdev_page_type_list($pagetype, $parentcontext, $currentcontext) {
    $module_pagetype = array('mod-writeassistdev-*' => get_string('page-mod-writeassistdev-x', 'mod_writeassistdev'));
    return $module_pagetype;
}

/**
 * Checks if the module has any updates that should be applied to the course.
 *
 * @param cm_info $cm
 * @param int $from
 * @param array $filter
 * @return array
 */
function writeassistdev_check_updates_since(cm_info $cm, $from, $filter = array()) {
    $updates = array();
    return $updates;
}

/**
 * Returns the FontAwesome icon map for the writeassistdev module.
 *
 * @return array
 */
function writeassistdev_get_fontawesome_icon_map() {
    return array(
        'mod_writeassistdev:icon' => 'fa-pencil',
    );
}

/**
 * Save project data to database
 * @param int $writeassistdevid The activity instance ID
 * @param int $userid The user ID
 * @param string $projectdata JSON string of project data
 * @return bool Success status
 */
function writeassistdev_save_project($writeassistdevid, $userid, $projectdata) {
    global $DB;
    
    try {
        error_log('Old save method: Starting save for user ' . $userid . ' activity ' . $writeassistdevid);
        
        // Basic validation
        if (empty($writeassistdevid) || empty($userid) || empty($projectdata)) {
            error_log('Old save method: Validation failed - empty parameters');
            return false;
        }
        
        // Check if record exists
        $record = $DB->get_record('writeassistdev_work', 
            array('writeassistdevid' => $writeassistdevid, 'userid' => $userid));
        
        $data = array(
            'writeassistdevid' => $writeassistdevid,
            'userid' => $userid,
            'content' => $projectdata,
            'timemodified' => time()
        );
        
        if ($record) {
            // Update existing record
            $data['id'] = $record->id;
            $result = $DB->update_record('writeassistdev_work', $data);
            error_log('Old save method: Update result: ' . ($result ? 'SUCCESS' : 'FAILED'));
            return $result;
        } else {
            // Create new record
            $data['timecreated'] = time();
            $result = $DB->insert_record('writeassistdev_work', $data);
            error_log('Old save method: Insert result: ' . ($result ? 'SUCCESS (ID: ' . $result . ')' : 'FAILED'));
            return $result;
        }
    } catch (Exception $e) {
        error_log('Old save method error: ' . $e->getMessage());
        return false;
    }
}

/**
 * Load project data from database
 * @param int $writeassistdevid The activity instance ID
 * @param int $userid The user ID
 * @return string|false JSON string of project data or false if not found
 */
function writeassistdev_load_project($writeassistdevid, $userid) {
    global $DB;
    
    // Basic validation
    if (empty($writeassistdevid) || empty($userid)) {
        return false;
    }
    
    $record = $DB->get_record('writeassistdev_work', 
        array('writeassistdevid' => $writeassistdevid, 'userid' => $userid));
    
    return $record ? $record->content : false;
}

/**
 * Delete project data from database
 * @param int $writeassistdevid The activity instance ID
 * @param int $userid The user ID
 * @return bool Success status
 */
function writeassistdev_delete_project($writeassistdevid, $userid) {
    global $DB;
    
    return $DB->delete_records('writeassistdev_work', 
        array('writeassistdevid' => $writeassistdevid, 'userid' => $userid));
}

/**
 * Returns additional information for module being displayed in course.
 *
 * @param cm_info $coursemodule
 * @return cached_cm_info|null
 */
function writeassistdev_get_coursemodule_info($coursemodule) {
    global $DB;

    if ($writeassistdev = $DB->get_record('writeassistdev', array('id' => $coursemodule->instance), 'id, name, intro, introformat')) {
        $info = new cached_cm_info();
        $info->name = $writeassistdev->name;
        if ($coursemodule->showdescription) {
            $info->content = format_module_intro('writeassistdev', $writeassistdev, $coursemodule->id, false);
        }
        return $info;
    } else {
        return null;
    }
}

// ===== NEW NORMALIZED SCHEMA FUNCTIONS =====

/**
 * Load ONLY chat history (fast, for initialization)
 * @param int $writeassistdevid Activity ID
 * @param int $userid User ID
 * @return array Array of chat messages
 */
function writeassistdev_load_chat_history_only($writeassistdevid, $userid, $limit = null) {
    $dataManager = new \mod_writeassistdev\data\ProjectDataManager();
    return $dataManager->loadChatHistoryOnly($writeassistdevid, $userid, $limit);
}

/**
 * Load project data using new normalized schema
 * @param int $writeassistdevid Activity ID
 * @param int $userid User ID
 * @return array|false Project data or false if not found
 */
function writeassistdev_load_project_normalized($writeassistdevid, $userid) {
    $dataManager = new \mod_writeassistdev\data\ProjectDataManager();
    return $dataManager->loadProject($writeassistdevid, $userid);
}

/**
 * Save project data using new normalized schema
 * @param int $writeassistdevid Activity ID
 * @param int $userid User ID
 * @param array $projectdata Project data array
 * @return bool Success status
 */
function writeassistdev_save_project_normalized($writeassistdevid, $userid, $projectdata) {
    $dataManager = new \mod_writeassistdev\data\ProjectDataManager();
    return $dataManager->saveProject($writeassistdevid, $userid, $projectdata);
}

/**
 * Check if project has been migrated to normalized schema
 * @param int $writeassistdevid Activity ID
 * @param int $userid User ID
 * @return bool True if migrated, false otherwise
 */
function writeassistdev_is_migrated($writeassistdevid, $userid) {
    global $DB;
    
    $metadata = $DB->get_record('writeassistdev_metadata', [
        'writeassistdevid' => $writeassistdevid,
        'userid' => $userid
    ]);
    
    return !empty($metadata);
}

/**
 * Migrate project data from JSON blob to normalized schema
 * @param int $writeassistdevid Activity ID
 * @param int $userid User ID
 * @return array Migration result
 */
function writeassistdev_migrate_project($writeassistdevid, $userid) {
    $migrator = new \mod_writeassistdev\migration\DataMigrator();
    return $migrator->migrate($writeassistdevid, $userid);
}

/**
 * Rollback migration for a specific user and activity
 * @param int $writeassistdevid Activity ID
 * @param int $userid User ID
 * @return array Rollback result
 */
function writeassistdev_rollback_migration($writeassistdevid, $userid) {
    $migrator = new \mod_writeassistdev\migration\DataMigrator();
    return $migrator->rollback($writeassistdevid, $userid);
}

/**
 * Get migration status for all projects
 * @return array Migration status information
 */
function writeassistdev_get_migration_status() {
    global $DB;
    
    // Count records in old format
    $oldRecords = $DB->count_records('writeassistdev_work');
    
    // Count records in new format
    $newMetadata = $DB->count_records('writeassistdev_metadata');
    $newIdeas = $DB->count_records('writeassistdev_ideas');
    $newContent = $DB->count_records('writeassistdev_content');
    $newChat = $DB->count_records('writeassistdev_chat');
    
    // Check for data integrity
    $orphanedIdeas = $DB->count_records_sql("
        SELECT COUNT(*) FROM {writeassistdev_ideas} i 
        LEFT JOIN {writeassistdev} w ON i.writeassistdevid = w.id 
        WHERE w.id IS NULL
    ");
    
    $orphanedContent = $DB->count_records_sql("
        SELECT COUNT(*) FROM {writeassistdev_content} c 
        LEFT JOIN {writeassistdev} w ON c.writeassistdevid = w.id 
        WHERE w.id IS NULL
    ");
    
    $missingMetadata = $DB->count_records_sql("
        SELECT COUNT(*) FROM {writeassistdev_work} w 
        LEFT JOIN {writeassistdev_metadata} m ON w.writeassistdevid = m.writeassistdevid AND w.userid = m.userid 
        WHERE m.id IS NULL
    ");
    
    return [
        'old_records' => $oldRecords,
        'new_metadata' => $newMetadata,
        'new_ideas' => $newIdeas,
        'new_content' => $newContent,
        'new_chat' => $newChat,
        'orphaned_ideas' => $orphanedIdeas,
        'orphaned_content' => $orphanedContent,
        'missing_metadata' => $missingMetadata,
        'is_complete' => ($missingMetadata == 0 && $orphanedIdeas == 0 && $orphanedContent == 0)
    ];
}

/**
 * Load template data from file
 * @param string $templateId Template ID
 * @return array|false Template data or false if not found
 */
function writeassistdev_load_template($templateId) {
    global $CFG;
    
    $templateFile = $CFG->dirroot . '/mod/writeassistdev/data/templates/' . $templateId . '.json';
    
    if (!file_exists($templateFile)) {
        return false;
    }
    
    $templateData = json_decode(file_get_contents($templateFile), true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        return false;
    }
    
    return $templateData;
}


/**
 * Calculate activity statistics from logs
 * @param array $logs Array of activity log records
 * @return array Statistics array
 */
function writeassistdev_calculate_activity_stats($logs) {
    if (empty($logs)) {
        return [
            'total_actions' => 0,
            'total_typed' => 0,
            'total_pasted' => 0,
            'original_percentage' => 0,
            'paste_count' => 0,
            'avg_typing_speed' => 0,
            'last_activity' => null,
            'paste_details' => []
        ];
    }
    
    $totalTyped = 0;
    $totalPasted = 0;
    $pasteCount = 0;
    $typingSpeeds = [];
    $pasteDetails = [];
    $lastActivity = 0;
    
    foreach ($logs as $log) {
        if ($log->timestamp > $lastActivity) {
            $lastActivity = $log->timestamp;
        }
        
        // Estimate typed characters from typing actions
        // We track content_length changes, so we can estimate typing
        if ($log->action_type === 'typing') {
            // Conservative estimate: assume 5-15 chars per typing event
            // This is an approximation since we batch events
            $totalTyped += 10; // Average estimate per typing action
        }
        
        if ($log->action_type === 'paste' || $log->action_type === 'large_insert' || $log->action_type === 'import') {
            $pastedLen = $log->pasted_length > 0 ? $log->pasted_length : 0;
            $totalPasted += $pastedLen;
            if ($pastedLen > 0) {
                $pasteCount++;
                $pasteDetails[] = [
                    'timestamp' => $log->timestamp,
                    'phase' => $log->phase,
                    'length' => $pastedLen,
                    'content' => $log->pasted_content ?? ''
                ];
            }
        }
        
        if ($log->typing_speed > 0) {
            $typingSpeeds[] = $log->typing_speed;
        }
    }
    
    // Calculate original percentage
    $total = $totalTyped + $totalPasted;
    $originalPercentage = $total > 0 ? round(($totalTyped / $total) * 100) : 0;
    
    // Calculate average typing speed
    $avgTypingSpeed = !empty($typingSpeeds) ? round(array_sum($typingSpeeds) / count($typingSpeeds)) : 0;
    
    // Sort paste details by timestamp (newest first)
    usort($pasteDetails, function($a, $b) {
        return $b['timestamp'] - $a['timestamp'];
    });
    
    return [
        'total_actions' => count($logs),
        'total_typed' => $totalTyped,
        'total_pasted' => $totalPasted,
        'original_percentage' => $originalPercentage,
        'paste_count' => $pasteCount,
        'avg_typing_speed' => $avgTypingSpeed,
        'last_activity' => $lastActivity > 0 ? $lastActivity : null,
        'paste_details' => $pasteDetails
    ];
}
