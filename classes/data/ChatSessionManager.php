<?php
/**
 * Chat Session Manager
 * 
 * Handles multiple chat sessions for the AI Writing Assistant
 * 
 * @package    mod_writeassistdev
 * @copyright  2025 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_writeassistdev\data;

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
     * @param int $writeassistdevid Activity ID
     * @param int $userid User ID
     * @param string $title Chat title
     * @return string Session ID
     */
    public static function createSession($writeassistdevid, $userid, $title = 'New Chat') {
        global $DB;
        
        // Generate unique session ID
        $sessionId = 'chat_' . $userid . '_' . $writeassistdevid . '_' . time() . '_' . uniqid();
        
        // Set all other sessions as inactive
        $DB->set_field('writeassistdev_chat_sessions', 'is_active', 0, [
            'writeassistdevid' => $writeassistdevid,
            'userid' => $userid
        ]);
        
        // Create new session
        $record = [
            'writeassistdevid' => $writeassistdevid,
            'userid' => $userid,
            'session_id' => $sessionId,
            'title' => $title,
            'is_active' => 1,
            'created_at' => time(),
            'modified_at' => time()
        ];
        
        $DB->insert_record('writeassistdev_chat_sessions', $record);
        
        return $sessionId;
    }
    
    /**
     * Get all chat sessions for a user and activity
     * 
     * @param int $writeassistdevid Activity ID
     * @param int $userid User ID
     * @return array Array of chat sessions
     */
    public static function getSessions($writeassistdevid, $userid) {
        global $DB;
        
        $sessions = $DB->get_records('writeassistdev_chat_sessions', [
            'writeassistdevid' => $writeassistdevid,
            'userid' => $userid
        ], 'created_at DESC');
        
        return $sessions;
    }
    
    /**
     * Get active chat session
     * 
     * @param int $writeassistdevid Activity ID
     * @param int $userid User ID
     * @return object|null Active session or null
     */
    public static function getActiveSession($writeassistdevid, $userid) {
        global $DB;
        
        return $DB->get_record('writeassistdev_chat_sessions', [
            'writeassistdevid' => $writeassistdevid,
            'userid' => $userid,
            'is_active' => 1
        ]);
    }
    
    /**
     * Switch to a specific chat session
     * 
     * @param int $writeassistdevid Activity ID
     * @param int $userid User ID
     * @param string $sessionId Session ID to switch to
     * @return bool Success
     */
    public static function switchToSession($writeassistdevid, $userid, $sessionId) {
        global $DB;
        
        // Set all sessions as inactive
        $DB->set_field('writeassistdev_chat_sessions', 'is_active', 0, [
            'writeassistdevid' => $writeassistdevid,
            'userid' => $userid
        ]);
        
        // Set target session as active
        $result = $DB->set_field('writeassistdev_chat_sessions', 'is_active', 1, [
            'writeassistdevid' => $writeassistdevid,
            'userid' => $userid,
            'session_id' => $sessionId
        ]);
        
        return $result !== false;
    }
    
    /**
     * Delete a chat session and all its messages
     * 
     * @param int $writeassistdevid Activity ID
     * @param int $userid User ID
     * @param string $sessionId Session ID to delete
     * @return bool Success
     */
    public static function deleteSession($writeassistdevid, $userid, $sessionId) {
        global $DB;
        
        try {
            $DB->start_delegated_transaction();
            
            // Delete all messages in this session
            $DB->delete_records('writeassistdev_chat', [
                'writeassistdevid' => $writeassistdevid,
                'userid' => $userid,
                'chat_session_id' => $sessionId
            ]);
            
            // Delete the session
            $DB->delete_records('writeassistdev_chat_sessions', [
                'writeassistdevid' => $writeassistdevid,
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
     * @param int $writeassistdevid Activity ID
     * @param int $userid User ID
     * @param string $sessionId Session ID
     * @param string $newTitle New title
     * @return bool Success
     */
    public static function updateSessionTitle($writeassistdevid, $userid, $sessionId, $newTitle) {
        global $DB;
        
        $result = $DB->set_field('writeassistdev_chat_sessions', 'title', $newTitle, [
            'writeassistdevid' => $writeassistdevid,
            'userid' => $userid,
            'session_id' => $sessionId
        ]);
        
        if ($result !== false) {
            $DB->set_field('writeassistdev_chat_sessions', 'modified_at', time(), [
                'writeassistdevid' => $writeassistdevid,
                'userid' => $userid,
                'session_id' => $sessionId
            ]);
        }
        
        return $result !== false;
    }
    
    /**
     * Get chat messages for a specific session
     * 
     * @param int $writeassistdevid Activity ID
     * @param int $userid User ID
     * @param string $sessionId Session ID
     * @return array Array of messages
     */
    public static function getSessionMessages($writeassistdevid, $userid, $sessionId) {
        global $DB;
        
        $messages = $DB->get_records('writeassistdev_chat', [
            'writeassistdevid' => $writeassistdevid,
            'userid' => $userid,
            'chat_session_id' => $sessionId
        ], 'timestamp ASC');
        
        return $messages;
    }
    
    /**
     * Save a message to a specific chat session (APPEND MODE - Preserves History)
     * 
     * @param int $writeassistdevid Activity ID
     * @param int $userid User ID
     * @param string $sessionId Session ID
     * @param string $role Message role (user/assistant)
     * @param string $content Message content
     * @param int $timestamp Message timestamp
     * @return int|false Message ID or false on failure
     */
    public static function saveMessage($writeassistdevid, $userid, $sessionId, $role, $content, $timestamp = null) {
        global $DB;
        
        try {
            if ($timestamp === null) {
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
                'writeassistdevid' => $writeassistdevid,
                'userid' => $userid,
                'chat_session_id' => $sessionId,
                'role' => $role,
                'content' => $content,
                'timestamp' => $timestamp,
                'created_at' => time()
            ];
            
            $result = $DB->insert_record('writeassistdev_chat', $record);
            
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
     * @param int $writeassistdevid Activity ID
     * @param int $userid User ID
     * @param string $sessionId Session ID
     * @return bool Success
     */
    public static function clearSessionMessages($writeassistdevid, $userid, $sessionId) {
        global $DB;
        
        $result = $DB->delete_records('writeassistdev_chat', [
            'writeassistdevid' => $writeassistdevid,
            'userid' => $userid,
            'chat_session_id' => $sessionId
        ]);
        
        return $result !== false;
    }
    
    /**
     * Append a single message to a chat session (No Deletion)
     * This is the preferred method for saving individual messages
     * 
     * @param int $writeassistdevid Activity ID
     * @param int $userid User ID
     * @param string $sessionId Session ID
     * @param string $role Message role (user/assistant)
     * @param string $content Message content
     * @param int|null $timestamp Optional timestamp (defaults to current time)
     * @return int|false Message ID or false on failure
     */
    public static function appendMessage($writeassistdevid, $userid, $sessionId, $role, $content, $timestamp = null) {
        return self::saveMessage($writeassistdevid, $userid, $sessionId, $role, $content, $timestamp);
    }
    
    /**
     * Get session count for a user and activity
     * 
     * @param int $writeassistdevid Activity ID
     * @param int $userid User ID
     * @return int Session count
     */
    public static function getSessionCount($writeassistdevid, $userid) {
        global $DB;
        
        return $DB->count_records('writeassistdev_chat_sessions', [
            'writeassistdevid' => $writeassistdevid,
            'userid' => $userid
        ]);
    }
}
