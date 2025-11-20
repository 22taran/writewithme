<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Project data parser for migration
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_writeassistdev\migration;

defined('MOODLE_INTERNAL') || die();

/**
 * Exception for invalid JSON data
 */
class InvalidJsonException extends \Exception {}

/**
 * Exception for data structure issues
 */
class DataStructureException extends \Exception {}

/**
 * Project data parser for migration from JSON blob to normalized schema
 */
class ProjectDataParser {
    
    /**
     * Parse JSON project data into normalized structure
     * @param array $jsonData The JSON data to parse
     * @return array Parsed data structure
     * @throws InvalidJsonException
     * @throws DataStructureException
     */
    public function parse($jsonData) {
        if (empty($jsonData)) {
            return $this->getEmptyStructure();
        }
        
        if (!is_array($jsonData)) {
            throw new InvalidJsonException('Invalid JSON data structure');
        }
        
        return [
            'metadata' => $this->parseMetadata($jsonData['metadata'] ?? []),
            'ideas' => $this->parseIdeas($jsonData['plan']['ideas'] ?? []),
            'outline' => $this->parseOutline($jsonData['plan']['outline'] ?? []),
            'content' => $this->parseContent($jsonData['write'] ?? [], $jsonData['edit'] ?? []),
            'chat' => $this->parseChat($jsonData['chatHistory'] ?? [])
        ];
    }
    
    /**
     * Parse metadata from JSON data
     * @param array $metadata Metadata array
     * @return array Parsed metadata
     */
    private function parseMetadata($metadata) {
        return [
            'title' => $this->sanitizeContent($metadata['title'] ?? ''),
            'description' => $this->sanitizeContent($metadata['description'] ?? ''),
            'current_tab' => $this->validateTab($metadata['currentTab'] ?? 'plan'),
            'instructor_instructions' => $this->sanitizeContent($metadata['instructorInstructions'] ?? '')
        ];
    }
    
    /**
     * Parse ideas from JSON data
     * @param array $ideas Ideas array
     * @return array Parsed ideas
     */
    private function parseIdeas($ideas) {
        $parsedIdeas = [];
        
        if (!is_array($ideas)) {
            return $parsedIdeas;
        }
        
        foreach ($ideas as $idea) {
            if (empty($idea['id']) || empty($idea['content'])) {
                continue; // Skip invalid ideas
            }
            
            $parsedIdeas[] = [
                'id' => $this->sanitizeContent($idea['id']),
                'content' => $this->sanitizeContent($idea['content']),
                'location' => $this->validateLocation($idea['location'] ?? 'brainstorm'),
                'section_id' => $idea['sectionId'] ?? null,
                'ai_generated' => (bool)($idea['aiGenerated'] ?? false)
            ];
        }
        
        return $parsedIdeas;
    }
    
    /**
     * Parse outline from JSON data
     * @param array $outline Outline array
     * @return array Parsed outline
     */
    private function parseOutline($outline) {
        $parsedOutline = [];
        
        if (!is_array($outline)) {
            return $parsedOutline;
        }
        
        foreach ($outline as $section) {
            if (empty($section['id'])) {
                continue; // Skip invalid sections
            }
            
            $parsedOutline[] = [
                'id' => $this->sanitizeContent($section['id']),
                'title' => $this->sanitizeContent($section['title'] ?? ''),
                'description' => $this->sanitizeContent($section['description'] ?? ''),
                'bubbles' => $section['bubbles'] ?? []
            ];
        }
        
        return $parsedOutline;
    }
    
    /**
     * Parse content from JSON data
     * @param array $writeData Write phase data
     * @param array $editData Edit phase data
     * @return array Parsed content
     */
    private function parseContent($writeData, $editData) {
        $content = [];
        
        if (!empty($writeData['content'])) {
            $content['write'] = [
                'content' => $writeData['content'],
                'word_count' => (int)($writeData['wordCount'] ?? 0)
            ];
        }
        
        if (!empty($editData['content'])) {
            $content['edit'] = [
                'content' => $editData['content'],
                'word_count' => (int)($editData['wordCount'] ?? 0)
            ];
        }
        
        return $content;
    }
    
    /**
     * Parse chat history from JSON data
     * @param array $chatHistory Chat history array
     * @return array Parsed chat history
     */
    private function parseChat($chatHistory) {
        $parsedChat = [];
        
        if (!is_array($chatHistory)) {
            return $parsedChat;
        }
        
        foreach ($chatHistory as $message) {
            if (empty($message['role']) || empty($message['content'])) {
                continue; // Skip invalid messages
            }
            
            $parsedChat[] = [
                'role' => $this->validateRole($message['role']),
                'content' => $this->sanitizeContent($message['content']),
                'timestamp' => $message['timestamp'] ?? date('Y-m-d H:i:s')
            ];
        }
        
        return $parsedChat;
    }
    
    /**
     * Sanitize content by removing HTML and limiting length
     * @param string $content Content to sanitize
     * @return string Sanitized content
     */
    private function sanitizeContent($content) {
        if (empty($content)) {
            return '';
        }
        
        // Remove HTML tags for text content
        $content = strip_tags($content);
        
        // Limit length
        if (strlen($content) > 1000) {
            $content = substr($content, 0, 1000);
        }
        
        return trim($content);
    }
    
    /**
     * Validate tab value
     * @param string $tab Tab value
     * @return string Valid tab value
     */
    private function validateTab($tab) {
        $validTabs = ['plan', 'write', 'edit'];
        return in_array($tab, $validTabs) ? $tab : 'plan';
    }
    
    /**
     * Validate location value
     * @param string $location Location value
     * @return string Valid location value
     */
    private function validateLocation($location) {
        $validLocations = ['brainstorm', 'outline'];
        return in_array($location, $validLocations) ? $location : 'brainstorm';
    }
    
    /**
     * Validate role value
     * @param string $role Role value
     * @return string Valid role value
     */
    private function validateRole($role) {
        $validRoles = ['user', 'assistant'];
        return in_array($role, $validRoles) ? $role : 'user';
    }
    
    /**
     * Get empty structure for new projects
     * @return array Empty project structure
     */
    private function getEmptyStructure() {
        return [
            'metadata' => [],
            'ideas' => [],
            'outline' => [],
            'content' => [],
            'chat' => []
        ];
    }
}
