<?php
/**
 * Chat Session Manager
 * 
 * Handles multiple chat sessions for the AI Writing Assistant
 * 
 * @package    mod_researchflow
 * @copyright  2025 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_researchflow\data;

defined('MOODLE_INTERNAL') || die();

/**
 * ChatSessionManager class
 * 
 * Manages multiple chat sessions with proper database persistence
 */
class ChatSessionManager {
    
    /**
     * Create a new chat session
     * 
     * @param int $researchflowid Activity ID
     * @param int $userid User ID
     * @param string $title Chat title
     * @return string Session ID
     */
    public static function createSession($researchflowid, $userid, $title = 'New Chat') {
        global $DB;
        
        // Generate unique session ID
        $sessionId = 'chat_' . $userid . '_' . $researchflowid . '_' . time() . '_' . uniqid();
        
        // Set all other sessions as inactive
        $DB->set_field('researchflow_chat_sessions', 'is_active', 0, [
            'researchflowid' => $researchflowid,
            'userid' => $userid
        ]);
        
        // Create new session
        $record = [
            'researchflowid' => $researchflowid,
            'userid' => $userid,
            'session_id' => $sessionId,
            'title' => $title,
            'is_active' => 1,
            'created_at' => time(),
            'modified_at' => time()
        ];
        
        $DB->insert_record('researchflow_chat_sessions', $record);
        
        return $sessionId;
    }
    
    /**
     * Get all chat sessions for a user and activity
     * 
     * @param int $researchflowid Activity ID
     * @param int $userid User ID
     * @return array Array of chat sessions
     */
    public static function getSessions($researchflowid, $userid) {
        global $DB;
        
        $sessions = $DB->get_records('researchflow_chat_sessions', [
            'researchflowid' => $researchflowid,
            'userid' => $userid
        ], 'created_at DESC');
        
        return $sessions;
    }
    
    /**
     * Get active chat session
     * 
     * @param int $researchflowid Activity ID
     * @param int $userid User ID
     * @return object|null Active session or null
     */
    public static function getActiveSession($researchflowid, $userid) {
        global $DB;
        
        return $DB->get_record('researchflow_chat_sessions', [
            'researchflowid' => $researchflowid,
            'userid' => $userid,
            'is_active' => 1
        ]);
    }
    
    /**
     * Switch to a specific chat session
     * 
     * @param int $researchflowid Activity ID
     * @param int $userid User ID
     * @param string $sessionId Session ID to switch to
     * @return bool Success
     */
    public static function switchToSession($researchflowid, $userid, $sessionId) {
        global $DB;
        
        // Set all sessions as inactive
        $DB->set_field('researchflow_chat_sessions', 'is_active', 0, [
            'researchflowid' => $researchflowid,
            'userid' => $userid
        ]);
        
        // Set target session as active
        $result = $DB->set_field('researchflow_chat_sessions', 'is_active', 1, [
            'researchflowid' => $researchflowid,
            'userid' => $userid,
            'session_id' => $sessionId
        ]);
        
        return $result !== false;
    }
    
    /**
     * Delete a chat session and all its messages
     * 
     * @param int $researchflowid Activity ID
     * @param int $userid User ID
     * @param string $sessionId Session ID to delete
     * @return bool Success
     */
    public static function deleteSession($researchflowid, $userid, $sessionId) {
        global $DB;
        
        try {
            $DB->start_delegated_transaction();
            
            // Delete all messages in this session
            $DB->delete_records('researchflow_chat', [
                'researchflowid' => $researchflowid,
                'userid' => $userid,
                'chat_session_id' => $sessionId
            ]);
            
            // Delete the session
            $DB->delete_records('researchflow_chat_sessions', [
                'researchflowid' => $researchflowid,
                'userid' => $userid,
                'session_id' => $sessionId
            ]);
            
            $DB->allow_commit();
            return true;
            
        } catch (\Exception $e) {
            $DB->rollback_delegated_transaction();
            error_log('ChatSessionManager: Failed to delete session: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Update chat session title
     * 
     * @param int $researchflowid Activity ID
     * @param int $userid User ID
     * @param string $sessionId Session ID
     * @param string $newTitle New title
     * @return bool Success
     */
    public static function updateSessionTitle($researchflowid, $userid, $sessionId, $newTitle) {
        global $DB;
        
        $result = $DB->set_field('researchflow_chat_sessions', 'title', $newTitle, [
            'researchflowid' => $researchflowid,
            'userid' => $userid,
            'session_id' => $sessionId
        ]);
        
        if ($result !== false) {
            $DB->set_field('researchflow_chat_sessions', 'modified_at', time(), [
                'researchflowid' => $researchflowid,
                'userid' => $userid,
                'session_id' => $sessionId
            ]);
        }
        
        return $result !== false;
    }
    
    /**
     * Get chat messages for a specific session
     * 
     * @param int $researchflowid Activity ID
     * @param int $userid User ID
     * @param string $sessionId Session ID
     * @return array Array of messages
     */
    public static function getSessionMessages($researchflowid, $userid, $sessionId) {
        global $DB;
        
        $messages = $DB->get_records('researchflow_chat', [
            'researchflowid' => $researchflowid,
            'userid' => $userid,
            'chat_session_id' => $sessionId
        ], 'timestamp ASC');
        
        return $messages;
    }
    
    /**
     * Save a message to a specific chat session (APPEND MODE - Preserves History)
     * 
     * @param int $researchflowid Activity ID
     * @param int $userid User ID
     * @param string $sessionId Session ID
     * @param string $role Message role (user/assistant)
     * @param string $content Message content
     * @param int $timestamp Message timestamp
     * @return int|false Message ID or false on failure
     */
    public static function saveMessage($researchflowid, $userid, $sessionId, $role, $content, $timestamp = null) {
        global $DB;
        
        try {
            // Ensure session exists - get or create active session if needed
            if (empty($sessionId) || $sessionId === 'default') {
                // If sessionId is 'default' or empty, get or create active session
                $activeSession = self::getActiveSession($researchflowid, $userid);
                if (!$activeSession) {
                    $sessionId = self::createSession($researchflowid, $userid, 'New Chat');
                    error_log("ChatSessionManager: Created new session for default: $sessionId");
                } else {
                    $sessionId = $activeSession->session_id;
                    error_log("ChatSessionManager: Using active session: $sessionId");
                }
            } else {
                // Check if the provided sessionId exists
                $sessionExists = $DB->record_exists('researchflow_chat_sessions', [
                    'researchflowid' => $researchflowid,
                    'userid' => $userid,
                    'session_id' => $sessionId
                ]);
                
                if (!$sessionExists) {
                    // Session doesn't exist - use active session instead, or create new one
                    error_log("ChatSessionManager: Session $sessionId doesn't exist, using active session");
                    $activeSession = self::getActiveSession($researchflowid, $userid);
                    if (!$activeSession) {
                        $sessionId = self::createSession($researchflowid, $userid, 'New Chat');
                        error_log("ChatSessionManager: Created new session: $sessionId");
                    } else {
                        $sessionId = $activeSession->session_id;
                        error_log("ChatSessionManager: Using active session: $sessionId");
                    }
                }
            }
            
            // Handle timestamp - convert to Unix timestamp (integer) as required by database
            // Database field is TYPE="int" (Unix timestamp in seconds)
            if ($timestamp === null) {
                $timestamp = time();
            } else if (is_numeric($timestamp)) {
                // Already a number - ensure it's an integer
                $timestamp = (int)$timestamp;
                // If it's in milliseconds (13 digits), convert to seconds
                if ($timestamp > 10000000000) {
                    $timestamp = (int)($timestamp / 1000);
                }
            } else if (is_string($timestamp)) {
                // ISO string or date string - convert to Unix timestamp
                if (strpos($timestamp, 'T') !== false) {
                    // ISO format: 2024-01-01T12:34:56.789Z
                    $timestamp = strtotime($timestamp);
                } else if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $timestamp)) {
                    // MySQL TIMESTAMP format: 2024-01-01 12:34:56
                    $timestamp = strtotime($timestamp);
                } else {
                    // Try to parse as date
                    $timestamp = strtotime($timestamp);
                }
                // Ensure it's an integer
                $timestamp = $timestamp !== false ? (int)$timestamp : time();
            } else {
                $timestamp = time();
            }
            
            // Truncate content if too long (safety measure)
            $maxContentLength = 65535; // TEXT field max
            if (strlen($content) > $maxContentLength) {
                $content = substr($content, 0, $maxContentLength);
                error_log('ChatSessionManager: Content truncated to ' . $maxContentLength . ' characters');
            }
            
            // Skip duplicate check for now - frontend handles deduplication
            // The duplicate check was causing database errors with TEXT field comparisons
            // Frontend already prevents duplicate messages from being added
            
            $record = [
                'researchflowid' => $researchflowid,
                'userid' => $userid,
                'chat_session_id' => $sessionId,
                'role' => $role,
                'content' => $content,
                'timestamp' => $timestamp, // Unix timestamp (integer, seconds since epoch)
                'created_at' => time()
            ];
            
            $result = $DB->insert_record('researchflow_chat', $record);
            
            if ($result === false) {
                error_log('ChatSessionManager: insert_record returned false');
                throw new \Exception('Failed to insert chat message');
            }
            
            return $result;
            
        } catch (\Exception $e) {
            error_log('ChatSessionManager::saveMessage error: ' . $e->getMessage());
            error_log('ChatSessionManager::saveMessage trace: ' . $e->getTraceAsString());
            throw new \Exception('Error reading from database: ' . $e->getMessage());
        }
    }
    
    /**
     * Clear all messages from a chat session
     * 
     * @param int $researchflowid Activity ID
     * @param int $userid User ID
     * @param string $sessionId Session ID
     * @return bool Success
     */
    public static function clearSessionMessages($researchflowid, $userid, $sessionId) {
        global $DB;
        
        $result = $DB->delete_records('researchflow_chat', [
            'researchflowid' => $researchflowid,
            'userid' => $userid,
            'chat_session_id' => $sessionId
        ]);
        
        return $result !== false;
    }
    
    /**
     * Append a single message to a chat session (No Deletion)
     * This is the preferred method for saving individual messages
     * 
     * @param int $researchflowid Activity ID
     * @param int $userid User ID
     * @param string $sessionId Session ID
     * @param string $role Message role (user/assistant)
     * @param string $content Message content
     * @param int|null $timestamp Optional timestamp (defaults to current time)
     * @return int|false Message ID or false on failure
     */
    public static function appendMessage($researchflowid, $userid, $sessionId, $role, $content, $timestamp = null) {
        return self::saveMessage($researchflowid, $userid, $sessionId, $role, $content, $timestamp);
    }
    
    /**
     * Get session count for a user and activity
     * 
     * @param int $researchflowid Activity ID
     * @param int $userid User ID
     * @return int Session count
     */
    public static function getSessionCount($researchflowid, $userid) {
        global $DB;
        
        return $DB->count_records('researchflow_chat_sessions', [
            'researchflowid' => $researchflowid,
            'userid' => $userid
        ]);
    }
}
