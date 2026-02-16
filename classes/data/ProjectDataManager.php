<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Project data manager for normalized schema
 * @package    mod_researchflow
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_researchflow\data;

defined('MOODLE_INTERNAL') || die();

/**
 * Project data manager for handling normalized database operations
 */
class ProjectDataManager {
    
    /**
     * Load project data from normalized tables
     * @param int $researchflowid Activity ID
     * @param int $userid User ID
     * @return array|false Project data or false if not found
     */
    public function loadProject($researchflowid, $userid) {
        global $DB;
        
        try {
            // Load metadata
            $metadata = $DB->get_record('researchflow_metadata', [
                'researchflowid' => $researchflowid,
                'userid' => $userid
            ]);
            
            // If metadata doesn't exist, create a default object
            if (!$metadata) {
                $metadata = new \stdClass();
                $metadata->title = '';
                $metadata->description = '';
                $metadata->current_tab = 'plan';
                $metadata->instructor_instructions = '';
                $metadata->goal = '';
                $metadata->created_at = time();
                $metadata->modified_at = time();
            } else {
                // Ensure goal is always a string, never null
                if (!isset($metadata->goal) || $metadata->goal === null) {
                    $metadata->goal = '';
                }
            }
            
            // Load ideas
            $ideas = $DB->get_records('researchflow_ideas', [
                'researchflowid' => $researchflowid,
                'userid' => $userid
            ], 'id ASC');
            
            // Load content
            $content = $DB->get_records('researchflow_content', [
                'researchflowid' => $researchflowid,
                'userid' => $userid
            ]);
            
            // Load chat
            $chat = $DB->get_records('researchflow_chat', [
                'researchflowid' => $researchflowid,
                'userid' => $userid
            ], 'timestamp ASC');
            
            // Reconstruct project structure
            return $this->reconstructProject($metadata, $ideas, $content, $chat);
            
        } catch (\Exception $e) {
            return false;
        }
    }
    
    /**
     * Save project data to normalized tables
     * @param int $researchflowid Activity ID
     * @param int $userid User ID
     * @param array $projectData Project data to save
     * @return bool Success status
     */
    public function saveProject($researchflowid, $userid, $projectData) {
        global $DB;
        
        try {
            error_log('ProjectDataManager::saveProject called with data: ' . json_encode($projectData));
            
            // Check if project is already submitted
            $metadata = $DB->get_record('researchflow_metadata', [
                'researchflowid' => $researchflowid,
                'userid' => $userid
            ]);
            
            if ($metadata && isset($metadata->status) && $metadata->status === 'submitted') {
                error_log('ProjectDataManager::saveProject - BLOCKED: Project is submitted');
                return false;
            }
            
            // Check if normalized tables exist (with proper prefix)
            $dbman = $DB->get_manager();
            $tableExists = $dbman->table_exists('researchflow_metadata');
            error_log('Checking table researchflow_metadata: ' . ($tableExists ? 'EXISTS' : 'NOT EXISTS'));
            
            // Debug: List all tables to see what exists
            $allTables = $DB->get_tables();
            $writeassistTables = array_filter($allTables, function($table) {
                return strpos($table, 'researchflow') !== false;
            });
            error_log('All researchflow tables: ' . implode(', ', $writeassistTables));
            
            // Also check if we can actually query the metadata table
            try {
                $testQuery = $DB->get_record('researchflow_metadata', ['researchflowid' => $researchflowid, 'userid' => $userid]);
                error_log('Test query on metadata table: SUCCESS');
            } catch (Exception $e) {
                error_log('Test query on metadata table FAILED: ' . $e->getMessage());
            }
            
            if (!$tableExists) {
                error_log('Normalized tables do not exist, falling back to old method');
                return false;
            }
            
            $transaction = $DB->start_delegated_transaction();
            
            error_log('Starting save process for user ' . $userid . ' activity ' . $researchflowid);
            
            // Verify foreign key references exist
            $activityExists = $DB->record_exists('researchflow', ['id' => $researchflowid]);
            $userExists = $DB->record_exists('user', ['id' => $userid]);
            error_log('Activity exists: ' . ($activityExists ? 'YES' : 'NO') . ' (ID: ' . $researchflowid . ')');
            error_log('User exists: ' . ($userExists ? 'YES' : 'NO') . ' (ID: ' . $userid . ')');
            
            if (!$activityExists) {
                // Let's see what activities do exist
                $allActivities = $DB->get_records('researchflow', null, '', 'id,name');
                error_log('Available activities: ' . json_encode($allActivities));
                throw new \Exception('Activity ' . $researchflowid . ' does not exist');
            }
            if (!$userExists) {
                throw new \Exception('User ' . $userid . ' does not exist');
            }
            
            // Save metadata (including plan outline structure)
            error_log('Saving metadata...');
            $metadata = $projectData['metadata'] ?? [];
            // Include plan outline data in metadata
            if (isset($projectData['plan'])) {
                $planOutline = [
                    'outline' => $projectData['plan']['outline'] ?? [],
                    'customSectionTitles' => $projectData['plan']['customSectionTitles'] ?? [],
                    'customSections' => $projectData['plan']['customSections'] ?? [],
                    'removedSections' => $projectData['plan']['removedSections'] ?? [],
                    'sectionOrder' => $projectData['plan']['sectionOrder'] ?? [] // Save section order
                ];
                $metadata['planOutline'] = $planOutline;
                error_log('ProjectDataManager::saveProject - plan outline structure: ' . json_encode($planOutline));
                error_log('ProjectDataManager::saveProject - outline count: ' . count($planOutline['outline']));
                error_log('ProjectDataManager::saveProject - customSections count: ' . count($planOutline['customSections']));
                error_log('ProjectDataManager::saveProject - customSectionTitles count: ' . count($planOutline['customSectionTitles']));
                error_log('ProjectDataManager::saveProject - sectionOrder: ' . json_encode($planOutline['sectionOrder']));
            } else {
                error_log('ProjectDataManager::saveProject - plan data NOT in projectData');
            }
            $this->saveMetadata($researchflowid, $userid, $metadata);
            
            // Save ideas
            error_log('Saving ideas...');
            $ideaMappings = $this->saveIdeas($researchflowid, $userid, $projectData['plan']['ideas'] ?? []);
            
            // Save content
            error_log('Saving content...');
            error_log('Write data: ' . json_encode($projectData['write'] ?? []));
            error_log('Edit data: ' . json_encode($projectData['edit'] ?? []));
            $this->saveContent($researchflowid, $userid, $projectData['write'] ?? [], 'write');
            $this->saveContent($researchflowid, $userid, $projectData['edit'] ?? [], 'edit');
            
            // Save chat
            error_log('Saving chat...');
            error_log('Chat history data: ' . json_encode($projectData['chatHistory'] ?? []));
            $this->saveChat($researchflowid, $userid, $projectData['chatHistory'] ?? []);
            
            error_log('Committing transaction...');
            $transaction->allow_commit();
            error_log('Save completed successfully');
            
            return [
                'success' => true,
                'ideaMappings' => $ideaMappings
            ];
            
        } catch (\Exception $e) {
            error_log('ProjectDataManager save error: ' . $e->getMessage());
            error_log('ProjectDataManager save error trace: ' . $e->getTraceAsString());
            if (isset($transaction)) {
            $transaction->rollback($e);
            }
            return false;
        }
    }
    
    /**
     * Reconstruct project structure from normalized data
     * @param object $metadata Metadata record
     * @param array $ideas Ideas records
     * @param array $content Content records
     * @param array $chat Chat records
     * @return array Reconstructed project data
     */
    private function reconstructProject($metadata, $ideas, $content, $chat) {
        // Convert database records back to JSON structure
        // Handle null metadata (new project)
        
        // Log goal value for debugging
        $goalValue = ($metadata && isset($metadata->goal) && $metadata->goal !== null) ? $metadata->goal : '';
        error_log('ProjectDataManager::reconstructProject - Goal value from DB: ' . var_export($goalValue, true));
        
        $project = [
            'metadata' => [
                'title' => ($metadata && isset($metadata->title)) ? $metadata->title : '',
                'description' => ($metadata && isset($metadata->description)) ? $metadata->description : '',
                'currentTab' => ($metadata && isset($metadata->current_tab)) ? $metadata->current_tab : 'plan',
                'instructorInstructions' => ($metadata && isset($metadata->instructor_instructions)) ? $metadata->instructor_instructions : '',
                'goal' => $goalValue,
                'created' => ($metadata && isset($metadata->created_at)) ? date('c', $metadata->created_at) : date('c'),
                'modified' => ($metadata && isset($metadata->modified_at)) ? date('c', $metadata->modified_at) : date('c')
            ],
            'plan' => $this->reconstructPlanData($ideas, $metadata),
            'write' => $this->getContentByPhase($content, 'write'),
            'edit' => $this->getContentByPhase($content, 'edit'),
            'chatHistory' => array_values(array_map(function($message) {
                $ts = $message->timestamp;
                if (is_numeric($ts) && $ts > 0) {
                    $ts = (int) $ts;
                } elseif ($ts instanceof \DateTimeInterface) {
                    $ts = $ts->getTimestamp();
                } elseif (is_string($ts) && $ts !== '') {
                    $parsed = strtotime($ts);
                    $ts = ($parsed !== false) ? $parsed : (int) ($message->created_at ?? time());
                } else {
                    $ts = isset($message->created_at) ? (int) $message->created_at : time();
                }
                return [
                    'role' => $message->role,
                    'content' => $message->content,
                    'timestamp' => $ts
                ];
            }, $chat))
        ];
        
        error_log('ProjectDataManager: Final reconstructed project: ' . json_encode($project));
        return $project;
    }
    
    /**
     * Reconstruct plan data including outline structure
     * @param array $ideas Ideas records
     * @param object $metadata Metadata record
     * @return array Plan data with ideas and outline
     */
    private function reconstructPlanData($ideas, $metadata) {
        $planData = [
            'ideas' => array_map(function($idea) {
                return [
                    'id' => $idea->id,
                    'content' => $idea->content,
                    'location' => $idea->location,
                    'sectionId' => $idea->section_id,
                    'aiGenerated' => (bool)$idea->ai_generated
                ];
            }, $ideas),
            'outline' => [],
            'customSectionTitles' => [],
            'customSections' => [],
            'removedSections' => []
        ];
        
        // Restore outline structure from plan_outline JSON field
        if ($metadata && isset($metadata->plan_outline) && !empty($metadata->plan_outline)) {
            try {
                $outlineData = json_decode($metadata->plan_outline, true);
                if (is_array($outlineData)) {
                    $planData['outline'] = $outlineData['outline'] ?? [];
                    $planData['customSectionTitles'] = $outlineData['customSectionTitles'] ?? [];
                    $planData['customSections'] = $outlineData['customSections'] ?? [];
                    $planData['removedSections'] = $outlineData['removedSections'] ?? [];
                    $planData['sectionOrder'] = $outlineData['sectionOrder'] ?? []; // Restore section order
                }
            } catch (\Exception $e) {
                error_log('Failed to decode plan_outline JSON: ' . $e->getMessage());
            }
        }
        
        return $planData;
    }
    
    /**
     * Get content by phase
     * @param array $content Content records
     * @param string $phase Phase name
     * @return array Content for phase
     */
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
    
    /**
     * Save metadata to normalized table
     * @param int $researchflowid Activity ID
     * @param int $userid User ID
     * @param array $metadata Metadata array
     */
    private function saveMetadata($researchflowid, $userid, $metadata) {
        global $DB;
        
        try {
            $now = time();
            
            // Serialize plan outline data (custom sections, custom titles, outline structure)
            $planOutlineData = null;
            if (isset($metadata['planOutline'])) {
                $planOutlineData = json_encode($metadata['planOutline'], JSON_UNESCAPED_UNICODE);
                error_log('ProjectDataManager::saveMetadata - planOutline data: ' . $planOutlineData);
                error_log('ProjectDataManager::saveMetadata - planOutline structure: ' . print_r($metadata['planOutline'], true));
            } else {
                error_log('ProjectDataManager::saveMetadata - planOutline NOT in metadata');
            }
        
        $record = [
            'researchflowid' => $researchflowid,
            'userid' => $userid,
            'title' => $metadata['title'] ?? '',
            'description' => $metadata['description'] ?? '',
            'current_tab' => $metadata['currentTab'] ?? 'plan',
            'instructor_instructions' => $metadata['instructorInstructions'] ?? '',
            'goal' => $metadata['goal'] ?? '',
            'created_at' => $now,
            'modified_at' => $now
        ];
        
        // Add plan_outline field - check if it exists first
        $dbman = $DB->get_manager();
        $table = new \xmldb_table('researchflow_metadata');
        $field = new \xmldb_field('plan_outline', XMLDB_TYPE_TEXT, null, null, null, null, null);
        
        if ($dbman->field_exists($table, $field)) {
            $record['plan_outline'] = $planOutlineData;
            error_log('ProjectDataManager::saveMetadata - plan_outline field exists, adding to record');
            error_log('ProjectDataManager::saveMetadata - plan_outline value length: ' . ($planOutlineData ? strlen($planOutlineData) : 0));
        } else {
            error_log('ProjectDataManager::saveMetadata - plan_outline field does NOT exist in database yet');
            error_log('ProjectDataManager::saveMetadata - Need to run Moodle upgrade to add plan_outline field');
            // Try to add the field dynamically if it doesn't exist (fallback)
            try {
                $dbman->add_field($table, $field);
                error_log('ProjectDataManager::saveMetadata - Dynamically added plan_outline field');
                $record['plan_outline'] = $planOutlineData;
            } catch (\Exception $e) {
                error_log('ProjectDataManager::saveMetadata - Failed to add plan_outline field: ' . $e->getMessage());
                // Don't add plan_outline to record if field doesn't exist and we can't create it
                // The save will still succeed for other fields
            }
        }
        
        $existing = $DB->get_record('researchflow_metadata', [
            'researchflowid' => $researchflowid,
            'userid' => $userid
        ]);
        
        // Remove plan_outline from record if field doesn't exist (to avoid DB errors)
        $recordToSave = $record;
        if (!isset($record['plan_outline']) || $record['plan_outline'] === null) {
            // Field doesn't exist, remove it from save to prevent DB errors
            unset($recordToSave['plan_outline']);
        }
        
        if ($existing) {
            $recordToSave['id'] = $existing->id;
            $recordToSave['created_at'] = $existing->created_at; // Keep original creation time
            
            // Remove plan_outline if field doesn't exist in database
            if (!$dbman->field_exists($table, $field)) {
                unset($recordToSave['plan_outline']);
            }
            
            $result = $DB->update_record('researchflow_metadata', $recordToSave);
            error_log('Metadata update result: ' . ($result ? 'SUCCESS' : 'FAILED'));
            if (!$result) {
                error_log('Metadata update failed - record: ' . json_encode($recordToSave));
            }
        } else {
            // Remove plan_outline if field doesn't exist in database
            if (!$dbman->field_exists($table, $field)) {
                unset($recordToSave['plan_outline']);
            }
            
            $result = $DB->insert_record('researchflow_metadata', $recordToSave);
            error_log('Metadata insert result: ' . ($result ? 'SUCCESS (ID: ' . $result . ')' : 'FAILED'));
            if (!$result) {
                error_log('Metadata insert failed - record: ' . json_encode($recordToSave));
            }
        }
        } catch (\Exception $e) {
            error_log('saveMetadata error: ' . $e->getMessage());
            error_log('saveMetadata error trace: ' . $e->getTraceAsString());
            error_log('saveMetadata error - record being saved: ' . json_encode($record ?? []));
            throw $e;
        }
    }
    
    /**
     * Save ideas to normalized table
     * @param int $researchflowid Activity ID
     * @param int $userid User ID
     * @param array $ideas Ideas array
     * @return array Mapping of client IDs to DB IDs
     */
    private function saveIdeas($researchflowid, $userid, $ideas) {
        global $DB;
        
        $idMappings = [];
        
        try {
            $now = time();
            
            // Normalize content for comparison (strip HTML, trim whitespace)
            $normalizeContent = function($content) {
                return trim(strip_tags($content));
            };
            
            foreach ($ideas as $idea) {
                $content = $idea['content'] ?? '';
                $location = $idea['location'] ?? 'brainstorm';
                $sectionId = $idea['sectionId'] ?? null;
                $ai = !empty($idea['aiGenerated']) ? 1 : 0;
                $id = isset($idea['id']) ? intval($idea['id']) : 0;
                $normalizedContent = $normalizeContent($content);

                $record = [
                    'researchflowid' => $researchflowid,
                    'userid' => $userid,
                    'content' => $content,
                    'location' => $location,
                    'section_id' => $sectionId,
                    'ai_generated' => $ai,
                    'modified_at' => $now
                ];

                // Try to update by ID first if valid integer ID
                if ($id > 0) {
                    $existing = $DB->get_record('researchflow_ideas', [
                        'id' => $id,
            'researchflowid' => $researchflowid,
            'userid' => $userid
        ]);
                    if ($existing) {
                        $record['id'] = $id;
                        $DB->update_record('researchflow_ideas', $record);
                        error_log('Idea update: ID ' . $id);
                        $idMappings[$id] = $id; // Map to itself
                        continue;
                    }
                }

                // Check for duplicate by content + location + sectionId before inserting
                $conditions = [
                'researchflowid' => $researchflowid,
                'userid' => $userid,
                    'location' => $location
                ];
                
                // Handle section_id NULL properly
                if ($sectionId === null) {
                    $sql = "SELECT * FROM {researchflow_ideas} 
                            WHERE researchflowid = :researchflowid 
                            AND userid = :userid 
                            AND location = :location 
                            AND section_id IS NULL";
                    $params = [
                        'researchflowid' => $researchflowid,
                        'userid' => $userid,
                        'location' => $location
                    ];
                } else {
                    $sql = "SELECT * FROM {researchflow_ideas} 
                            WHERE researchflowid = :researchflowid 
                            AND userid = :userid 
                            AND location = :location 
                            AND section_id = :section_id";
                    $params = [
                        'researchflowid' => $researchflowid,
                        'userid' => $userid,
                        'location' => $location,
                        'section_id' => $sectionId
                    ];
                }
                
                $potentialDuplicates = $DB->get_records_sql($sql, $params);
                
                // Check if any existing record has the same normalized content
                $isDuplicate = false;
                $existingId = null;
                foreach ($potentialDuplicates as $existing) {
                    if ($normalizeContent($existing->content) === $normalizedContent) {
                        $isDuplicate = true;
                        $existingId = $existing->id;
                        break;
                    }
                }
                
                if ($isDuplicate && $existingId) {
                    // Update existing duplicate instead of creating new
                    // Update existing duplicate instead of creating new
                    $record['id'] = $existingId;
                    $DB->update_record('researchflow_ideas', $record);
                    error_log('Idea update (duplicate prevention): ID ' . $existingId);
                    
                    // Map client ID (which might be temp) to the existing DB ID
                    if (isset($idea['id'])) {
                        $idMappings[$idea['id']] = $existingId;
                    }
                } else {
                    // Insert new
                    $record['created_at'] = $now;
                    $newid = $DB->insert_record('researchflow_ideas', $record);
                    error_log('Idea insert: new ID ' . $newid);
                    
                    // Map client ID to new DB ID
                    if (isset($idea['id'])) {
                        $idMappings[$idea['id']] = $newid;
                    }
                }
            }
            
            return $idMappings;
        } catch (\Exception $e) {
            error_log('saveIdeas error: ' . $e->getMessage());
            error_log('saveIdeas error trace: ' . $e->getTraceAsString());
            throw $e;
        }
    }
    
    /**
     * Save content to normalized table
     * @param int $researchflowid Activity ID
     * @param int $userid User ID
     * @param array $content Content array
     * @param string $phase Phase name
     */
    private function saveContent($researchflowid, $userid, $content, $phase) {
        global $DB;
        
        // Allow saving even if content is empty (user might clear it)
        $contentText = isset($content['content']) ? $content['content'] : '';
        $wordCount = isset($content['wordCount']) ? intval($content['wordCount']) : 0;
        $changeSummary = isset($content['changeSummary']) ? $content['changeSummary'] : 'Auto-saved';
        
        error_log("saveContent($phase): content length=" . strlen($contentText) . ", wordCount=$wordCount");
        
        $now = time();
        $record = [
            'researchflowid' => $researchflowid,
            'userid' => $userid,
            'phase' => $phase,
            'content' => $contentText,
            'word_count' => $wordCount,
            'modified_at' => $now
        ];
        
        $existing = $DB->get_record('researchflow_content', [
            'researchflowid' => $researchflowid,
            'userid' => $userid,
            'phase' => $phase
        ]);
        
        $isNew = !$existing;
        $shouldCreateVersion = false;
        
        if ($existing) {
            // Check if we should create a version snapshot
            $wordDiff = abs($wordCount - ($existing->word_count ?? 0));
            $contentChanged = $contentText !== $existing->content;
            
            error_log("saveContent($phase): existing word_count=" . ($existing->word_count ?? 0) . ", new=$wordCount, diff=$wordDiff");
            error_log("saveContent($phase): contentChanged=" . ($contentChanged ? 'YES' : 'NO') . ", changeSummary='$changeSummary'");
            
            // Create version if manual save OR significant change
            $shouldCreateVersion = $changeSummary === 'Manual save' || (
                $contentChanged && $wordDiff >= \mod_researchflow\data\VersionManager::AUTO_SAVE_THRESHOLD
            );
            
            error_log("saveContent($phase): shouldCreateVersion=" . ($shouldCreateVersion ? 'YES' : 'NO'));
            
            $record['id'] = $existing->id;
            $record['created_at'] = $existing->created_at; // Keep original creation time
            $DB->update_record('researchflow_content', $record);
            error_log("saveContent($phase): UPDATED existing record ID=" . $existing->id);
        } else {
            $shouldCreateVersion = true; // Always create version for first save
            $record['created_at'] = $now;
            $newid = $DB->insert_record('researchflow_content', $record);
            error_log("saveContent($phase): INSERTED new record ID=" . $newid);
        }
        
        // Save version snapshot if needed
        if ($shouldCreateVersion) {
            $versionNumber = \mod_researchflow\data\VersionManager::saveVersion(
                $researchflowid,
                $userid,
                $phase,
                $contentText,
                $wordCount,
                $changeSummary
            );
            if ($versionNumber) {
                error_log("saveContent($phase): Created version snapshot #$versionNumber");
            }
        }
    }
    
    /**
     * Save chat to normalized table (APPEND MODE - Preserves History)
     * @param int $researchflowid Activity ID
     * @param int $userid User ID
     * @param array $chatHistory Chat history array
     */
    private function saveChat($researchflowid, $userid, $chatHistory) {
        global $DB;
        
        try {
            // DON'T DELETE - Just append new messages
            error_log('saveChat: Starting append mode - preserving history');
            
            foreach ($chatHistory as $index => $message) {
                error_log("Processing chat message $index: " . json_encode($message));
                
                // Parse timestamp - normalize to Unix for conversion, then to DB format
                $timestampRaw = $message['timestamp'] ?? time();
                if (is_string($timestampRaw)) {
                    $timestampUnix = strtotime($timestampRaw);
                    $timestampUnix = ($timestampUnix !== false) ? $timestampUnix : time();
                } else if (is_numeric($timestampRaw)) {
                    $timestampUnix = ($timestampRaw > 10000000000) ? (int)($timestampRaw / 1000) : (int)$timestampRaw;
                } else {
                    $timestampUnix = time();
                }
                // DB uses TIMESTAMP type - pass as Y-m-d H:i:s string
                $timestampStr = date('Y-m-d H:i:s', $timestampUnix);
                
                // Validate required fields
                if (!isset($message['role']) || !isset($message['content'])) {
                    error_log("Invalid message structure at index $index: missing role or content");
                    continue;
                }
                
                $sessionId = $message['sessionId'] ?? 'default';
                
                // Check if message already exists to prevent duplicates (per session)
                $existing = $DB->record_exists('researchflow_chat', [
                    'researchflowid' => $researchflowid,
                    'userid' => $userid,
                    'chat_session_id' => $sessionId,
                    'role' => $message['role'],
                    'content' => $message['content'],
                    'timestamp' => $timestampStr
                ]);
                
                if ($existing) {
                    error_log('Chat message already exists, skipping: ' . json_encode($message));
                    continue;
                }
                
                $record = [
                    'researchflowid' => $researchflowid,
                    'userid' => $userid,
                    'chat_session_id' => $sessionId,
                    'role' => $message['role'],
                    'content' => $message['content'],
                    'timestamp' => $timestampStr,
                    'created_at' => time()
                ];
                
                error_log('Inserting chat message: ' . json_encode($record));
                $result = $DB->insert_record('researchflow_chat', $record);
                error_log('Chat message insert result: ' . ($result ? 'SUCCESS (ID: ' . $result . ')' : 'FAILED'));
            }
            
            error_log('saveChat: Append mode complete - history preserved');
        } catch (\Exception $e) {
            error_log('saveChat error: ' . $e->getMessage());
            error_log('saveChat error trace: ' . $e->getTraceAsString());
            throw $e;
        }
    }

    /**
     * Delete a single idea by id for the given activity and user
     * @param int $researchflowid
     * @param int $userid
     * @param int $ideaId
     * @return bool
     */
    public function deleteIdea($researchflowid, $userid, $ideaId) {
        global $DB;
        try {
            if (empty($ideaId)) {
                return false;
            }
            return $DB->delete_records('researchflow_ideas', [
                'id' => $ideaId,
                'researchflowid' => $researchflowid,
                'userid' => $userid
            ]);
        } catch (\Exception $e) {
            error_log('ProjectDataManager: deleteIdea failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Delete an idea by its fields (for cases where client does not know DB id)
     * @param int $researchflowid
     * @param int $userid
     * @param string $content
     * @param string $location
     * @param string|null $sectionId
     * @return bool
     */
    public function deleteIdeaByFields($researchflowid, $userid, $content, $location, $sectionId = null) {
        global $DB;
        try {
            // Log intent
            error_log('deleteIdeaByFields: researchflowid=' . $researchflowid . ', userid=' . $userid . ', content=' . substr($content,0,120) . ', location=' . $location . ', sectionId=' . ($sectionId ?? 'NULL'));

            // Helper to normalize text for comparison
            $normalize = function($text) {
                $t = is_string($text) ? $text : '';
                $t = strip_tags($t);
                $t = preg_replace('/\s+/', ' ', $t);
                return trim($t);
            };

            $targetContent = $normalize($content);

            // Step 1: Try strict SQL match (fast path)
            $wheres = ['researchflowid = :wid', 'userid = :uid', 'location = :loc', 'content = :content'];
            $sqlparams = [ 'wid' => $researchflowid, 'uid' => $userid, 'loc' => $location, 'content' => $content ];
            if ($sectionId === null || $sectionId === '') {
                $wheres[] = 'section_id IS NULL';
            } else {
                $wheres[] = 'section_id = :sid';
                $sqlparams['sid'] = $sectionId;
            }
            $where = implode(' AND ', $wheres);
            $records = $DB->get_records_select('researchflow_ideas', $where, $sqlparams, '', 'id');
            if (!empty($records)) {
                foreach ($records as $rec) {
                    $DB->delete_records('researchflow_ideas', ['id' => $rec->id]);
                }
                error_log('deleteIdeaByFields: strict match delete count = ' . count($records));
                return true;
            }

            // Step 2: Fuzzy match by normalized content + same user/activity; optionally check location/sectionId
            $candidates = $DB->get_records('researchflow_ideas', [
                'researchflowid' => $researchflowid,
                'userid' => $userid
            ], '', 'id, content, location, section_id');

            $toDelete = [];
            foreach ($candidates as $rec) {
                $recContent = $normalize($rec->content);
                if ($recContent !== $targetContent) { continue; }
                if (!empty($location) && $rec->location !== $location) { continue; }
                if ($sectionId === null || $sectionId === '') {
                    // Accept either NULL or empty for brainstorm
                    if (!is_null($rec->section_id) && $rec->section_id !== '') { continue; }
                } else {
                    if ($rec->section_id !== $sectionId) { continue; }
                }
                $toDelete[] = $rec->id;
            }

            if (empty($toDelete)) {
                error_log('deleteIdeaByFields: no candidates matched after normalization');
                return false;
            }
            foreach ($toDelete as $id) {
                $DB->delete_records('researchflow_ideas', ['id' => $id]);
            }
            error_log('deleteIdeaByFields: fuzzy match delete count = ' . count($toDelete));
            return true;
        } catch (\Exception $e) {
            error_log('ProjectDataManager: deleteIdeaByFields failed: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Save chat messages for a specific session (APPEND MODE - No Deletion)
     * 
     * @param int $researchflowid Activity ID
     * @param int $userid User ID
     * @param string $sessionId Chat session ID
     * @param array $messages Array of messages to append
     * @param bool $clearExisting If true, clears existing messages first (default: false)
     * @return bool Success
     */
    public function saveChatSession($researchflowid, $userid, $sessionId, $messages, $clearExisting = false) {
        global $DB;
        
        try {
            // Only clear if explicitly requested
            if ($clearExisting) {
                $DB->delete_records('researchflow_chat', [
                    'researchflowid' => $researchflowid,
                    'userid' => $userid,
                    'chat_session_id' => $sessionId
                ]);
            }
            
            // Insert new messages (append mode)
            foreach ($messages as $message) {
                // Check if message already exists to prevent duplicates
                $existing = $DB->record_exists('researchflow_chat', [
                    'researchflowid' => $researchflowid,
                    'userid' => $userid,
                    'chat_session_id' => $sessionId,
                    'content' => $message['content'],
                    'timestamp' => $message['timestamp']
                ]);
                
                if (!$existing) {
                    $record = [
                        'researchflowid' => $researchflowid,
                        'userid' => $userid,
                        'chat_session_id' => $sessionId,
                        'role' => $message['role'],
                        'content' => $message['content'],
                        'timestamp' => $message['timestamp'],
                        'created_at' => time()
                    ];
                    
                    $DB->insert_record('researchflow_chat', $record);
                }
            }
            
            return true;
        } catch (\Exception $e) {
            error_log('ProjectDataManager: Failed to save chat session: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Load ONLY chat history (fast, for initialization)
     * 
     * @param int $researchflowid Activity ID
     * @param int $userid User ID
     * @param int|null $limit Maximum number of messages to return
     * @param string|null $sessionId Optional session ID to filter by. When null, returns all messages.
     *                               When 'chat-1', also includes 'default' for backward compatibility.
     * @return array Array of chat messages
     */
    public function loadChatHistoryOnly($researchflowid, $userid, $limit = null, $sessionId = null) {
        global $DB;
        
        try {
            $params = [
                'researchflowid' => $researchflowid,
                'userid' => $userid
            ];
            
            $sql = "SELECT id, role, content, timestamp, created_at 
                    FROM {researchflow_chat} 
                    WHERE researchflowid = :researchflowid 
                    AND userid = :userid";
            
            if ($sessionId !== null && $sessionId !== '') {
                if ($sessionId === 'chat-1') {
                    $sql .= " AND (chat_session_id = :sessionid OR chat_session_id = 'default')";
                    $params['sessionid'] = $sessionId;
                } else {
                    $sql .= " AND chat_session_id = :sessionid";
                    $params['sessionid'] = $sessionId;
                }
            }
            
            $sql .= " ORDER BY timestamp DESC";
            
            if ($limit !== null && $limit > 0) {
                $sql .= " LIMIT " . intval($limit);
            }
            
            $chatRecords = $DB->get_records_sql($sql, $params);
            
            $chatHistory = [];
            foreach ($chatRecords as $record) {
                // Convert to Unix timestamp for timezone-safe client display
                $ts = $record->timestamp;
                if (is_numeric($ts) && $ts > 0) {
                    $ts = (int) $ts;
                } elseif ($ts instanceof \DateTimeInterface) {
                    $ts = $ts->getTimestamp();
                } elseif (is_string($ts) && $ts !== '') {
                    $parsed = strtotime($ts);
                    $ts = ($parsed !== false) ? $parsed : (int) ($record->created_at ?? time());
                } else {
                    $ts = isset($record->created_at) ? (int) $record->created_at : time();
                }
                $chatHistory[] = [
                    'id' => $record->id,
                    'role' => $record->role,
                    'content' => $record->content,
                    'timestamp' => $ts
                ];
            }
            
            return $chatHistory;
        } catch (\Exception $e) {
            error_log('ProjectDataManager: Failed to load chat history: ' . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Load chat messages for a specific session
     * 
     * @param int $researchflowid Activity ID
     * @param int $userid User ID
     * @param string $sessionId Chat session ID
     * @return array Array of messages
     */
    public function loadChatSession($researchflowid, $userid, $sessionId) {
        global $DB;
        
        $messages = $DB->get_records('researchflow_chat', [
            'researchflowid' => $researchflowid,
            'userid' => $userid,
            'chat_session_id' => $sessionId
        ], 'timestamp ASC');
        
        $result = [];
        foreach ($messages as $message) {
            $result[] = [
                'role' => $message->role,
                'content' => $message->content,
                'timestamp' => $message->timestamp
            ];
        }
        
        return $result;
    }
    
    /**
     * Get all chat sessions for a user and activity
     * 
     * @param int $researchflowid Activity ID
     * @param int $userid User ID
     * @return array Array of chat sessions with messages
     */
    public function getAllChatSessions($researchflowid, $userid) {
        global $DB;
        
        // Get all sessions
        $sessions = $DB->get_records('researchflow_chat_sessions', [
            'researchflowid' => $researchflowid,
            'userid' => $userid
        ], 'created_at DESC');
        
        $result = [];
        foreach ($sessions as $session) {
            // Get messages for this session
            $messages = $this->loadChatSession($researchflowid, $userid, $session->session_id);
            
            $result[$session->session_id] = [
                'session_id' => $session->session_id,
                'title' => $session->title,
                'is_active' => $session->is_active,
                'created_at' => $session->created_at,
                'modified_at' => $session->modified_at,
                'messages' => $messages
            ];
        }
        
        return $result;
    }
    /**
     * Get all submissions for an activity
     * @param int $researchflowid Activity ID
     * @return array Array of submission data
     */
    public function getAllSubmissions($researchflowid) {
        global $DB;
        
        try {
            // Get all users who have metadata for this activity
            $sql = "SELECT u.id, m.userid, m.modified_at as last_modified, 
                           u.firstname, u.lastname, u.email, u.picture, u.imagealt
                    FROM {researchflow_metadata} m
                    JOIN {user} u ON m.userid = u.id
                    WHERE m.researchflowid = :researchflowid
                    ORDER BY u.lastname, u.firstname";
            
            $submissions = $DB->get_records_sql($sql, ['researchflowid' => $researchflowid]);
            
            // Enrich with word counts
            foreach ($submissions as $submission) {
                // Get write phase word count
                $writeContent = $DB->get_record('researchflow_content', [
                    'researchflowid' => $researchflowid,
                    'userid' => $submission->userid,
                    'phase' => 'write'
                ], 'word_count');
                $submission->write_word_count = $writeContent ? $writeContent->word_count : 0;
                
                // Get edit phase word count
                $editContent = $DB->get_record('researchflow_content', [
                    'researchflowid' => $researchflowid,
                    'userid' => $submission->userid,
                    'phase' => 'edit'
                ], 'word_count');
                $submission->edit_word_count = $editContent ? $editContent->word_count : 0;
            }
            
            return array_values($submissions);
            
        } catch (\Exception $e) {
            error_log('ProjectDataManager::getAllSubmissions error: ' . $e->getMessage());
            return [];
        }
    }
    /**
     * Submit the project
     * 
     * @param int $researchflowid Activity ID
     * @param int $userid User ID
     * @return bool Success status
     */
    public function submitProject($researchflowid, $userid) {
        global $DB;
        
        try {
            error_log("submitProject called for activity $researchflowid, user $userid");

            // Check if metadata exists
            $metadata = $DB->get_record('researchflow_metadata', [
                'researchflowid' => $researchflowid,
                'userid' => $userid
            ]);
            
            if (!$metadata) {
                error_log("submitProject: Metadata not found for activity $researchflowid, user $userid");
                return false;
            }
            
            // Check if status field exists in the object (proxy for DB column existence)
            // Note: get_record returns all columns. If 'status' is missing, the DB upgrade didn't run.
            if (!property_exists($metadata, 'status')) {
                error_log("submitProject: 'status' field missing from metadata record. Database upgrade likely needed.");
            }

            $metadata->status = 'submitted';
            $metadata->modified_at = time();
            
            $result = $DB->update_record('researchflow_metadata', $metadata);
            error_log("submitProject: update_record result: " . ($result ? 'SUCCESS' : 'FAILED'));
            
            return $result;
            
        } catch (\Exception $e) {
            error_log('ProjectDataManager::submitProject error: ' . $e->getMessage());
            return false;
        }
    }
}
