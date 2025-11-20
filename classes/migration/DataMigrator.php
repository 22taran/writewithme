<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Data migrator for writeassistdev module
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_writeassistdev\migration;

defined('MOODLE_INTERNAL') || die();

/**
 * Data migrator for converting JSON blob data to normalized schema
 */
class DataMigrator {
    
    private $parser;
    
    /**
     * Constructor
     */
    public function __construct() {
        $this->parser = new ProjectDataParser();
    }
    
    /**
     * Migrate all data for a specific user and activity
     * @param int $writeassistdevid Activity ID
     * @param int $userid User ID
     * @return array Migration result
     */
    public function migrate($writeassistdevid, $userid) {
        global $DB;
        
        try {
            // Get existing JSON data
            $record = $DB->get_record('writeassistdev_work', [
                'writeassistdevid' => $writeassistdevid,
                'userid' => $userid
            ]);
            
            if (!$record) {
                return ['success' => false, 'message' => 'No data found'];
            }
            
            $jsonData = json_decode($record->content, true);
            if (!$jsonData) {
                return ['success' => false, 'message' => 'Invalid JSON data'];
            }
            
            // Parse data
            $parsedData = $this->parser->parse($jsonData);
            
            // Start transaction
            $transaction = $DB->start_delegated_transaction();
            
            try {
                // Migrate metadata
                $this->migrateMetadata($parsedData['metadata'], $writeassistdevid, $userid);
                
                // Migrate ideas
                $this->migrateIdeas($parsedData['ideas'], $writeassistdevid, $userid);
                
                // Migrate content
                $this->migrateContent($parsedData['content'], $writeassistdevid, $userid);
                
                // Migrate chat
                $this->migrateChat($parsedData['chat'], $writeassistdevid, $userid);
                
                // Commit transaction
                $transaction->allow_commit();
                
                return [
                    'success' => true,
                    'ideas_migrated' => count($parsedData['ideas']),
                    'chat_messages_migrated' => count($parsedData['chat']),
                    'content_records_migrated' => count($parsedData['content']),
                    'metadata_records_migrated' => 1
                ];
                
            } catch (\Exception $e) {
                $transaction->rollback($e);
                throw $e;
            }
            
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    
    /**
     * Migrate metadata to normalized table
     * @param array $metadata Metadata array
     * @param int $writeassistdevid Activity ID
     * @param int $userid User ID
     */
    private function migrateMetadata($metadata, $writeassistdevid, $userid) {
        global $DB;
        
        $record = [
            'writeassistdevid' => $writeassistdevid,
            'userid' => $userid,
            'title' => $metadata['title'] ?? '',
            'description' => $metadata['description'] ?? '',
            'current_tab' => $metadata['current_tab'] ?? 'plan',
            'instructor_instructions' => $metadata['instructor_instructions'] ?? ''
        ];
        
        // Check if metadata already exists
        $existing = $DB->get_record('writeassistdev_metadata', [
            'writeassistdevid' => $writeassistdevid,
            'userid' => $userid
        ]);
        
        if ($existing) {
            $record['id'] = $existing->id;
            $DB->update_record('writeassistdev_metadata', $record);
        } else {
            $DB->insert_record('writeassistdev_metadata', $record);
        }
    }
    
    /**
     * Migrate ideas to normalized table
     * @param array $ideas Ideas array
     * @param int $writeassistdevid Activity ID
     * @param int $userid User ID
     */
    private function migrateIdeas($ideas, $writeassistdevid, $userid) {
        global $DB;
        
        // Clear existing ideas
        $DB->delete_records('writeassistdev_ideas', [
            'writeassistdevid' => $writeassistdevid,
            'userid' => $userid
        ]);
        
        foreach ($ideas as $idea) {
            $record = [
                'writeassistdevid' => $writeassistdevid,
                'userid' => $userid,
                'content' => $idea['content'],
                'location' => $idea['location'],
                'section_id' => $idea['section_id'],
                'ai_generated' => $idea['ai_generated'] ? 1 : 0
            ];
            
            $DB->insert_record('writeassistdev_ideas', $record);
        }
    }
    
    /**
     * Migrate content to normalized table
     * @param array $content Content array
     * @param int $writeassistdevid Activity ID
     * @param int $userid User ID
     */
    private function migrateContent($content, $writeassistdevid, $userid) {
        global $DB;
        
        foreach ($content as $phase => $data) {
            if (empty($data['content'])) {
                continue;
            }
            
            $record = [
                'writeassistdevid' => $writeassistdevid,
                'userid' => $userid,
                'phase' => $phase,
                'content' => $data['content'],
                'word_count' => $data['word_count'] ?? 0
            ];
            
            // Check if content already exists
            $existing = $DB->get_record('writeassistdev_content', [
                'writeassistdevid' => $writeassistdevid,
                'userid' => $userid,
                'phase' => $phase
            ]);
            
            if ($existing) {
                $record['id'] = $existing->id;
                $DB->update_record('writeassistdev_content', $record);
            } else {
                $DB->insert_record('writeassistdev_content', $record);
            }
        }
    }
    
    /**
     * Migrate chat history to normalized table
     * @param array $chat Chat array
     * @param int $writeassistdevid Activity ID
     * @param int $userid User ID
     */
    private function migrateChat($chat, $writeassistdevid, $userid) {
        global $DB;
        
        // Clear existing chat
        $DB->delete_records('writeassistdev_chat', [
            'writeassistdevid' => $writeassistdevid,
            'userid' => $userid
        ]);
        
        foreach ($chat as $message) {
            $record = [
                'writeassistdevid' => $writeassistdevid,
                'userid' => $userid,
                'role' => $message['role'],
                'content' => $message['content'],
                'timestamp' => $message['timestamp']
            ];
            
            $DB->insert_record('writeassistdev_chat', $record);
        }
    }
    
    /**
     * Rollback migration for a specific user and activity
     * @param int $writeassistdevid Activity ID
     * @param int $userid User ID
     * @return array Rollback result
     */
    public function rollback($writeassistdevid, $userid) {
        global $DB;
        
        try {
            $transaction = $DB->start_delegated_transaction();
            
            // Delete all migrated data
            $DB->delete_records('writeassistdev_metadata', [
                'writeassistdevid' => $writeassistdevid,
                'userid' => $userid
            ]);
            
            $DB->delete_records('writeassistdev_ideas', [
                'writeassistdevid' => $writeassistdevid,
                'userid' => $userid
            ]);
            
            $DB->delete_records('writeassistdev_content', [
                'writeassistdevid' => $writeassistdevid,
                'userid' => $userid
            ]);
            
            $DB->delete_records('writeassistdev_chat', [
                'writeassistdevid' => $writeassistdevid,
                'userid' => $userid
            ]);
            
            $transaction->allow_commit();
            
            return ['success' => true, 'message' => 'Rollback completed successfully'];
            
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}
