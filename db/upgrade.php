<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Database upgrade script for researchflow module
 * @package    mod_researchflow
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Upgrade function for researchflow module
 * @param int $oldversion The old version number
 * @return bool Success status
 */
function xmldb_researchflow_upgrade($oldversion) {
    global $DB;
    
    $dbman = $DB->get_manager();
    
    // Version 2025102103: Add normalized tables for data migration
    if ($oldversion < 2025102103) {
        
        // Create ideas table
        $table = new xmldb_table('researchflow_ideas');
        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('researchflowid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('content', XMLDB_TYPE_TEXT, null, null, XMLDB_NOTNULL, null, null);
        $table->add_field('location', XMLDB_TYPE_CHAR, '20', null, XMLDB_NOTNULL, null, null);
        $table->add_field('section_id', XMLDB_TYPE_CHAR, '50', null, null, null, null);
        $table->add_field('ai_generated', XMLDB_TYPE_INTEGER, '1', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('created_at', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('modified_at', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        
        $table->add_key('primary', XMLDB_KEY_PRIMARY, array('id'));
        $table->add_key('user_fk', XMLDB_KEY_FOREIGN, array('userid'), 'user', array('id'));
        $table->add_key('researchflow_fk', XMLDB_KEY_FOREIGN, array('researchflowid'), 'researchflow', array('id'));
        
        $table->add_index('idx_user_activity', XMLDB_INDEX_NOTUNIQUE, array('userid', 'researchflowid'));
        $table->add_index('idx_location', XMLDB_INDEX_NOTUNIQUE, array('location'));
        $table->add_index('idx_ai_generated', XMLDB_INDEX_NOTUNIQUE, array('ai_generated'));
        
        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }
        
        // Create content table
        $table = new xmldb_table('researchflow_content');
        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('researchflowid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('phase', XMLDB_TYPE_CHAR, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('content', XMLDB_TYPE_TEXT, null, null, null, null, null);
        $table->add_field('word_count', XMLDB_TYPE_INTEGER, '10', null, null, null, '0');
        $table->add_field('created_at', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('modified_at', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        
        $table->add_key('primary', XMLDB_KEY_PRIMARY, array('id'));
        $table->add_key('user_fk', XMLDB_KEY_FOREIGN, array('userid'), 'user', array('id'));
        $table->add_key('researchflow_fk', XMLDB_KEY_FOREIGN, array('researchflowid'), 'researchflow', array('id'));
        $table->add_key('unique_user_phase', XMLDB_KEY_UNIQUE, array('researchflowid', 'userid', 'phase'));
        
        $table->add_index('idx_word_count', XMLDB_INDEX_NOTUNIQUE, array('word_count'));
        $table->add_index('idx_phase', XMLDB_INDEX_NOTUNIQUE, array('phase'));
        
        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }
        
        // Create chat table
        $table = new xmldb_table('researchflow_chat');
        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('researchflowid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('chat_session_id', XMLDB_TYPE_CHAR, '50', null, XMLDB_NOTNULL, null, null);
        $table->add_field('role', XMLDB_TYPE_CHAR, '20', null, XMLDB_NOTNULL, null, null);
        $table->add_field('content', XMLDB_TYPE_TEXT, null, null, XMLDB_NOTNULL, null, null);
        $table->add_field('timestamp', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('created_at', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        
        $table->add_key('primary', XMLDB_KEY_PRIMARY, array('id'));
        $table->add_key('user_fk', XMLDB_KEY_FOREIGN, array('userid'), 'user', array('id'));
        $table->add_key('researchflow_fk', XMLDB_KEY_FOREIGN, array('researchflowid'), 'researchflow', array('id'));
        
        $table->add_index('idx_user_activity', XMLDB_INDEX_NOTUNIQUE, array('userid', 'researchflowid'));
        $table->add_index('idx_chat_session', XMLDB_INDEX_NOTUNIQUE, array('chat_session_id'));
        $table->add_index('idx_timestamp', XMLDB_INDEX_NOTUNIQUE, array('timestamp'));
        $table->add_index('idx_role', XMLDB_INDEX_NOTUNIQUE, array('role'));
        
        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }
        
        // Create chat sessions table for metadata
        $table = new xmldb_table('researchflow_chat_sessions');
        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('researchflowid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('session_id', XMLDB_TYPE_CHAR, '50', null, XMLDB_NOTNULL, null, null);
        $table->add_field('title', XMLDB_TYPE_CHAR, '255', null, null, null, 'New Chat');
        $table->add_field('is_active', XMLDB_TYPE_INTEGER, '1', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('created_at', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('modified_at', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        
        $table->add_key('primary', XMLDB_KEY_PRIMARY, array('id'));
        $table->add_key('user_fk', XMLDB_KEY_FOREIGN, array('userid'), 'user', array('id'));
        $table->add_key('researchflow_fk', XMLDB_KEY_FOREIGN, array('researchflowid'), 'researchflow', array('id'));
        $table->add_key('unique_session', XMLDB_KEY_UNIQUE, array('researchflowid', 'userid', 'session_id'));
        
        $table->add_index('idx_user_activity', XMLDB_INDEX_NOTUNIQUE, array('userid', 'researchflowid'));
        $table->add_index('idx_session_id', XMLDB_INDEX_NOTUNIQUE, array('session_id'));
        $table->add_index('idx_is_active', XMLDB_INDEX_NOTUNIQUE, array('is_active'));
        
        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }
        
        // Create metadata table
        $table = new xmldb_table('researchflow_metadata');
        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('researchflowid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('title', XMLDB_TYPE_CHAR, '255', null, null, null, null);
        $table->add_field('description', XMLDB_TYPE_TEXT, null, null, null, null, null);
        $table->add_field('current_tab', XMLDB_TYPE_CHAR, '20', null, null, null, 'plan');
        $table->add_field('instructor_instructions', XMLDB_TYPE_TEXT, null, null, null, null, null);
        $table->add_field('created_at', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('modified_at', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        
        $table->add_key('primary', XMLDB_KEY_PRIMARY, array('id'));
        $table->add_key('user_fk', XMLDB_KEY_FOREIGN, array('userid'), 'user', array('id'));
        $table->add_key('researchflow_fk', XMLDB_KEY_FOREIGN, array('researchflowid'), 'researchflow', array('id'));
        $table->add_key('unique_user_activity', XMLDB_KEY_UNIQUE, array('researchflowid', 'userid'));
        
        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }
        
        upgrade_mod_savepoint(true, 2025102103, 'researchflow');
    }
    
    // Version 2025102106: Add content version history table
    if ($oldversion < 2025102106) {
        // Create content versions table
        $table = new xmldb_table('researchflow_versions');
        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('researchflowid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('phase', XMLDB_TYPE_CHAR, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('content', XMLDB_TYPE_TEXT, null, null, XMLDB_NOTNULL, null, null);
        $table->add_field('word_count', XMLDB_TYPE_INTEGER, '10', null, null, null, '0');
        $table->add_field('version_number', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '1');
        $table->add_field('created_at', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('modified_by', XMLDB_TYPE_INTEGER, '10', null, null, null, null);
        $table->add_field('change_summary', XMLDB_TYPE_CHAR, '255', null, null, null, null);
        
        $table->add_key('primary', XMLDB_KEY_PRIMARY, array('id'));
        $table->add_key('user_fk', XMLDB_KEY_FOREIGN, array('userid'), 'user', array('id'));
        $table->add_key('researchflow_fk', XMLDB_KEY_FOREIGN, array('researchflowid'), 'researchflow', array('id'));
        $table->add_key('modified_by_fk', XMLDB_KEY_FOREIGN, array('modified_by'), 'user', array('id'));
        
        $table->add_index('idx_user_activity_phase', XMLDB_INDEX_NOTUNIQUE, array('researchflowid', 'userid', 'phase'));
        $table->add_index('idx_version_number', XMLDB_INDEX_NOTUNIQUE, array('version_number'));
        $table->add_index('idx_created_at', XMLDB_INDEX_NOTUNIQUE, array('created_at'));
        
        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }
        
        upgrade_mod_savepoint(true, 2025102106, 'researchflow');
    }
    
    // Version 2025102107: Add goal field to metadata table
    if ($oldversion < 2025102107) {
        $table = new xmldb_table('researchflow_metadata');
        $field = new xmldb_field('goal', XMLDB_TYPE_TEXT, null, null, null, null, null, 'instructor_instructions');
        
        if (!$dbman->field_exists($table, $field)) {
            $dbman->add_field($table, $field);
        }
        
        upgrade_mod_savepoint(true, 2025102107, 'researchflow');
    }
    
    // Version 2025102108: Add plan_outline field to metadata table for storing outline structure
    if ($oldversion < 2025102108) {
        $table = new xmldb_table('researchflow_metadata');
        $field = new xmldb_field('plan_outline', XMLDB_TYPE_TEXT, null, null, null, null, null, 'goal');
        
        if (!$dbman->field_exists($table, $field)) {
            $dbman->add_field($table, $field);
        }
        
        upgrade_mod_savepoint(true, 2025102108, 'researchflow');
    }
    
    // Version 2025102109: Add instructor goal fields to researchflow table (per-tab goals)
    if ($oldversion < 2025102109) {
        $table = new xmldb_table('researchflow');
        $field1 = new xmldb_field('plan_goal', XMLDB_TYPE_TEXT, null, null, null, null, null, 'timemodified');
        $field2 = new xmldb_field('write_goal', XMLDB_TYPE_TEXT, null, null, null, null, null, 'plan_goal');
        $field3 = new xmldb_field('edit_goal', XMLDB_TYPE_TEXT, null, null, null, null, null, 'write_goal');
        
        if (!$dbman->field_exists($table, $field1)) {
            $dbman->add_field($table, $field1);
        }
        if (!$dbman->field_exists($table, $field2)) {
            $dbman->add_field($table, $field2);
        }
        if (!$dbman->field_exists($table, $field3)) {
            $dbman->add_field($table, $field3);
        }
        
        upgrade_mod_savepoint(true, 2025102109, 'researchflow');
    }
    
    // Version 2025102110: Update existing NULL goal values to empty strings (fix YUI form errors)
    if ($oldversion < 2025102110) {
        // Update all existing records to have empty string values (not NULL)
        // This prevents Moodle YUI form JavaScript errors when editing existing activities
        // YUI form system fails if fields are NULL: "TypeError: null is not an object (evaluating 'this.field.setAttribute')"
        try {
            $DB->execute("UPDATE {researchflow} SET plan_goal = '' WHERE plan_goal IS NULL");
            $DB->execute("UPDATE {researchflow} SET write_goal = '' WHERE write_goal IS NULL");
            $DB->execute("UPDATE {researchflow} SET edit_goal = '' WHERE edit_goal IS NULL");
        } catch (Exception $e) {
            // Ignore errors if fields don't exist yet or table doesn't exist
            debugging("Could not update NULL goal fields: " . $e->getMessage(), DEBUG_NORMAL);
        }
        
        upgrade_mod_savepoint(true, 2025102110, 'researchflow');
    }
    
    // Version 2025102111: Change timestamp field from INTEGER to TIMESTAMP (TIMESTAMPTZ compatible)
    if ($oldversion < 2025102111) {
        // This version was for dropping and recreating - handled below in 2025102112
        upgrade_mod_savepoint(true, 2025102111, 'researchflow');
    }
    
    // Version 2025102112: Ensure timestamp field exists as TIMESTAMP type
    if ($oldversion < 2025102112) {
        $table = new xmldb_table('researchflow_chat');
        
        // Check if timestamp field exists (could be INTEGER or TIMESTAMP)
        $oldField = new xmldb_field('timestamp');
        $fieldExists = $dbman->field_exists($table, $oldField);
        
        if ($fieldExists) {
            // Field exists - check if it's INTEGER and needs conversion
            $intField = new xmldb_field('timestamp', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
            if ($dbman->field_exists($table, $intField)) {
                // Drop the index first (required before dropping column)
                $index = new xmldb_index('idx_timestamp', XMLDB_INDEX_NOTUNIQUE, array('timestamp'));
                if ($dbman->index_exists($table, $index)) {
                    $dbman->drop_index($table, $index);
                }
                
                // Drop the old INTEGER column
                $dbman->drop_field($table, $intField);
                
                // Recreate the column as TIMESTAMP type with default value using raw SQL
                // XMLDB has issues with defaults on non-empty tables, so use direct SQL
                try {
                    $DB->execute("ALTER TABLE {researchflow_chat} ADD COLUMN timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER content");
                } catch (Exception $e) {
                    // If that fails, try without AFTER clause (some DBs don't support it)
                    try {
                        $DB->execute("ALTER TABLE {researchflow_chat} ADD COLUMN timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
                    } catch (Exception $e2) {
                        // Fallback: use XMLDB but make it nullable first, then update and make NOT NULL
                        $newField = new xmldb_field('timestamp');
                        $newField->set_attributes(XMLDB_TYPE_TIMESTAMP, null, null, null, null, null, null, 'content');
                        $dbman->add_field($table, $newField);
                        
                        // Update existing rows with current timestamp
                        $DB->execute("UPDATE {researchflow_chat} SET timestamp = CURRENT_TIMESTAMP WHERE timestamp IS NULL");
                        
                        // Now make it NOT NULL
                        $newField->set_attributes(XMLDB_TYPE_TIMESTAMP, null, null, XMLDB_NOTNULL, null, null, null, 'content');
                        $dbman->change_field_notnull($table, $newField);
                    }
                }
                
                // Recreate the index on the new TIMESTAMP field
                $index = new xmldb_index('idx_timestamp', XMLDB_INDEX_NOTUNIQUE, array('timestamp'));
                $dbman->add_index($table, $index);
            }
            // If field exists but is already TIMESTAMP, do nothing
        } else {
            // Field doesn't exist - create it as TIMESTAMP with default value using raw SQL
            // XMLDB has issues with defaults on non-empty tables, so use direct SQL
            try {
                $DB->execute("ALTER TABLE {researchflow_chat} ADD COLUMN timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER content");
            } catch (Exception $e) {
                // If that fails, try without AFTER clause (some DBs don't support it)
                try {
                    $DB->execute("ALTER TABLE {researchflow_chat} ADD COLUMN timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
                } catch (Exception $e2) {
                    // Fallback: use XMLDB but make it nullable first, then update and make NOT NULL
                    $newField = new xmldb_field('timestamp');
                    $newField->set_attributes(XMLDB_TYPE_TIMESTAMP, null, null, null, null, null, null, 'content');
                    $dbman->add_field($table, $newField);
                    
                    // Update existing rows with current timestamp
                    $DB->execute("UPDATE {researchflow_chat} SET timestamp = CURRENT_TIMESTAMP WHERE timestamp IS NULL");
                    
                    // Now make it NOT NULL
                    $newField->set_attributes(XMLDB_TYPE_TIMESTAMP, null, null, XMLDB_NOTNULL, null, null, null, 'content');
                    $dbman->change_field_notnull($table, $newField);
                }
            }
            
            // Create the index
            $index = new xmldb_index('idx_timestamp', XMLDB_INDEX_NOTUNIQUE, array('timestamp'));
            if (!$dbman->index_exists($table, $index)) {
                $dbman->add_index($table, $index);
            }
        }
        
        upgrade_mod_savepoint(true, 2025102112, 'researchflow');
    }
    
    // Version 2025102113: Add status field to metadata table
    if ($oldversion < 2025102113) {
        $table = new xmldb_table('researchflow_metadata');
        $field = new xmldb_field('status', XMLDB_TYPE_CHAR, '20', null, null, null, 'draft', 'current_tab');
        
        if (!$dbman->field_exists($table, $field)) {
            $dbman->add_field($table, $field);
        }
        
        upgrade_mod_savepoint(true, 2025102113, 'researchflow');
    }
    
    // Version 2025102114: Add activity tracking table for writing analytics
    if ($oldversion < 2025102114) {
        // Create activity log table
        $table = new xmldb_table('researchflow_activity_log');
        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('researchflowid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('phase', XMLDB_TYPE_CHAR, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('action_type', XMLDB_TYPE_CHAR, '20', null, XMLDB_NOTNULL, null, null);
        $table->add_field('content_length', XMLDB_TYPE_INTEGER, '10', null, null, null, '0');
        $table->add_field('word_count', XMLDB_TYPE_INTEGER, '10', null, null, null, '0');
        $table->add_field('pasted_content', XMLDB_TYPE_TEXT, null, null, null, null, null);
        $table->add_field('pasted_length', XMLDB_TYPE_INTEGER, '10', null, null, null, '0');
        $table->add_field('typing_speed', XMLDB_TYPE_INTEGER, '10', null, null, null, '0');
        $table->add_field('session_id', XMLDB_TYPE_CHAR, '50', null, null, null, null);
        $table->add_field('timestamp', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('created_at', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        
        $table->add_key('primary', XMLDB_KEY_PRIMARY, array('id'));
        $table->add_key('user_fk', XMLDB_KEY_FOREIGN, array('userid'), 'user', array('id'));
        $table->add_key('researchflow_fk', XMLDB_KEY_FOREIGN, array('researchflowid'), 'researchflow', array('id'));
        
        $table->add_index('idx_user_activity_phase', XMLDB_INDEX_NOTUNIQUE, array('researchflowid', 'userid', 'phase'));
        $table->add_index('idx_action_type', XMLDB_INDEX_NOTUNIQUE, array('action_type'));
        $table->add_index('idx_timestamp', XMLDB_INDEX_NOTUNIQUE, array('timestamp'));
        $table->add_index('idx_session', XMLDB_INDEX_NOTUNIQUE, array('session_id'));
        
        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }
        
        upgrade_mod_savepoint(true, 2025102114, 'researchflow');
    }
    
    // Version 2025102115: Ensure activity log table exists (fail-safe)
    if ($oldversion < 2025102115) {
        $table = new xmldb_table('researchflow_activity_log');
        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('researchflowid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('phase', XMLDB_TYPE_CHAR, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('action_type', XMLDB_TYPE_CHAR, '20', null, XMLDB_NOTNULL, null, null);
        $table->add_field('content_length', XMLDB_TYPE_INTEGER, '10', null, null, null, '0');
        $table->add_field('word_count', XMLDB_TYPE_INTEGER, '10', null, null, null, '0');
        $table->add_field('pasted_content', XMLDB_TYPE_TEXT, null, null, null, null, null);
        $table->add_field('pasted_length', XMLDB_TYPE_INTEGER, '10', null, null, null, '0');
        $table->add_field('typing_speed', XMLDB_TYPE_INTEGER, '10', null, null, null, '0');
        $table->add_field('session_id', XMLDB_TYPE_CHAR, '50', null, null, null, null);
        $table->add_field('timestamp', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('created_at', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        
        $table->add_key('primary', XMLDB_KEY_PRIMARY, array('id'));
        $table->add_key('user_fk', XMLDB_KEY_FOREIGN, array('userid'), 'user', array('id'));
        $table->add_key('researchflow_fk', XMLDB_KEY_FOREIGN, array('researchflowid'), 'researchflow', array('id'));
        
        $table->add_index('idx_user_activity_phase', XMLDB_INDEX_NOTUNIQUE, array('researchflowid', 'userid', 'phase'));
        $table->add_index('idx_action_type', XMLDB_INDEX_NOTUNIQUE, array('action_type'));
        $table->add_index('idx_timestamp', XMLDB_INDEX_NOTUNIQUE, array('timestamp'));
        $table->add_index('idx_session', XMLDB_INDEX_NOTUNIQUE, array('session_id'));
        
        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }
        
        upgrade_mod_savepoint(true, 2025102115, 'researchflow');
    }
    
    // Version 2025102116: Add availability fields (startdate, duedate, enddate)
    if ($oldversion < 2025102116) {
        $table = new xmldb_table('researchflow');
        
        $field1 = new xmldb_field('startdate', XMLDB_TYPE_INTEGER, '10', null, null, null, null, 'edit_goal');
        $field2 = new xmldb_field('duedate', XMLDB_TYPE_INTEGER, '10', null, null, null, null, 'startdate');
        $field3 = new xmldb_field('enddate', XMLDB_TYPE_INTEGER, '10', null, null, null, null, 'duedate');
        
        if (!$dbman->field_exists($table, $field1)) {
            $dbman->add_field($table, $field1);
        }
        if (!$dbman->field_exists($table, $field2)) {
            $dbman->add_field($table, $field2);
        }
        if (!$dbman->field_exists($table, $field3)) {
            $dbman->add_field($table, $field3);
        }
        
        upgrade_mod_savepoint(true, 2025102116, 'researchflow');
    }
    
    // Version 2025102117: Add custom_outline field for instructor-defined outline structure
    if ($oldversion < 2025102117) {
        $table = new xmldb_table('researchflow');
        
        // Check if enddate exists to determine where to place custom_outline
        $enddateField = new xmldb_field('enddate');
        $enddateExists = $dbman->field_exists($table, $enddateField);
        
        // If enddate exists, add after it; otherwise add after edit_goal or timemodified
        $afterField = 'enddate';
        if (!$enddateExists) {
            // Check if edit_goal exists
            $editGoalField = new xmldb_field('edit_goal');
            if ($dbman->field_exists($table, $editGoalField)) {
                $afterField = 'edit_goal';
            } else {
                // Fallback to timemodified which should always exist
                $afterField = 'timemodified';
            }
        }
        
        $field = new xmldb_field('custom_outline', XMLDB_TYPE_TEXT, null, null, null, null, null, $afterField);
        
        if (!$dbman->field_exists($table, $field)) {
            $dbman->add_field($table, $field);
        }
        
        upgrade_mod_savepoint(true, 2025102117, 'researchflow');
    }
    
    // Version 2025102118: Add typed_content field to activity_log for word-level tracking
    if ($oldversion < 2025102118) {
        $table = new xmldb_table('researchflow_activity_log');
        $field = new xmldb_field('typed_content', XMLDB_TYPE_TEXT, null, null, null, null, null, 'pasted_content');
        
        if (!$dbman->field_exists($table, $field)) {
            $dbman->add_field($table, $field);
        }
        
        upgrade_mod_savepoint(true, 2025102118, 'researchflow');
    }
    
    // Version 2025052001: Moodle 5.0 compatibility upgrade
    if ($oldversion < 2025052001) {
        // Moodle 5.0 compatibility - no database changes required
        // This upgrade step ensures proper version tracking for Moodle 5.0
        upgrade_mod_savepoint(true, 2025052001, 'researchflow');
    }

    return true;
}
