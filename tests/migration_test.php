<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Unit tests for migration functionality
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

use mod_writeassistdev\migration\ProjectDataParser;
use mod_writeassistdev\migration\DataMigrator;
use mod_writeassistdev\data\ProjectDataManager;

/**
 * Test cases for migration functionality
 */
class mod_writeassistdev_migration_testcase extends advanced_testcase {
    
    /**
     * Test JSON data parsing
     */
    public function test_parse_valid_project_data() {
        $parser = new ProjectDataParser();
        
        $jsonData = [
            'metadata' => [
                'title' => 'Test Project',
                'currentTab' => 'write'
            ],
            'plan' => [
                'ideas' => [
                    [
                        'id' => 'idea_1',
                        'content' => 'Main argument',
                        'location' => 'brainstorm',
                        'aiGenerated' => false
                    ]
                ]
            ],
            'write' => [
                'content' => '<p>Written content</p>',
                'wordCount' => 10
            ],
            'chatHistory' => [
                [
                    'role' => 'user',
                    'content' => 'Hello',
                    'timestamp' => '2025-01-27T10:30:00.000Z'
                ]
            ]
        ];
        
        $result = $parser->parse($jsonData);
        
        $this->assertIsArray($result);
        $this->assertArrayHasKey('metadata', $result);
        $this->assertArrayHasKey('ideas', $result);
        $this->assertArrayHasKey('content', $result);
        $this->assertArrayHasKey('chat', $result);
        
        $this->assertCount(1, $result['ideas']);
        $this->assertEquals('Main argument', $result['ideas'][0]['content']);
        $this->assertFalse($result['ideas'][0]['ai_generated']);
    }
    
    /**
     * Test data migration
     */
    public function test_migrate_project_data() {
        global $DB;
        
        $this->resetAfterTest();
        
        // Create test data
        $course = $this->getDataGenerator()->create_course();
        $user = $this->getDataGenerator()->create_user();
        $activity = $this->getDataGenerator()->create_module('writeassistdev', [
            'course' => $course->id,
            'name' => 'Test Activity'
        ]);
        
        // Create JSON blob data
        $jsonData = json_encode([
            'metadata' => [
                'title' => 'Test Project',
                'currentTab' => 'write'
            ],
            'plan' => [
                'ideas' => [
                    [
                        'id' => 'idea_1',
                        'content' => 'Test idea',
                        'location' => 'brainstorm',
                        'aiGenerated' => false
                    ]
                ]
            ],
            'write' => [
                'content' => '<p>Test content</p>',
                'wordCount' => 5
            ],
            'chatHistory' => [
                [
                    'role' => 'user',
                    'content' => 'Test message',
                    'timestamp' => '2025-01-27T10:30:00.000Z'
                ]
            ]
        ]);
        
        // Insert test data
        $DB->insert_record('writeassistdev_work', [
            'writeassistdevid' => $activity->id,
            'userid' => $user->id,
            'content' => $jsonData,
            'timecreated' => time(),
            'timemodified' => time()
        ]);
        
        // Test migration
        $migrator = new DataMigrator();
        $result = $migrator->migrate($activity->id, $user->id);
        
        $this->assertTrue($result['success']);
        $this->assertEquals(1, $result['ideas_migrated']);
        $this->assertEquals(1, $result['chat_messages_migrated']);
        $this->assertEquals(1, $result['content_records_migrated']);
        
        // Verify data was migrated
        $this->assertTrue(writeassistdev_is_migrated($activity->id, $user->id));
        
        // Verify ideas were migrated
        $ideas = $DB->get_records('writeassistdev_ideas', [
            'writeassistdevid' => $activity->id,
            'userid' => $user->id
        ]);
        $this->assertCount(1, $ideas);
        
        $idea = reset($ideas);
        $this->assertEquals('Test idea', $idea->content);
        $this->assertEquals('brainstorm', $idea->location);
        $this->assertEquals(0, $idea->ai_generated);
        
        // Verify content was migrated
        $content = $DB->get_record('writeassistdev_content', [
            'writeassistdevid' => $activity->id,
            'userid' => $user->id,
            'phase' => 'write'
        ]);
        $this->assertNotFalse($content);
        $this->assertEquals('<p>Test content</p>', $content->content);
        $this->assertEquals(5, $content->word_count);
        
        // Verify chat was migrated
        $chat = $DB->get_records('writeassistdev_chat', [
            'writeassistdevid' => $activity->id,
            'userid' => $user->id
        ]);
        $this->assertCount(1, $chat);
        
        $message = reset($chat);
        $this->assertEquals('user', $message->role);
        $this->assertEquals('Test message', $message->content);
    }
    
    /**
     * Test data loading from normalized schema
     */
    public function test_load_project_from_normalized() {
        global $DB;
        
        $this->resetAfterTest();
        
        // Create test data
        $course = $this->getDataGenerator()->create_course();
        $user = $this->getDataGenerator()->create_user();
        $activity = $this->getDataGenerator()->create_module('writeassistdev', [
            'course' => $course->id,
            'name' => 'Test Activity'
        ]);
        
        // Insert normalized data
        $DB->insert_record('writeassistdev_metadata', [
            'writeassistdevid' => $activity->id,
            'userid' => $user->id,
            'title' => 'Test Project',
            'current_tab' => 'write'
        ]);
        
        $DB->insert_record('writeassistdev_ideas', [
            'writeassistdevid' => $activity->id,
            'userid' => $user->id,
            'content' => 'Test idea',
            'location' => 'brainstorm',
            'ai_generated' => 0
        ]);
        
        $DB->insert_record('writeassistdev_content', [
            'writeassistdevid' => $activity->id,
            'userid' => $user->id,
            'phase' => 'write',
            'content' => '<p>Test content</p>',
            'word_count' => 5
        ]);
        
        // Test loading
        $dataManager = new ProjectDataManager();
        $project = $dataManager->loadProject($activity->id, $user->id);
        
        $this->assertNotFalse($project);
        $this->assertEquals('Test Project', $project['metadata']['title']);
        $this->assertEquals('write', $project['metadata']['currentTab']);
        $this->assertCount(1, $project['plan']['ideas']);
        $this->assertEquals('Test idea', $project['plan']['ideas'][0]['content']);
        $this->assertEquals('<p>Test content</p>', $project['write']['content']);
    }
    
    /**
     * Test data saving to normalized schema
     */
    public function test_save_project_to_normalized() {
        global $DB;
        
        $this->resetAfterTest();
        
        // Create test data
        $course = $this->getDataGenerator()->create_course();
        $user = $this->getDataGenerator()->create_user();
        $activity = $this->getDataGenerator()->create_module('writeassistdev', [
            'course' => $course->id,
            'name' => 'Test Activity'
        ]);
        
        $projectData = [
            'metadata' => [
                'title' => 'Test Project',
                'currentTab' => 'write'
            ],
            'plan' => [
                'ideas' => [
                    [
                        'id' => 'idea_1',
                        'content' => 'New idea',
                        'location' => 'brainstorm',
                        'aiGenerated' => false
                    ]
                ]
            ],
            'write' => [
                'content' => '<p>New content</p>',
                'wordCount' => 10
            ],
            'chatHistory' => [
                [
                    'role' => 'user',
                    'content' => 'New message',
                    'timestamp' => '2025-01-27T10:30:00.000Z'
                ]
            ]
        ];
        
        // Test saving
        $dataManager = new ProjectDataManager();
        $result = $dataManager->saveProject($activity->id, $user->id, $projectData);
        
        $this->assertTrue($result);
        
        // Verify data was saved
        $metadata = $DB->get_record('writeassistdev_metadata', [
            'writeassistdevid' => $activity->id,
            'userid' => $user->id
        ]);
        $this->assertNotFalse($metadata);
        $this->assertEquals('Test Project', $metadata->title);
        
        $ideas = $DB->get_records('writeassistdev_ideas', [
            'writeassistdevid' => $activity->id,
            'userid' => $user->id
        ]);
        $this->assertCount(1, $ideas);
        
        $content = $DB->get_record('writeassistdev_content', [
            'writeassistdevid' => $activity->id,
            'userid' => $user->id,
            'phase' => 'write'
        ]);
        $this->assertNotFalse($content);
        $this->assertEquals('<p>New content</p>', $content->content);
    }
    
    /**
     * Test migration status
     */
    public function test_migration_status() {
        global $DB;
        
        $this->resetAfterTest();
        
        // Create test data
        $course = $this->getDataGenerator()->create_course();
        $user = $this->getDataGenerator()->create_user();
        $activity = $this->getDataGenerator()->create_module('writeassistdev', [
            'course' => $course->id,
            'name' => 'Test Activity'
        ]);
        
        // Create old format data
        $DB->insert_record('writeassistdev_work', [
            'writeassistdevid' => $activity->id,
            'userid' => $user->id,
            'content' => '{"test": "data"}',
            'timecreated' => time(),
            'timemodified' => time()
        ]);
        
        // Test migration status
        $status = writeassistdev_get_migration_status();
        
        $this->assertEquals(1, $status['old_records']);
        $this->assertEquals(0, $status['new_metadata']);
        $this->assertFalse($status['is_complete']);
    }
}
