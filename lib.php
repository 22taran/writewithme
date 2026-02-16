<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Library functions for the researchflow module
 * @package    mod_researchflow
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Adds a new instance of the researchflow module.
 *
 * @param stdClass $data An object from the form in mod_form.php
 * @param mod_researchflow_mod_form $form The form instance (optional).
 * @return int The id of the newly inserted researchflow record
 */
function researchflow_add_instance($data, $form) {
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

    // Insert the new researchflow instance.
    $data->id = $DB->insert_record('researchflow', $data);

    return $data->id;
}

/**
 * Updates an existing instance of the researchflow module.
 *
 * Given an object containing all the necessary data (defined in the form),
 * this function will update an existing instance with new data.
 *
 * @param stdClass $data An object from the form in mod_form.php
 * @param mod_researchflow_mod_form $form The form instance (optional).
 * @return boolean Success/Failure
 */
function researchflow_update_instance($data, $form) {
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

    $DB->update_record('researchflow', $data);

    return true;
}

/**
 * Deletes an instance of the researchflow module from the database.
 *
 * Given an ID of an instance of this module, this function will
 * permanently delete the instance and any data that depends on it.
 *
 * @param int $id Id of the module instance
 * @return boolean Success/Failure
 */
function researchflow_delete_instance($id) {
    global $DB;

    if (!$researchflow = $DB->get_record('researchflow', ['id' => $id])) {
        return false;
    }

    $dbman = $DB->get_manager();
    $tables = [
        'researchflow_chat',
        'researchflow_chat_sessions',
        'researchflow_activity_log',
        'researchflow_versions',
        'researchflow_content',
        'researchflow_ideas',
        'researchflow_metadata',
        'researchflow_work',
    ];

    $transaction = $DB->start_delegated_transaction();
    try {
        // Delete from normalized tables (child tables first)
        foreach ($tables as $tablename) {
            if ($dbman->table_exists($tablename)) {
                $DB->delete_records($tablename, ['researchflowid' => $id]);
            }
        }

        // Delete files.
        try {
            $cm = get_coursemodule_from_instance('researchflow', $id, $researchflow->course, false, MUST_EXIST);
            $context = context_module::instance($cm->id);
        } catch (Exception $e) {
            debugging("Course module record not found in researchflow_delete_instance; using course context. Error: " . $e->getMessage(), DEBUG_DEVELOPER);
            $context = context_course::instance($researchflow->course);
        }
        $fs = get_file_storage();
        $fs->delete_area_files($context->id);

        $DB->delete_records('researchflow', ['id' => $id]);

        $transaction->allow_commit();
        return true;
    } catch (Exception $e) {
        $transaction->rollback($e);
        throw $e;
    }
}

/**
 * Returns whether the module supports a given feature.
 *
 * @param string $feature FEATURE_xxx constant
 * @return mixed True if the feature is supported, false if not, null if unknown
 */
function researchflow_supports($feature) {
    switch ($feature) {
        case FEATURE_BACKUP_MOODLE2:
            return true;
        default:
            return null;
    }
}

/**
 * Returns the icon URL for the researchflow module.
 *
 * @return string The icon URL
 */
function researchflow_get_icon() {
    global $CFG;
    return $CFG->wwwroot . '/mod/researchflow/pix/icon.png';
}

/**
 * Returns a list of view actions for the researchflow module.
 *
 * @param stdClass $researchflow
 * @return array of strings
 */
function researchflow_get_view_actions() {
    return array('view');
}

/**
 * Returns a list of post actions for the researchflow module.
 *
 * @param stdClass $researchflow
 * @return array of strings
 */
function researchflow_get_post_actions() {
    return array('add', 'update');
}

/**
 * Extends the global navigation tree by adding researchflow nodes if there is a corresponding capability.
 *
 * @param navigation_node $researchflownode
 * @param stdClass $course
 * @param stdClass $cm
 * @param cm_info $researchflow
 */
function researchflow_extend_navigation(navigation_node $researchflownode, stdClass $course, stdClass $cm, cm_info $researchflow) {
    // Add navigation items here if needed.
}

/**
 * Extends the settings navigation with the researchflow settings.
 *
 * @param settings_navigation $settingsnav
 * @param navigation_node $researchflownode
 */
function researchflow_extend_settings_navigation(settings_navigation $settingsnav, navigation_node $researchflownode) {
    // Add settings navigation items here if needed.
}

/**
 * Returns a list of page types for the researchflow module.
 *
 * @param string $pagetype Current page type
 * @param stdClass $parentcontext Block's parent context
 * @param stdClass $currentcontext Current context of block
 * @return array
 */
function researchflow_page_type_list($pagetype, $parentcontext, $currentcontext) {
    $module_pagetype = array('mod-researchflow-*' => get_string('page-mod-researchflow-x', 'mod_researchflow'));
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
function researchflow_check_updates_since(cm_info $cm, $from, $filter = array()) {
    $updates = array();
    return $updates;
}

/**
 * Returns the FontAwesome icon map for the researchflow module.
 *
 * @return array
 */
function researchflow_get_fontawesome_icon_map() {
    return array(
        'mod_researchflow:icon' => 'fa-pencil',
    );
}

/**
 * Save project data to database
 * @param int $researchflowid The activity instance ID
 * @param int $userid The user ID
 * @param string $projectdata JSON string of project data
 * @return bool Success status
 */
function researchflow_save_project($researchflowid, $userid, $projectdata) {
    global $DB;
    
    try {
        error_log('Old save method: Starting save for user ' . $userid . ' activity ' . $researchflowid);
        
        // Basic validation
        if (empty($researchflowid) || empty($userid) || empty($projectdata)) {
            error_log('Old save method: Validation failed - empty parameters');
            return false;
        }
        
        // Check if record exists
        $record = $DB->get_record('researchflow_work', 
            array('researchflowid' => $researchflowid, 'userid' => $userid));
        
        $data = array(
            'researchflowid' => $researchflowid,
            'userid' => $userid,
            'content' => $projectdata,
            'timemodified' => time()
        );
        
        if ($record) {
            // Update existing record
            $data['id'] = $record->id;
            $result = $DB->update_record('researchflow_work', $data);
            error_log('Old save method: Update result: ' . ($result ? 'SUCCESS' : 'FAILED'));
            return $result;
        } else {
            // Create new record
            $data['timecreated'] = time();
            $result = $DB->insert_record('researchflow_work', $data);
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
 * @param int $researchflowid The activity instance ID
 * @param int $userid The user ID
 * @return string|false JSON string of project data or false if not found
 */
function researchflow_load_project($researchflowid, $userid) {
    global $DB;
    
    // Basic validation
    if (empty($researchflowid) || empty($userid)) {
        return false;
    }
    
    $record = $DB->get_record('researchflow_work', 
        array('researchflowid' => $researchflowid, 'userid' => $userid));
    
    return $record ? $record->content : false;
}

/**
 * Delete project data from database
 * @param int $researchflowid The activity instance ID
 * @param int $userid The user ID
 * @return bool Success status
 */
function researchflow_delete_project($researchflowid, $userid) {
    global $DB;
    
    return $DB->delete_records('researchflow_work', 
        array('researchflowid' => $researchflowid, 'userid' => $userid));
}

/**
 * Returns additional information for module being displayed in course.
 *
 * @param cm_info $coursemodule
 * @return cached_cm_info|null
 */
function researchflow_get_coursemodule_info($coursemodule) {
    global $DB;

    if ($researchflow = $DB->get_record('researchflow', array('id' => $coursemodule->instance), 'id, name, intro, introformat')) {
        $info = new cached_cm_info();
        $info->name = $researchflow->name;
        if ($coursemodule->showdescription) {
            $info->content = format_module_intro('researchflow', $researchflow, $coursemodule->id, false);
        }
        return $info;
    } else {
        return null;
    }
}

// ===== NEW NORMALIZED SCHEMA FUNCTIONS =====

/**
 * Load ONLY chat history (fast, for initialization)
 * @param int $researchflowid Activity ID
 * @param int $userid User ID
 * @param int|null $limit Maximum number of messages to return
 * @param string|null $sessionId Optional session ID to filter by
 * @return array Array of chat messages
 */
function researchflow_load_chat_history_only($researchflowid, $userid, $limit = null, $sessionId = null) {
    $dataManager = new \mod_researchflow\data\ProjectDataManager();
    return $dataManager->loadChatHistoryOnly($researchflowid, $userid, $limit, $sessionId);
}

/**
 * Load project data using new normalized schema
 * @param int $researchflowid Activity ID
 * @param int $userid User ID
 * @return array|false Project data or false if not found
 */
function researchflow_load_project_normalized($researchflowid, $userid) {
    $dataManager = new \mod_researchflow\data\ProjectDataManager();
    return $dataManager->loadProject($researchflowid, $userid);
}

/**
 * Save project data using new normalized schema
 * @param int $researchflowid Activity ID
 * @param int $userid User ID
 * @param array $projectdata Project data array
 * @return bool Success status
 */
function researchflow_save_project_normalized($researchflowid, $userid, $projectdata) {
    $dataManager = new \mod_researchflow\data\ProjectDataManager();
    return $dataManager->saveProject($researchflowid, $userid, $projectdata);
}

/**
 * Check if project has been migrated to normalized schema
 * @param int $researchflowid Activity ID
 * @param int $userid User ID
 * @return bool True if migrated, false otherwise
 */
function researchflow_is_migrated($researchflowid, $userid) {
    global $DB;
    
    $metadata = $DB->get_record('researchflow_metadata', [
        'researchflowid' => $researchflowid,
        'userid' => $userid
    ]);
    
    return !empty($metadata);
}

/**
 * Migrate project data from JSON blob to normalized schema
 * @param int $researchflowid Activity ID
 * @param int $userid User ID
 * @return array Migration result
 */
function researchflow_migrate_project($researchflowid, $userid) {
    $migrator = new \mod_researchflow\migration\DataMigrator();
    return $migrator->migrate($researchflowid, $userid);
}

/**
 * Rollback migration for a specific user and activity
 * @param int $researchflowid Activity ID
 * @param int $userid User ID
 * @return array Rollback result
 */
function researchflow_rollback_migration($researchflowid, $userid) {
    $migrator = new \mod_researchflow\migration\DataMigrator();
    return $migrator->rollback($researchflowid, $userid);
}

/**
 * Get migration status for all projects
 * @return array Migration status information
 */
function researchflow_get_migration_status() {
    global $DB;
    
    // Count records in old format
    $oldRecords = $DB->count_records('researchflow_work');
    
    // Count records in new format
    $newMetadata = $DB->count_records('researchflow_metadata');
    $newIdeas = $DB->count_records('researchflow_ideas');
    $newContent = $DB->count_records('researchflow_content');
    $newChat = $DB->count_records('researchflow_chat');
    
    // Check for data integrity
    $orphanedIdeas = $DB->count_records_sql("
        SELECT COUNT(*) FROM {researchflow_ideas} i 
        LEFT JOIN {researchflow} w ON i.researchflowid = w.id 
        WHERE w.id IS NULL
    ");
    
    $orphanedContent = $DB->count_records_sql("
        SELECT COUNT(*) FROM {researchflow_content} c 
        LEFT JOIN {researchflow} w ON c.researchflowid = w.id 
        WHERE w.id IS NULL
    ");
    
    $missingMetadata = $DB->count_records_sql("
        SELECT COUNT(*) FROM {researchflow_work} w 
        LEFT JOIN {researchflow_metadata} m ON w.researchflowid = m.researchflowid AND w.userid = m.userid 
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
function researchflow_load_template($templateId) {
    global $CFG;
    
    $templateFile = $CFG->dirroot . '/mod/researchflow/data/templates/' . $templateId . '.json';
    
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
function researchflow_calculate_activity_stats($logs) {
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
