<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Simplified AJAX handler for writeassistdev module
 * Directly calls lib.php functions without unnecessary validation layers
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once('../../config.php');
require_once($CFG->dirroot . '/mod/writeassistdev/lib.php');

// Basic AJAX request check
if (!isset($_SERVER['HTTP_X_REQUESTED_WITH']) || strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) !== 'xmlhttprequest') {
    http_response_code(403);
    die('Direct access not allowed');
}

// Get parameters
$action = required_param('action', PARAM_ALPHANUMEXT);
$cmid = required_param('cmid', PARAM_INT);
$sesskey = required_param('sesskey', PARAM_ALPHANUM);

// Verify session key
if (!confirm_sesskey($sesskey)) {
    http_response_code(403);
    die('Invalid session key');
}

// Get course module and context
$cm = get_coursemodule_from_id('writeassistdev', $cmid, 0, false, MUST_EXIST);
$course = $DB->get_record('course', array('id' => $cm->course), '*', MUST_EXIST);
$writeassistdev = $DB->get_record('writeassistdev', array('id' => $cm->instance), '*', MUST_EXIST);

// Set up context
$context = context_module::instance($cm->id);
require_login($course, true, $cm);
require_capability('mod/writeassistdev:view', $context);

// Set JSON header
header('Content-Type: application/json');

try {
    error_log('AJAX request: action=' . $action . ', cmid=' . $cmid . ', user=' . $USER->id);
    
    switch ($action) {
        case 'save_project':
            $projectdata = required_param('project_data', PARAM_RAW);
            
            try {
                $decoded = json_decode($projectdata, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    throw new Exception('Invalid JSON data: ' . json_last_error_msg());
                }
                
                // Try normalized schema first
                $success = writeassistdev_save_project_normalized($writeassistdev->id, $USER->id, $decoded);
                
                // If normalized save fails, fall back to old method
                if (!$success) {
                    error_log('Normalized save failed, falling back to old method');
                    $success = writeassistdev_save_project($writeassistdev->id, $USER->id, $projectdata);
                }
                
                if (!$success) {
                    error_log('Save project failed for user ' . $USER->id . ' activity ' . $writeassistdev->id);
                }
                
                echo json_encode(['success' => $success]);
            } catch (Exception $e) {
                error_log('Save project error: ' . $e->getMessage());
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            }
            break;
            
        case 'load_project':
            // Try normalized schema first
            $projectdata = writeassistdev_load_project_normalized($writeassistdev->id, $USER->id);
            
            // If normalized load fails, fall back to old method
            if ($projectdata === false) {
                $projectdata = writeassistdev_load_project($writeassistdev->id, $USER->id);
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
            $chatHistory = writeassistdev_load_chat_history_only($writeassistdev->id, $USER->id);
            echo json_encode(['success' => true, 'chatHistory' => $chatHistory]);
            break;

        case 'delete_idea':
            $mgr = new \mod_writeassistdev\data\ProjectDataManager();
            $ideaid = optional_param('idea_id', 0, PARAM_INT);
            if ($ideaid) {
                $ok = $mgr->deleteIdea($writeassistdev->id, $USER->id, $ideaid);
                echo json_encode(['success' => (bool)$ok]);
                break;
            }
            // Fallback: delete by fields (content, location, sectionId)
            $content = required_param('content', PARAM_RAW);
            $location = required_param('location', PARAM_ALPHANUMEXT); // allow hyphens if needed
            $sectionid = optional_param('sectionId', null, PARAM_ALPHANUMEXT);
            $ok = $mgr->deleteIdeaByFields($writeassistdev->id, $USER->id, trim($content), $location, $sectionid);
            echo json_encode(['success' => (bool)$ok]);
            break;
            
        case 'delete_project':
            $success = writeassistdev_delete_project($writeassistdev->id, $USER->id);
            echo json_encode(['success' => $success]);
            break;
            
        case 'migrate_project':
            $result = writeassistdev_migrate_project($writeassistdev->id, $USER->id);
            echo json_encode($result);
            break;
            
        case 'rollback_migration':
            $result = writeassistdev_rollback_migration($writeassistdev->id, $USER->id);
            echo json_encode($result);
            break;
            
        case 'migration_status':
            $status = writeassistdev_get_migration_status();
            echo json_encode(['success' => true, 'status' => $status]);
            break;
            
        case 'test':
            echo json_encode(['success' => true, 'message' => 'AJAX endpoint working']);
            break;
            
        // === CHAT SESSION MANAGEMENT ===
        case 'create_chat_session':
            $title = optional_param('title', 'New Chat', PARAM_TEXT);
            $result = \mod_writeassistdev\data\ChatSessionManager::createSession($writeassistdev->id, $USER->id, $title);
            echo json_encode(['success' => true, 'session_id' => $result]);
            break;
            
        case 'get_chat_sessions':
            $sessions = \mod_writeassistdev\data\ChatSessionManager::getSessions($writeassistdev->id, $USER->id);
            echo json_encode(['success' => true, 'sessions' => $sessions]);
            break;
            
        case 'switch_chat_session':
            $sessionId = required_param('session_id', PARAM_TEXT);
            $result = \mod_writeassistdev\data\ChatSessionManager::switchToSession($writeassistdev->id, $USER->id, $sessionId);
            echo json_encode(['success' => $result]);
            break;
            
        case 'delete_chat_session':
            $sessionId = required_param('session_id', PARAM_TEXT);
            $result = \mod_writeassistdev\data\ChatSessionManager::deleteSession($writeassistdev->id, $USER->id, $sessionId);
            echo json_encode(['success' => $result]);
            break;
            
        case 'update_chat_title':
            $sessionId = required_param('session_id', PARAM_TEXT);
            $newTitle = required_param('title', PARAM_TEXT);
            $result = \mod_writeassistdev\data\ChatSessionManager::updateSessionTitle($writeassistdev->id, $USER->id, $sessionId, $newTitle);
            echo json_encode(['success' => $result]);
            break;
            
        case 'get_session_messages':
            $sessionId = required_param('session_id', PARAM_TEXT);
            $messages = \mod_writeassistdev\data\ChatSessionManager::getSessionMessages($writeassistdev->id, $USER->id, $sessionId);
            echo json_encode(['success' => true, 'messages' => $messages]);
            break;
            
        case 'save_session_message':
            $sessionId = required_param('session_id', PARAM_TEXT);
            $role = required_param('role', PARAM_TEXT);
            // Allow full chat content including punctuation/newlines/JSON-like structures
            $content = required_param('content', PARAM_RAW);
            $timestamp = optional_param('timestamp', time(), PARAM_INT);
            $result = \mod_writeassistdev\data\ChatSessionManager::saveMessage($writeassistdev->id, $USER->id, $sessionId, $role, $content, $timestamp);
            echo json_encode(['success' => $result !== false, 'message_id' => $result]);
            break;
            
        case 'append_message':
            try {
                $sessionId = optional_param('session_id', 'default', PARAM_RAW_TRIMMED);
                $role = required_param('role', PARAM_RAW_TRIMMED); // More permissive for role
                // Allow full chat content including punctuation/newlines/JSON-like structures
                $content = required_param('content', PARAM_RAW);
                $timestamp = optional_param('timestamp', time(), PARAM_INT);
                
                // Validate role is one of expected values
                if (!in_array($role, ['user', 'assistant', 'system'])) {
                    throw new Exception('Invalid role: ' . $role);
                }
                
                error_log('append_message: sessionId=' . $sessionId . ', role=' . $role . ', content_length=' . strlen($content) . ', timestamp=' . $timestamp);
                
                // Use appendMessage which preserves history and prevents duplicates
                $result = \mod_writeassistdev\data\ChatSessionManager::appendMessage($writeassistdev->id, $USER->id, $sessionId, $role, $content, $timestamp);
                echo json_encode(['success' => $result !== false, 'message_id' => $result]);
            } catch (Exception $e) {
                error_log('append_message error: ' . $e->getMessage());
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            }
            break;
            
        case 'clear_session_messages':
            $sessionId = required_param('session_id', PARAM_TEXT);
            $result = \mod_writeassistdev\data\ChatSessionManager::clearSessionMessages($writeassistdev->id, $USER->id, $sessionId);
            echo json_encode(['success' => $result]);
            break;
            
        case 'get_version_history':
            $phase = required_param('phase', PARAM_ALPHANUMEXT);
            $versions = \mod_writeassistdev\data\VersionManager::getVersionHistory($writeassistdev->id, $USER->id, $phase);
            echo json_encode(['success' => true, 'versions' => $versions]);
            break;
            
        case 'get_version':
            $phase = required_param('phase', PARAM_ALPHANUMEXT);
            $versionNumber = required_param('version_number', PARAM_INT);
            $version = \mod_writeassistdev\data\VersionManager::getVersion($writeassistdev->id, $USER->id, $phase, $versionNumber);
            if ($version) {
                echo json_encode(['success' => true, 'version' => $version]);
            } else {
                echo json_encode(['success' => false, 'error' => 'Version not found']);
            }
            break;
            
        case 'restore_version':
            $phase = required_param('phase', PARAM_ALPHANUMEXT);
            $versionNumber = required_param('version_number', PARAM_INT);
            $version = \mod_writeassistdev\data\VersionManager::getVersion($writeassistdev->id, $USER->id, $phase, $versionNumber);
            if ($version) {
                // Update current content directly
                global $DB;
                $now = time();
                $record = [
                    'writeassistdevid' => $writeassistdev->id,
                    'userid' => $USER->id,
                    'phase' => $phase,
                    'content' => $version->content,
                    'word_count' => $version->word_count,
                    'modified_at' => $now
                ];
                
                $existing = $DB->get_record('writeassistdev_content', [
                    'writeassistdevid' => $writeassistdev->id,
                    'userid' => $USER->id,
                    'phase' => $phase
                ]);
                
                if ($existing) {
                    $record['id'] = $existing->id;
                    $record['created_at'] = $existing->created_at;
                    $DB->update_record('writeassistdev_content', $record);
                } else {
                    $record['created_at'] = $now;
                    $DB->insert_record('writeassistdev_content', $record);
                }
                
                // Create a new version snapshot for the restore
                \mod_writeassistdev\data\VersionManager::saveVersion(
                    $writeassistdev->id,
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