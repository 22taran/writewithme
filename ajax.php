<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Simplified AJAX handler for researchflow module
 * Directly calls lib.php functions without unnecessary validation layers
 * @package    mod_researchflow
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Handle OPTIONS preflight request FIRST (before loading Moodle)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
    header('Access-Control-Allow-Headers: X-Requested-With, Content-Type');
    header('Access-Control-Max-Age: 86400');
    http_response_code(200);
    exit;
}

// Start output buffering to catch any unexpected output
ob_start();

try {
    require_once('../../config.php');
    require_once($CFG->dirroot . '/mod/researchflow/lib.php');
} catch (Exception $e) {
    ob_end_clean();
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    echo json_encode(['success' => false, 'error' => 'Failed to load Moodle: ' . $e->getMessage()]);
    exit;
}

// Clear any output that might have been generated
ob_end_clean();

// Set headers (after Moodle is loaded)
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: X-Requested-With, Content-Type');
header('Access-Control-Max-Age: 86400');

// Basic AJAX request check (but allow if X-Requested-With header is missing for debugging)
if (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) !== 'xmlhttprequest') {
    echo json_encode(['success' => false, 'error' => 'Direct access not allowed']);
    exit;
}

try {
    // Get parameters
    $action = required_param('action', PARAM_ALPHANUMEXT);
    $cmid = required_param('cmid', PARAM_INT);
    $sesskey = required_param('sesskey', PARAM_ALPHANUM);

    // Verify session key
    if (!confirm_sesskey($sesskey)) {
        echo json_encode(['success' => false, 'error' => 'Invalid session key']);
        exit;
    }

    // Get course module and context
    $cm = get_coursemodule_from_id('researchflow', $cmid, 0, false, MUST_EXIST);
    $course = $DB->get_record('course', array('id' => $cm->course), '*', MUST_EXIST);
    $researchflow = $DB->get_record('researchflow', array('id' => $cm->instance), '*', MUST_EXIST);

    // Set up context
    $context = context_module::instance($cm->id);
    require_login($course, true, $cm);
    require_capability('mod/researchflow:view', $context);
} catch (Exception $e) {
    error_log('ajax.php: Error during initialization: ' . $e->getMessage());
    error_log('ajax.php: Exception trace: ' . $e->getTraceAsString());
    echo json_encode(['success' => false, 'error' => 'Initialization error: ' . $e->getMessage()]);
    exit;
}

try {
    error_log('AJAX request: action=' . $action . ', cmid=' . $cmid . ', user=' . $USER->id);
    error_log('AJAX request: POST data keys: ' . implode(', ', array_keys($_POST)));
    error_log('AJAX request: POST data size: ' . (isset($_POST['project_data']) ? strlen($_POST['project_data']) : 0) . ' bytes');
    
    switch ($action) {
        case 'save_project':
            try {
                // Check if project_data exists
                if (!isset($_POST['project_data'])) {
                    error_log('ajax.php: save_project - project_data parameter missing');
                    error_log('ajax.php: Available POST keys: ' . implode(', ', array_keys($_POST)));
                    echo json_encode(['success' => false, 'error' => 'Missing project_data parameter']);
                    exit; // Use exit instead of break to ensure response is sent
                }
                
                $projectdata = $_POST['project_data'];
                error_log('ajax.php: save_project - Received data length: ' . strlen($projectdata));
                
                if (empty($projectdata)) {
                    error_log('ajax.php: save_project - project_data is empty');
                    echo json_encode(['success' => false, 'error' => 'Empty project_data']);
                    exit;
                }
                
                // Check if data is too large (safety check)
                if (strlen($projectdata) > 10000000) { // 10MB limit
                    error_log('ajax.php: save_project - project_data too large: ' . strlen($projectdata) . ' bytes');
                    echo json_encode(['success' => false, 'error' => 'Data too large']);
                    exit;
                }
                
                $decoded = json_decode($projectdata, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    $error = 'Invalid JSON data: ' . json_last_error_msg();
                    error_log('ajax.php: save_project - JSON decode error: ' . $error);
                    error_log('ajax.php: First 500 chars of data: ' . substr($projectdata, 0, 500));
                    echo json_encode(['success' => false, 'error' => $error]);
                    exit;
                }
                
                error_log('ajax.php: save_project - Decoded successfully');
                error_log('ajax.php: save_project - Plan data keys: ' . implode(', ', array_keys($decoded['plan'] ?? [])));
                error_log('ajax.php: save_project - customSections count: ' . count($decoded['plan']['customSections'] ?? []));
                error_log('ajax.php: save_project - removedSections: ' . json_encode($decoded['plan']['removedSections'] ?? []));
                
                // Try normalized schema first
                $success = researchflow_save_project_normalized($researchflow->id, $USER->id, $decoded);
                
                // If normalized save fails, fall back to old method
                // If normalized save fails, fall back to old method
                if (!$success) {
                    error_log('ajax.php: Normalized save failed, falling back to old method');
                    $success = researchflow_save_project($researchflow->id, $USER->id, $projectdata);
                }
                
                if (!$success) {
                    error_log('ajax.php: Save project failed for user ' . $USER->id . ' activity ' . $researchflow->id);
                    echo json_encode(['success' => false, 'error' => 'Save operation returned false']);
                } else {
                    error_log('ajax.php: Save project SUCCESS');
                    
                    // Check if we have ID mappings to return (from normalized save)
                    $response = ['success' => true];
                    if (is_array($success) && isset($success['ideaMappings'])) {
                        $response['ideaMappings'] = $success['ideaMappings'];
                    }
                    
                    echo json_encode($response);
                }
                exit; // Ensure response is sent
            } catch (Exception $e) {
                error_log('ajax.php: Save project exception: ' . $e->getMessage());
                error_log('ajax.php: Exception trace: ' . $e->getTraceAsString());
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
                exit;
            } catch (Error $e) {
                error_log('ajax.php: Save project fatal error: ' . $e->getMessage());
                error_log('ajax.php: Error trace: ' . $e->getTraceAsString());
                echo json_encode(['success' => false, 'error' => 'Fatal error: ' . $e->getMessage()]);
                exit;
            }
            break;
            
        case 'load_project':
            // Try normalized schema first
            $projectdata = researchflow_load_project_normalized($researchflow->id, $USER->id);
            
            // If normalized load fails, fall back to old method
            if ($projectdata === false) {
                $projectdata = researchflow_load_project($researchflow->id, $USER->id);
                if ($projectdata !== false) {
                    $projectdata = json_decode($projectdata, true);
                }
            }
            
            if ($projectdata !== false) {
                echo json_encode(['success' => true, 'project' => $projectdata]);
            } else {
                echo json_encode(['success' => true, 'project' => null]);
            }
            break;
            
        case 'load_chat_history_only':
            // OPTIMIZED: Load ONLY chat history (fast initialization)
            $limit = optional_param('limit', null, PARAM_INT);
            $sessionId = optional_param('session_id', null, PARAM_ALPHANUMEXT);
            $chatHistory = researchflow_load_chat_history_only($researchflow->id, $USER->id, $limit, $sessionId);
            echo json_encode(['success' => true, 'chatHistory' => $chatHistory]);
            break;

        case 'delete_idea':
            $mgr = new \mod_researchflow\data\ProjectDataManager();
            $ideaid = optional_param('idea_id', 0, PARAM_INT);
            if ($ideaid) {
                $ok = $mgr->deleteIdea($researchflow->id, $USER->id, $ideaid);
                echo json_encode(['success' => (bool)$ok]);
                break;
            }
            // Fallback: delete by fields (content, location, sectionId)
            $content = required_param('content', PARAM_RAW);
            $location = required_param('location', PARAM_ALPHANUMEXT); // allow hyphens if needed
            $sectionid = optional_param('sectionId', null, PARAM_ALPHANUMEXT);
            $ok = $mgr->deleteIdeaByFields($researchflow->id, $USER->id, trim($content), $location, $sectionid);
            echo json_encode(['success' => (bool)$ok]);
            break;
            
        case 'delete_project':
            $success = researchflow_delete_project($researchflow->id, $USER->id);
            echo json_encode(['success' => $success]);
            break;
            
        case 'migrate_project':
            $result = researchflow_migrate_project($researchflow->id, $USER->id);
            echo json_encode($result);
            break;
            
        case 'rollback_migration':
            $result = researchflow_rollback_migration($researchflow->id, $USER->id);
            echo json_encode($result);
            break;
            
        case 'migration_status':
            $status = researchflow_get_migration_status();
            echo json_encode(['success' => true, 'status' => $status]);
            break;
            
        case 'test':
            echo json_encode(['success' => true, 'message' => 'AJAX endpoint working']);
            break;
            
        // === CHAT SESSION MANAGEMENT ===
        case 'create_chat_session':
            $title = optional_param('title', 'New Chat', PARAM_TEXT);
            $result = \mod_researchflow\data\ChatSessionManager::createSession($researchflow->id, $USER->id, $title);
            echo json_encode(['success' => true, 'session_id' => $result]);
            break;
            
        case 'get_chat_sessions':
            $sessions = \mod_researchflow\data\ChatSessionManager::getSessions($researchflow->id, $USER->id);
            echo json_encode(['success' => true, 'sessions' => $sessions]);
            break;
            
        case 'switch_chat_session':
            $sessionId = required_param('session_id', PARAM_TEXT);
            $result = \mod_researchflow\data\ChatSessionManager::switchToSession($researchflow->id, $USER->id, $sessionId);
            echo json_encode(['success' => $result]);
            break;
            
        case 'delete_chat_session':
            $sessionId = required_param('session_id', PARAM_TEXT);
            $result = \mod_researchflow\data\ChatSessionManager::deleteSession($researchflow->id, $USER->id, $sessionId);
            echo json_encode(['success' => $result]);
            break;
            
        case 'update_chat_title':
            $sessionId = required_param('session_id', PARAM_TEXT);
            $newTitle = required_param('title', PARAM_TEXT);
            $result = \mod_researchflow\data\ChatSessionManager::updateSessionTitle($researchflow->id, $USER->id, $sessionId, $newTitle);
            echo json_encode(['success' => $result]);
            break;
            
        case 'get_session_messages':
            $sessionId = required_param('session_id', PARAM_TEXT);
            $messages = \mod_researchflow\data\ChatSessionManager::getSessionMessages($researchflow->id, $USER->id, $sessionId);
            echo json_encode(['success' => true, 'messages' => $messages]);
            break;
            
        case 'save_session_message':
            $sessionId = required_param('session_id', PARAM_TEXT);
            $role = required_param('role', PARAM_TEXT);
            // Allow full chat content including punctuation/newlines/JSON-like structures
            $content = required_param('content', PARAM_RAW);
            // Accept timestamp as ISO string or integer (for backward compatibility)
            $timestampParam = optional_param('timestamp', null, PARAM_RAW);
            $timestamp = null;
            if ($timestampParam !== null) {
                if (is_numeric($timestampParam)) {
                    // Unix timestamp (integer) - convert to ISO string
                    $timestamp = date('Y-m-d H:i:s', (int)$timestampParam);
                } else {
                    // ISO string - use as-is (TIMESTAMP/TIMESTAMPTZ format)
                    $timestamp = $timestampParam;
                }
            } else {
                $timestamp = date('Y-m-d H:i:s');
            }
            $result = \mod_researchflow\data\ChatSessionManager::saveMessage($researchflow->id, $USER->id, $sessionId, $role, $content, $timestamp);
            echo json_encode(['success' => $result !== false, 'message_id' => $result]);
            break;
            
        case 'append_message':
            try {
                $sessionId = optional_param('session_id', 'default', PARAM_RAW_TRIMMED);
                $role = required_param('role', PARAM_RAW_TRIMMED); // More permissive for role
                // Allow full chat content including punctuation/newlines/JSON-like structures
                $content = required_param('content', PARAM_RAW);
                // Accept timestamp as ISO string or integer - pass through to saveMessage which handles conversion
                // saveMessage will convert to Unix timestamp (integer) as required by database
                $timestamp = optional_param('timestamp', null, PARAM_RAW);
                
                // Validate role is one of expected values
                if (!in_array($role, ['user', 'assistant', 'system'])) {
                    throw new Exception('Invalid role: ' . $role);
                }
                
                error_log('append_message: sessionId=' . $sessionId . ', role=' . $role . ', content_length=' . strlen($content) . ', timestamp=' . $timestamp);
                
                // Use appendMessage which preserves history and prevents duplicates
                $result = \mod_researchflow\data\ChatSessionManager::appendMessage($researchflow->id, $USER->id, $sessionId, $role, $content, $timestamp);
                echo json_encode(['success' => $result !== false, 'message_id' => $result]);
            } catch (Exception $e) {
                error_log('append_message error: ' . $e->getMessage());
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            }
            break;
            
        case 'clear_session_messages':
            $sessionId = required_param('session_id', PARAM_TEXT);
            $result = \mod_researchflow\data\ChatSessionManager::clearSessionMessages($researchflow->id, $USER->id, $sessionId);
            echo json_encode(['success' => $result]);
            break;
            
        case 'get_version_history':
            $phase = required_param('phase', PARAM_ALPHANUMEXT);
            $versions = \mod_researchflow\data\VersionManager::getVersionHistory($researchflow->id, $USER->id, $phase);
            echo json_encode(['success' => true, 'versions' => $versions]);
            break;
            
        case 'get_version':
            $phase = required_param('phase', PARAM_ALPHANUMEXT);
            $versionNumber = required_param('version_number', PARAM_INT);
            $version = \mod_researchflow\data\VersionManager::getVersion($researchflow->id, $USER->id, $phase, $versionNumber);
            if ($version) {
                echo json_encode(['success' => true, 'version' => $version]);
            } else {
                echo json_encode(['success' => false, 'error' => 'Version not found']);
            }
            break;
            
        case 'restore_version':
            $phase = required_param('phase', PARAM_ALPHANUMEXT);
            $versionNumber = required_param('version_number', PARAM_INT);
            $version = \mod_researchflow\data\VersionManager::getVersion($researchflow->id, $USER->id, $phase, $versionNumber);
            if ($version) {
                // Update current content directly
                global $DB;
                $now = time();
                $record = [
                    'researchflowid' => $researchflow->id,
                    'userid' => $USER->id,
                    'phase' => $phase,
                    'content' => $version->content,
                    'word_count' => $version->word_count,
                    'modified_at' => $now
                ];
                
                $existing = $DB->get_record('researchflow_content', [
                    'researchflowid' => $researchflow->id,
                    'userid' => $USER->id,
                    'phase' => $phase
                ]);
                
                if ($existing) {
                    $record['id'] = $existing->id;
                    $record['created_at'] = $existing->created_at;
                    $DB->update_record('researchflow_content', $record);
                } else {
                    $record['created_at'] = $now;
                    $DB->insert_record('researchflow_content', $record);
                }
                
                // Create a new version snapshot for the restore
                \mod_researchflow\data\VersionManager::saveVersion(
                    $researchflow->id,
                    $USER->id,
                    $phase,
                    $version->content,
                    $version->word_count,
                    'Restored from version ' . $versionNumber
                );
                
                echo json_encode(['success' => true, 'message' => 'Version restored']);
            } else {
                echo json_encode(['success' => false, 'error' => 'Version not found']);
            }
            break;
            
        case 'save_instructor_goal':
            try {
                // Check if user has permission to edit goals
                if (!has_capability('mod/researchflow:addinstance', $context) && 
                    !has_capability('moodle/course:manageactivities', $context)) {
                    echo json_encode(['success' => false, 'error' => 'Permission denied']);
                    exit;
                }
                
                $tab = required_param('tab', PARAM_ALPHANUMEXT);
                $goal = optional_param('goal', '', PARAM_RAW);
                
                // Validate tab
                if (!in_array($tab, ['plan', 'write', 'edit'])) {
                    echo json_encode(['success' => false, 'error' => 'Invalid tab']);
                    exit;
                }
                
                // Check if database fields exist
                global $CFG;
                require_once($CFG->libdir . '/ddllib.php');
                $dbman = $DB->get_manager();
                $table = new xmldb_table('researchflow');
                $fieldName = $tab . '_goal';
                $field = new xmldb_field($fieldName, XMLDB_TYPE_TEXT, null, null, null, null, null);
                
                // If field doesn't exist, try to add it
                if (!$dbman->field_exists($table, $field)) {
                    error_log('ajax.php: Goal field ' . $fieldName . ' does not exist, attempting to create it');
                    try {
                        $dbman->add_field($table, $field);
                        error_log('ajax.php: Successfully created field ' . $fieldName);
                    } catch (Exception $e) {
                        error_log('ajax.php: Failed to create field ' . $fieldName . ': ' . $e->getMessage());
                        echo json_encode(['success' => false, 'error' => 'Database field does not exist. Please run Moodle upgrade.']);
                        exit;
                    }
                }
                
                // Update the goal field in researchflow table
                // Use array syntax for dynamic field name
                $updateData = [
                    'id' => $researchflow->id,
                    $fieldName => $goal
                ];
                
                // Convert to object for update_record
                $updateObj = (object)$updateData;
                
                $result = $DB->update_record('researchflow', $updateObj);
                
                if (!$result) {
                    error_log('ajax.php: update_record returned false for goal save');
                    echo json_encode(['success' => false, 'error' => 'Failed to update database']);
                    exit;
                }
                
                echo json_encode(['success' => true]);
            } catch (Exception $e) {
                error_log('ajax.php: save_instructor_goal error: ' . $e->getMessage());
                error_log('ajax.php: save_instructor_goal trace: ' . $e->getTraceAsString());
                echo json_encode(['success' => false, 'error' => 'Error writing to database: ' . $e->getMessage()]);
            }
            break;
            
        case 'submit_project':
            $mgr = new \mod_researchflow\data\ProjectDataManager();
            $result = $mgr->submitProject($researchflow->id, $USER->id);
            echo json_encode(['success' => $result]);
            break;
            
        case 'proxy_chat':
            try {
                $apiEndpoint = get_config('mod_researchflow', 'api_endpoint');
                $apiKey = get_config('mod_researchflow', 'api_key');
                if (empty(trim($apiEndpoint ?? ''))) {
                    echo json_encode([
                        'success' => false,
                        'assistantReply' => 'The AI Writing Assistant API endpoint has not been configured. Please contact your site administrator.',
                        'project' => null
                    ]);
                    break;
                }
                $userInput = required_param('user_input', PARAM_RAW);
                $projectData = optional_param('project_data', '{}', PARAM_RAW);
                $decoded = json_decode($projectData, true);
                $currentProject = is_array($decoded) ? $decoded : [];
                $requestBody = [
                    'userInput' => $userInput,
                    'currentProject' => $currentProject
                ];
                $url = rtrim($apiEndpoint, '/') . '/api/chat';
                $ch = curl_init($url);
                $headers = ['Content-Type: application/json'];
                if (!empty(trim($apiKey ?? ''))) {
                    $headers[] = 'X-API-Key: ' . $apiKey;
                }
                curl_setopt_array($ch, [
                    CURLOPT_POST => true,
                    CURLOPT_POSTFIELDS => json_encode($requestBody),
                    CURLOPT_HTTPHEADER => $headers,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT => 120
                ]);
                $response = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);
                if ($response === false) {
                    echo json_encode([
                        'success' => false,
                        'assistantReply' => 'Failed to connect to AI service. Please try again later.',
                        'project' => null
                    ]);
                    break;
                }
                $result = json_decode($response, true);
                if ($result === null) {
                    echo json_encode([
                        'success' => false,
                        'assistantReply' => 'Invalid response from AI service.',
                        'project' => null
                    ]);
                    break;
                }
                if ($httpCode >= 400) {
                    echo json_encode([
                        'success' => false,
                        'assistantReply' => $result['assistantReply'] ?? $result['error'] ?? 'AI service error.',
                        'project' => $result['project'] ?? null
                    ]);
                    break;
                }
                echo json_encode([
                    'success' => true,
                    'assistantReply' => $result['assistantReply'] ?? null,
                    'project' => $result['project'] ?? null
                ]);
            } catch (Exception $e) {
                error_log('proxy_chat error: ' . $e->getMessage());
                echo json_encode([
                    'success' => false,
                    'assistantReply' => 'Error: ' . $e->getMessage(),
                    'project' => null
                ]);
            }
            break;

        case 'log_activity':
            $activities = optional_param('activities', null, PARAM_RAW);
            if ($activities === null) {
                echo json_encode(['success' => false, 'error' => 'Missing activities parameter']);
                break;
            }
            
            $activities = json_decode($activities, true);
            if (!is_array($activities)) {
                echo json_encode(['success' => false, 'error' => 'Invalid activities format']);
                break;
            }
            
            // Save each activity
            $saved = 0;
            foreach ($activities as $activity) {
                try {
                    $record = new stdClass();
                    $record->researchflowid = $researchflow->id;
                    $record->userid = $USER->id;
                    $record->phase = $activity['phase'] ?? 'write';
                    $record->action_type = $activity['action_type'] ?? 'unknown';
                    $record->content_length = isset($activity['content_length']) ? (int)$activity['content_length'] : 0;
                    $record->word_count = isset($activity['word_count']) ? (int)$activity['word_count'] : 0;
                    $record->pasted_content = isset($activity['pasted_content']) ? substr($activity['pasted_content'], 0, 500) : null;
                    $record->pasted_length = isset($activity['pasted_length']) ? (int)$activity['pasted_length'] : 0;
                    $record->typed_content = isset($activity['typed_content']) ? substr($activity['typed_content'], 0, 500) : null;
                    $record->typing_speed = isset($activity['typing_speed']) ? (int)$activity['typing_speed'] : 0;
                    $record->session_id = $activity['session_id'] ?? null;
                    $record->timestamp = isset($activity['timestamp']) ? (int)$activity['timestamp'] : time();
                    $record->created_at = isset($activity['created_at']) ? (int)$activity['created_at'] : time();
                    
                    $DB->insert_record('researchflow_activity_log', $record);
                    $saved++;
                } catch (Exception $e) {
                    error_log('Failed to save activity log: ' . $e->getMessage());
                }
            }
            
            echo json_encode(['success' => true, 'saved' => $saved, 'total' => count($activities)]);
            break;
            
        default:
            throw new Exception('Invalid action');
    }
} catch (\moodle_exception $e) {
    error_log('AJAX Moodle Exception: ' . $e->getMessage());
    error_log('AJAX Exception trace: ' . $e->getTraceAsString());
    error_log('AJAX Request params: ' . json_encode($_POST));
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage(), 'debuginfo' => $e->debuginfo]);
} catch (Exception $e) {
    error_log('AJAX Exception: ' . $e->getMessage());
    error_log('AJAX Exception trace: ' . $e->getTraceAsString());
    error_log('AJAX Request params: ' . json_encode($_POST));
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
} 