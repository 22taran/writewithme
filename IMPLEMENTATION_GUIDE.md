# 🛠️ Implementation Guide - Database Migration

## 📋 **Overview**

This guide provides step-by-step instructions for implementing the database migration from JSON blob storage to normalized schema.

## 🏗️ **Phase 1: Schema Creation**

### **Step 1.1: Create Migration Scripts**

Create `writeassistdev/db/upgrade.php`:

```php
<?php
// Database upgrade script
function xmldb_writeassistdev_upgrade($oldversion) {
    global $DB;
    
    $dbman = $DB->get_manager();
    
    if ($oldversion < 2025012700) {
        // Create new normalized tables
        
        // Ideas table
        $table = new xmldb_table('writeassistdev_ideas');
        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('writeassistdevid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('content', XMLDB_TYPE_TEXT, null, null, XMLDB_NOTNULL, null, null);
        $table->add_field('location', XMLDB_TYPE_CHAR, '20', null, XMLDB_NOTNULL, null, null);
        $table->add_field('section_id', XMLDB_TYPE_CHAR, '50', null, null, null, null);
        $table->add_field('ai_generated', XMLDB_TYPE_INTEGER, '1', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('created_at', XMLDB_TYPE_TIMESTAMP, null, null, XMLDB_NOTNULL, null, 'CURRENT_TIMESTAMP');
        $table->add_field('modified_at', XMLDB_TYPE_TIMESTAMP, null, null, XMLDB_NOTNULL, null, 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
        
        $table->add_key('primary', XMLDB_KEY_PRIMARY, array('id'));
        $table->add_key('user_fk', XMLDB_KEY_FOREIGN, array('userid'), 'user', array('id'));
        $table->add_key('writeassistdev_fk', XMLDB_KEY_FOREIGN, array('writeassistdevid'), 'writeassistdev', array('id'));
        
        $table->add_index('idx_user_activity', XMLDB_INDEX_NOTUNIQUE, array('userid', 'writeassistdevid'));
        $table->add_index('idx_location', XMLDB_INDEX_NOTUNIQUE, array('location'));
        $table->add_index('idx_ai_generated', XMLDB_INDEX_NOTUNIQUE, array('ai_generated'));
        
        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }
        
        // Content table
        $table = new xmldb_table('writeassistdev_content');
        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('writeassistdevid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('phase', XMLDB_TYPE_CHAR, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('content', XMLDB_TYPE_TEXT, null, null, null, null, null);
        $table->add_field('word_count', XMLDB_TYPE_INTEGER, '10', null, null, null, '0');
        $table->add_field('created_at', XMLDB_TYPE_TIMESTAMP, null, null, XMLDB_NOTNULL, null, 'CURRENT_TIMESTAMP');
        $table->add_field('modified_at', XMLDB_TYPE_TIMESTAMP, null, null, XMLDB_NOTNULL, null, 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
        
        $table->add_key('primary', XMLDB_KEY_PRIMARY, array('id'));
        $table->add_key('user_fk', XMLDB_KEY_FOREIGN, array('userid'), 'user', array('id'));
        $table->add_key('writeassistdev_fk', XMLDB_KEY_FOREIGN, array('writeassistdevid'), 'writeassistdev', array('id'));
        $table->add_key('unique_user_phase', XMLDB_KEY_UNIQUE, array('writeassistdevid', 'userid', 'phase'));
        
        $table->add_index('idx_word_count', XMLDB_INDEX_NOTUNIQUE, array('word_count'));
        $table->add_index('idx_phase', XMLDB_INDEX_NOTUNIQUE, array('phase'));
        
        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }
        
        // Chat table
        $table = new xmldb_table('writeassistdev_chat');
        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('writeassistdevid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('role', XMLDB_TYPE_CHAR, '20', null, XMLDB_NOTNULL, null, null);
        $table->add_field('content', XMLDB_TYPE_TEXT, null, null, XMLDB_NOTNULL, null, null);
        $table->add_field('timestamp', XMLDB_TYPE_TIMESTAMP, null, null, XMLDB_NOTNULL, null, 'CURRENT_TIMESTAMP');
        
        $table->add_key('primary', XMLDB_KEY_PRIMARY, array('id'));
        $table->add_key('user_fk', XMLDB_KEY_FOREIGN, array('userid'), 'user', array('id'));
        $table->add_key('writeassistdev_fk', XMLDB_KEY_FOREIGN, array('writeassistdevid'), 'writeassistdev', array('id'));
        
        $table->add_index('idx_user_activity', XMLDB_INDEX_NOTUNIQUE, array('userid', 'writeassistdevid'));
        $table->add_index('idx_timestamp', XMLDB_INDEX_NOTUNIQUE, array('timestamp'));
        $table->add_index('idx_role', XMLDB_INDEX_NOTUNIQUE, array('role'));
        
        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }
        
        // Metadata table
        $table = new xmldb_table('writeassistdev_metadata');
        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('writeassistdevid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('title', XMLDB_TYPE_CHAR, '255', null, null, null, null);
        $table->add_field('description', XMLDB_TYPE_TEXT, null, null, null, null, null);
        $table->add_field('current_tab', XMLDB_TYPE_CHAR, '20', null, null, null, 'plan');
        $table->add_field('instructor_instructions', XMLDB_TYPE_TEXT, null, null, null, null, null);
        $table->add_field('created_at', XMLDB_TYPE_TIMESTAMP, null, null, XMLDB_NOTNULL, null, 'CURRENT_TIMESTAMP');
        $table->add_field('modified_at', XMLDB_TYPE_TIMESTAMP, null, null, XMLDB_NOTNULL, null, 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
        
        $table->add_key('primary', XMLDB_KEY_PRIMARY, array('id'));
        $table->add_key('user_fk', XMLDB_KEY_FOREIGN, array('userid'), 'user', array('id'));
        $table->add_key('writeassistdev_fk', XMLDB_KEY_FOREIGN, array('writeassistdevid'), 'writeassistdev', array('id'));
        $table->add_key('unique_user_activity', XMLDB_KEY_UNIQUE, array('writeassistdevid', 'userid'));
        
        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }
    }
    
    return true;
}
```

### **Step 1.2: Update Version File**

Update `writeassistdev/version.php`:

```php
<?php
defined('MOODLE_INTERNAL') || die();

$plugin->version   = 2025012700; // YYYYMMDDXX
$plugin->requires  = 2022112800; // Moodle 4.1
$plugin->component = 'mod_writeassistdev';
$plugin->maturity  = MATURITY_STABLE;
$plugin->release  = '1.0.0';
```

## 🔄 **Phase 2: Data Migration Scripts**

### **Step 2.1: Create Data Parser**

Create `writeassistdev/classes/migration/ProjectDataParser.php`:

```php
<?php
namespace mod_writeassistdev\migration;

class ProjectDataParser {
    
    /**
     * Parse JSON project data into normalized structure
     */
    public function parse($jsonData) {
        if (empty($jsonData)) {
            return $this->getEmptyStructure();
        }
        
        return [
            'metadata' => $this->parseMetadata($jsonData['metadata'] ?? []),
            'ideas' => $this->parseIdeas($jsonData['plan']['ideas'] ?? []),
            'outline' => $this->parseOutline($jsonData['plan']['outline'] ?? []),
            'content' => $this->parseContent($jsonData['write'] ?? [], $jsonData['edit'] ?? []),
            'chat' => $this->parseChat($jsonData['chatHistory'] ?? [])
        ];
    }
    
    private function parseMetadata($metadata) {
        return [
            'title' => $metadata['title'] ?? '',
            'description' => $metadata['description'] ?? '',
            'current_tab' => $metadata['currentTab'] ?? 'plan',
            'instructor_instructions' => $metadata['instructorInstructions'] ?? ''
        ];
    }
    
    private function parseIdeas($ideas) {
        $parsedIdeas = [];
        
        foreach ($ideas as $idea) {
            if (empty($idea['id']) || empty($idea['content'])) {
                continue; // Skip invalid ideas
            }
            
            $parsedIdeas[] = [
                'id' => $idea['id'],
                'content' => $this->sanitizeContent($idea['content']),
                'location' => $idea['location'] ?? 'brainstorm',
                'section_id' => $idea['sectionId'] ?? null,
                'ai_generated' => $idea['aiGenerated'] ?? false
            ];
        }
        
        return $parsedIdeas;
    }
    
    private function parseOutline($outline) {
        $parsedOutline = [];
        
        foreach ($outline as $section) {
            if (empty($section['id'])) {
                continue; // Skip invalid sections
            }
            
            $parsedOutline[] = [
                'id' => $section['id'],
                'title' => $this->sanitizeContent($section['title'] ?? ''),
                'description' => $this->sanitizeContent($section['description'] ?? ''),
                'bubbles' => $section['bubbles'] ?? []
            ];
        }
        
        return $parsedOutline;
    }
    
    private function parseContent($writeData, $editData) {
        $content = [];
        
        if (!empty($writeData['content'])) {
            $content['write'] = [
                'content' => $writeData['content'],
                'word_count' => $writeData['wordCount'] ?? 0
            ];
        }
        
        if (!empty($editData['content'])) {
            $content['edit'] = [
                'content' => $editData['content'],
                'word_count' => $editData['wordCount'] ?? 0
            ];
        }
        
        return $content;
    }
    
    private function parseChat($chatHistory) {
        $parsedChat = [];
        
        foreach ($chatHistory as $message) {
            if (empty($message['role']) || empty($message['content'])) {
                continue; // Skip invalid messages
            }
            
            $parsedChat[] = [
                'role' => $message['role'],
                'content' => $this->sanitizeContent($message['content']),
                'timestamp' => $message['timestamp'] ?? date('Y-m-d H:i:s')
            ];
        }
        
        return $parsedChat;
    }
    
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
```

### **Step 2.2: Create Data Migrator**

Create `writeassistdev/classes/migration/DataMigrator.php`:

```php
<?php
namespace mod_writeassistdev\migration;

class DataMigrator {
    
    private $parser;
    
    public function __construct() {
        $this->parser = new ProjectDataParser();
    }
    
    /**
     * Migrate all data for a specific user and activity
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
                
            } catch (Exception $e) {
                $transaction->rollback($e);
                throw $e;
            }
            
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    
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
}
```

## 🔄 **Phase 3: Application Layer Updates**

### **Step 3.1: Create New Data Access Layer**

Create `writeassistdev/classes/data/ProjectDataManager.php`:

```php
<?php
namespace mod_writeassistdev\data;

class ProjectDataManager {
    
    /**
     * Load project data from normalized tables
     */
    public function loadProject($writeassistdevid, $userid) {
        global $DB;
        
        // Load metadata
        $metadata = $DB->get_record('writeassistdev_metadata', [
            'writeassistdevid' => $writeassistdevid,
            'userid' => $userid
        ]);
        
        // Load ideas
        $ideas = $DB->get_records('writeassistdev_ideas', [
            'writeassistdevid' => $writeassistdevid,
            'userid' => $userid
        ], 'id ASC');
        
        // Load content
        $content = $DB->get_records('writeassistdev_content', [
            'writeassistdevid' => $writeassistdevid,
            'userid' => $userid
        ]);
        
        // Load chat
        $chat = $DB->get_records('writeassistdev_chat', [
            'writeassistdevid' => $writeassistdevid,
            'userid' => $userid
        ], 'timestamp ASC');
        
        // Reconstruct project structure
        return $this->reconstructProject($metadata, $ideas, $content, $chat);
    }
    
    /**
     * Save project data to normalized tables
     */
    public function saveProject($writeassistdevid, $userid, $projectData) {
        global $DB;
        
        $transaction = $DB->start_delegated_transaction();
        
        try {
            // Save metadata
            $this->saveMetadata($writeassistdevid, $userid, $projectData['metadata'] ?? []);
            
            // Save ideas
            $this->saveIdeas($writeassistdevid, $userid, $projectData['plan']['ideas'] ?? []);
            
            // Save content
            $this->saveContent($writeassistdevid, $userid, $projectData['write'] ?? [], 'write');
            $this->saveContent($writeassistdevid, $userid, $projectData['edit'] ?? [], 'edit');
            
            // Save chat
            $this->saveChat($writeassistdevid, $userid, $projectData['chatHistory'] ?? []);
            
            $transaction->allow_commit();
            return true;
            
        } catch (Exception $e) {
            $transaction->rollback($e);
            return false;
        }
    }
    
    private function reconstructProject($metadata, $ideas, $content, $chat) {
        // Convert database records back to JSON structure
        $project = [
            'metadata' => [
                'title' => $metadata->title ?? '',
                'description' => $metadata->description ?? '',
                'currentTab' => $metadata->current_tab ?? 'plan',
                'instructorInstructions' => $metadata->instructor_instructions ?? '',
                'created' => $metadata->created_at ?? date('c'),
                'modified' => $metadata->modified_at ?? date('c')
            ],
            'plan' => [
                'ideas' => array_map(function($idea) {
                    return [
                        'id' => $idea->id,
                        'content' => $idea->content,
                        'location' => $idea->location,
                        'sectionId' => $idea->section_id,
                        'aiGenerated' => (bool)$idea->ai_generated
                    ];
                }, $ideas),
                'outline' => [] // TODO: Implement outline reconstruction
            ],
            'write' => $this->getContentByPhase($content, 'write'),
            'edit' => $this->getContentByPhase($content, 'edit'),
            'chatHistory' => array_map(function($message) {
                return [
                    'role' => $message->role,
                    'content' => $message->content,
                    'timestamp' => $message->timestamp
                ];
            }, $chat)
        ];
        
        return $project;
    }
    
    private function getContentByPhase($content, $phase) {
        foreach ($content as $record) {
            if ($record->phase === $phase) {
                return [
                    'content' => $record->content,
                    'wordCount' => $record->word_count
                ];
            }
        }
        return ['content' => '', 'wordCount' => 0];
    }
    
    private function saveMetadata($writeassistdevid, $userid, $metadata) {
        global $DB;
        
        $record = [
            'writeassistdevid' => $writeassistdevid,
            'userid' => $userid,
            'title' => $metadata['title'] ?? '',
            'description' => $metadata['description'] ?? '',
            'current_tab' => $metadata['currentTab'] ?? 'plan',
            'instructor_instructions' => $metadata['instructorInstructions'] ?? ''
        ];
        
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
    
    private function saveIdeas($writeassistdevid, $userid, $ideas) {
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
                'section_id' => $idea['sectionId'] ?? null,
                'ai_generated' => $idea['aiGenerated'] ? 1 : 0
            ];
            
            $DB->insert_record('writeassistdev_ideas', $record);
        }
    }
    
    private function saveContent($writeassistdevid, $userid, $content, $phase) {
        global $DB;
        
        if (empty($content['content'])) {
            return;
        }
        
        $record = [
            'writeassistdevid' => $writeassistdevid,
            'userid' => $userid,
            'phase' => $phase,
            'content' => $content['content'],
            'word_count' => $content['wordCount'] ?? 0
        ];
        
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
    
    private function saveChat($writeassistdevid, $userid, $chatHistory) {
        global $DB;
        
        // Clear existing chat
        $DB->delete_records('writeassistdev_chat', [
            'writeassistdevid' => $writeassistdevid,
            'userid' => $userid
        ]);
        
        foreach ($chatHistory as $message) {
            $record = [
                'writeassistdevid' => $writeassistdevid,
                'userid' => $userid,
                'role' => $message['role'],
                'content' => $message['content'],
                'timestamp' => $message['timestamp'] ?? date('Y-m-d H:i:s')
            ];
            
            $DB->insert_record('writeassistdev_chat', $record);
        }
    }
}
```

### **Step 3.2: Update Existing Functions**

Update `writeassistdev/lib.php`:

```php
<?php
// Add new functions for normalized data access

/**
 * Load project data using new normalized schema
 */
function writeassistdev_load_project_normalized($writeassistdevid, $userid) {
    $dataManager = new \mod_writeassistdev\data\ProjectDataManager();
    return $dataManager->loadProject($writeassistdevid, $userid);
}

/**
 * Save project data using new normalized schema
 */
function writeassistdev_save_project_normalized($writeassistdevid, $userid, $projectdata) {
    $dataManager = new \mod_writeassistdev\data\ProjectDataManager();
    return $dataManager->saveProject($writeassistdevid, $userid, $projectdata);
}

/**
 * Check if project has been migrated to normalized schema
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
 */
function writeassistdev_migrate_project($writeassistdevid, $userid) {
    $migrator = new \mod_writeassistdev\migration\DataMigrator();
    return $migrator->migrate($writeassistdevid, $userid);
}
```

### **Step 3.3: Update AJAX Handler**

Update `writeassistdev/ajax.php`:

```php
<?php
// Add new actions for normalized data access

try {
    switch ($action) {
        case 'save_project':
            $projectdata = required_param('project_data', PARAM_RAW);
            
            // Check if project has been migrated
            if (writeassistdev_is_migrated($writeassistdev->id, $USER->id)) {
                // Use normalized schema
                $success = writeassistdev_save_project_normalized($writeassistdev->id, $USER->id, json_decode($projectdata, true));
            } else {
                // Use old JSON blob method
                $success = writeassistdev_save_project($writeassistdev->id, $USER->id, $projectdata);
            }
            
            echo json_encode(['success' => $success]);
            break;
            
        case 'load_project':
            // Check if project has been migrated
            if (writeassistdev_is_migrated($writeassistdev->id, $USER->id)) {
                // Use normalized schema
                $projectdata = writeassistdev_load_project_normalized($writeassistdev->id, $USER->id);
            } else {
                // Use old JSON blob method
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
            
        case 'migrate_project':
            $result = writeassistdev_migrate_project($writeassistdev->id, $USER->id);
            echo json_encode($result);
            break;
            
        // ... existing cases
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
```

## 🚀 **Phase 4: Migration Execution**

### **Step 4.1: Create Migration CLI Script**

Create `writeassistdev/cli/migrate_data.php`:

```php
<?php
// CLI script for data migration
define('CLI_SCRIPT', true);

require_once(__DIR__ . '/../../config.php');
require_once($CFG->libdir . '/clilib.php');

use mod_writeassistdev\migration\DataMigrator;

$usage = "Usage: php migrate_data.php [options]\n";
$usage .= "Options:\n";
$usage .= "  --dry-run    Show what would be migrated without actually doing it\n";
$usage .= "  --batch-size=N    Process N records at a time (default: 100)\n";
$usage .= "  --user-id=N    Migrate only specific user\n";
$usage .= "  --activity-id=N    Migrate only specific activity\n";

list($options, $unrecognized) = cli_get_params([
    'dry-run' => false,
    'batch-size' => 100,
    'user-id' => null,
    'activity-id' => null,
    'help' => false
], [
    'h' => 'help'
]);

if ($options['help']) {
    echo $usage;
    exit(0);
}

$migrator = new DataMigrator();
$dryRun = $options['dry-run'];
$batchSize = (int)$options['batch-size'];

echo "Starting data migration...\n";
echo "Dry run: " . ($dryRun ? 'YES' : 'NO') . "\n";
echo "Batch size: $batchSize\n\n";

// Get records to migrate
$where = [];
$params = [];

if ($options['user-id']) {
    $where[] = 'userid = ?';
    $params[] = $options['user-id'];
}

if ($options['activity-id']) {
    $where[] = 'writeassistdevid = ?';
    $params[] = $options['activity-id'];
}

$whereClause = empty($where) ? '' : 'WHERE ' . implode(' AND ', $where);
$sql = "SELECT * FROM {writeassistdev_work} $whereClause ORDER BY id";
$records = $DB->get_records_sql($sql, $params);

echo "Found " . count($records) . " records to migrate\n\n";

$successCount = 0;
$errorCount = 0;
$errors = [];

foreach (array_chunk($records, $batchSize) as $batch) {
    echo "Processing batch of " . count($batch) . " records...\n";
    
    foreach ($batch as $record) {
        if ($dryRun) {
            echo "Would migrate: User {$record->userid}, Activity {$record->writeassistdevid}\n";
            $successCount++;
        } else {
            $result = $migrator->migrate($record->writeassistdevid, $record->userid);
            
            if ($result['success']) {
                $successCount++;
                echo "✓ Migrated: User {$record->userid}, Activity {$record->writeassistdevid}\n";
            } else {
                $errorCount++;
                $errors[] = "User {$record->userid}, Activity {$record->writeassistdevid}: {$result['message']}";
                echo "✗ Failed: User {$record->userid}, Activity {$record->writeassistdevid}\n";
            }
        }
    }
    
    echo "Batch complete. Success: $successCount, Errors: $errorCount\n\n";
}

echo "Migration complete!\n";
echo "Total records processed: " . ($successCount + $errorCount) . "\n";
echo "Successful migrations: $successCount\n";
echo "Failed migrations: $errorCount\n";

if (!empty($errors)) {
    echo "\nErrors:\n";
    foreach ($errors as $error) {
        echo "- $error\n";
    }
}
```

### **Step 4.2: Create Migration Status Checker**

Create `writeassistdev/cli/check_migration_status.php`:

```php
<?php
// CLI script to check migration status
define('CLI_SCRIPT', true);

require_once(__DIR__ . '/../../config.php');
require_once($CFG->libdir . '/clilib.php');

echo "Migration Status Report\n";
echo "======================\n\n";

// Count total records in old format
$oldRecords = $DB->count_records('writeassistdev_work');
echo "Records in old format (JSON blob): $oldRecords\n";

// Count records in new format
$newMetadata = $DB->count_records('writeassistdev_metadata');
$newIdeas = $DB->count_records('writeassistdev_ideas');
$newContent = $DB->count_records('writeassistdev_content');
$newChat = $DB->count_records('writeassistdev_chat');

echo "Records in new format:\n";
echo "  Metadata: $newMetadata\n";
echo "  Ideas: $newIdeas\n";
echo "  Content: $newContent\n";
echo "  Chat: $newChat\n\n";

// Check for data integrity
echo "Data Integrity Checks:\n";

// Check for orphaned records
$orphanedIdeas = $DB->count_records_sql("
    SELECT COUNT(*) FROM {writeassistdev_ideas} i 
    LEFT JOIN {writeassistdev} w ON i.writeassistdevid = w.id 
    WHERE w.id IS NULL
");
echo "  Orphaned ideas: $orphanedIdeas\n";

$orphanedContent = $DB->count_records_sql("
    SELECT COUNT(*) FROM {writeassistdev_content} c 
    LEFT JOIN {writeassistdev} w ON c.writeassistdevid = w.id 
    WHERE w.id IS NULL
");
echo "  Orphaned content: $orphanedContent\n";

// Check for missing data
$missingMetadata = $DB->count_records_sql("
    SELECT COUNT(*) FROM {writeassistdev_work} w 
    LEFT JOIN {writeassistdev_metadata} m ON w.writeassistdevid = m.writeassistdevid AND w.userid = m.userid 
    WHERE m.id IS NULL
");
echo "  Missing metadata: $missingMetadata\n";

echo "\nMigration Status: ";
if ($missingMetadata == 0 && $orphanedIdeas == 0 && $orphanedContent == 0) {
    echo "✓ COMPLETE\n";
} else {
    echo "⚠ INCOMPLETE\n";
}
```

## 🧪 **Phase 5: Testing**

### **Step 5.1: Run Unit Tests**

```bash
# Run PHPUnit tests
cd /path/to/moodle
vendor/bin/phpunit mod_writeassistdev/tests/migration_test.php

# Run specific test
vendor/bin/phpunit --filter testMigrateIdeas mod_writeassistdev/tests/migration_test.php
```

### **Step 5.2: Run Integration Tests**

```bash
# Run full integration test
php writeassistdev/cli/migrate_data.php --dry-run

# Test with small batch
php writeassistdev/cli/migrate_data.php --batch-size=10 --user-id=123
```

### **Step 5.3: Performance Testing**

```bash
# Test migration performance
time php writeassistdev/cli/migrate_data.php --batch-size=100

# Check migration status
php writeassistdev/cli/check_migration_status.php
```

## 🚀 **Phase 6: Production Deployment**

### **Step 6.1: Pre-deployment Checklist**

- [ ] All tests passing
- [ ] Migration scripts tested on staging
- [ ] Backup procedures verified
- [ ] Rollback procedures tested
- [ ] Performance benchmarks met
- [ ] Documentation updated

### **Step 6.2: Deployment Steps**

1. **Deploy new code** (with backward compatibility)
2. **Run database upgrade** (`php admin/cli/upgrade.php`)
3. **Execute migration** (`php writeassistdev/cli/migrate_data.php`)
4. **Verify migration** (`php writeassistdev/cli/check_migration_status.php`)
5. **Monitor system** for 24 hours
6. **Remove old code** after successful migration

### **Step 6.3: Post-deployment Monitoring**

- Monitor query performance
- Check for data integrity issues
- Verify user functionality
- Monitor system resources
- Collect user feedback

---

**Implementation Guide Version**: 1.0  
**Last Updated**: 2025-01-27  
**Next Review**: 2025-02-03
