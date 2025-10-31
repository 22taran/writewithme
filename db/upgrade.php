<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Database upgrade script for writeassistdev module
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Upgrade function for writeassistdev module
 * @param int $oldversion The old version number
 * @return bool Success status
 */
function xmldb_writeassistdev_upgrade($oldversion) {
    global $DB;
    
    $dbman = $DB->get_manager();
    
    // Version 2025102103: Add normalized tables for data migration
    if ($oldversion < 2025102103) {
        
        // Create ideas table
        $table = new xmldb_table('writeassistdev_ideas');
        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('writeassistdevid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('content', XMLDB_TYPE_TEXT, null, null, XMLDB_NOTNULL, null, null);
        $table->add_field('location', XMLDB_TYPE_CHAR, '20', null, XMLDB_NOTNULL, null, null);
        $table->add_field('section_id', XMLDB_TYPE_CHAR, '50', null, null, null, null);
        $table->add_field('ai_generated', XMLDB_TYPE_INTEGER, '1', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('created_at', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('modified_at', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        
        $table->add_key('primary', XMLDB_KEY_PRIMARY, array('id'));
        $table->add_key('user_fk', XMLDB_KEY_FOREIGN, array('userid'), 'user', array('id'));
        $table->add_key('writeassistdev_fk', XMLDB_KEY_FOREIGN, array('writeassistdevid'), 'writeassistdev', array('id'));
        
        $table->add_index('idx_user_activity', XMLDB_INDEX_NOTUNIQUE, array('userid', 'writeassistdevid'));
        $table->add_index('idx_location', XMLDB_INDEX_NOTUNIQUE, array('location'));
        $table->add_index('idx_ai_generated', XMLDB_INDEX_NOTUNIQUE, array('ai_generated'));
        
        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }
        
        // Create content table
        $table = new xmldb_table('writeassistdev_content');
        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('writeassistdevid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('phase', XMLDB_TYPE_CHAR, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('content', XMLDB_TYPE_TEXT, null, null, null, null, null);
        $table->add_field('word_count', XMLDB_TYPE_INTEGER, '10', null, null, null, '0');
        $table->add_field('created_at', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('modified_at', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        
        $table->add_key('primary', XMLDB_KEY_PRIMARY, array('id'));
        $table->add_key('user_fk', XMLDB_KEY_FOREIGN, array('userid'), 'user', array('id'));
        $table->add_key('writeassistdev_fk', XMLDB_KEY_FOREIGN, array('writeassistdevid'), 'writeassistdev', array('id'));
        $table->add_key('unique_user_phase', XMLDB_KEY_UNIQUE, array('writeassistdevid', 'userid', 'phase'));
        
        $table->add_index('idx_word_count', XMLDB_INDEX_NOTUNIQUE, array('word_count'));
        $table->add_index('idx_phase', XMLDB_INDEX_NOTUNIQUE, array('phase'));
        
        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }
        
        // Create chat table
        $table = new xmldb_table('writeassistdev_chat');
        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('writeassistdevid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('chat_session_id', XMLDB_TYPE_CHAR, '50', null, XMLDB_NOTNULL, null, null);
        $table->add_field('role', XMLDB_TYPE_CHAR, '20', null, XMLDB_NOTNULL, null, null);
        $table->add_field('content', XMLDB_TYPE_TEXT, null, null, XMLDB_NOTNULL, null, null);
        $table->add_field('timestamp', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('created_at', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        
        $table->add_key('primary', XMLDB_KEY_PRIMARY, array('id'));
        $table->add_key('user_fk', XMLDB_KEY_FOREIGN, array('userid'), 'user', array('id'));
        $table->add_key('writeassistdev_fk', XMLDB_KEY_FOREIGN, array('writeassistdevid'), 'writeassistdev', array('id'));
        
        $table->add_index('idx_user_activity', XMLDB_INDEX_NOTUNIQUE, array('userid', 'writeassistdevid'));
        $table->add_index('idx_chat_session', XMLDB_INDEX_NOTUNIQUE, array('chat_session_id'));
        $table->add_index('idx_timestamp', XMLDB_INDEX_NOTUNIQUE, array('timestamp'));
        $table->add_index('idx_role', XMLDB_INDEX_NOTUNIQUE, array('role'));
        
        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }
        
        // Create chat sessions table for metadata
        $table = new xmldb_table('writeassistdev_chat_sessions');
        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('writeassistdevid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('session_id', XMLDB_TYPE_CHAR, '50', null, XMLDB_NOTNULL, null, null);
        $table->add_field('title', XMLDB_TYPE_CHAR, '255', null, null, null, 'New Chat');
        $table->add_field('is_active', XMLDB_TYPE_INTEGER, '1', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('created_at', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('modified_at', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        
        $table->add_key('primary', XMLDB_KEY_PRIMARY, array('id'));
        $table->add_key('user_fk', XMLDB_KEY_FOREIGN, array('userid'), 'user', array('id'));
        $table->add_key('writeassistdev_fk', XMLDB_KEY_FOREIGN, array('writeassistdevid'), 'writeassistdev', array('id'));
        $table->add_key('unique_session', XMLDB_KEY_UNIQUE, array('writeassistdevid', 'userid', 'session_id'));
        
        $table->add_index('idx_user_activity', XMLDB_INDEX_NOTUNIQUE, array('userid', 'writeassistdevid'));
        $table->add_index('idx_session_id', XMLDB_INDEX_NOTUNIQUE, array('session_id'));
        $table->add_index('idx_is_active', XMLDB_INDEX_NOTUNIQUE, array('is_active'));
        
        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }
        
        // Create metadata table
        $table = new xmldb_table('writeassistdev_metadata');
        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('writeassistdevid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('title', XMLDB_TYPE_CHAR, '255', null, null, null, null);
        $table->add_field('description', XMLDB_TYPE_TEXT, null, null, null, null, null);
        $table->add_field('current_tab', XMLDB_TYPE_CHAR, '20', null, null, null, 'plan');
        $table->add_field('instructor_instructions', XMLDB_TYPE_TEXT, null, null, null, null, null);
        $table->add_field('created_at', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        $table->add_field('modified_at', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
        
        $table->add_key('primary', XMLDB_KEY_PRIMARY, array('id'));
        $table->add_key('user_fk', XMLDB_KEY_FOREIGN, array('userid'), 'user', array('id'));
        $table->add_key('writeassistdev_fk', XMLDB_KEY_FOREIGN, array('writeassistdevid'), 'writeassistdev', array('id'));
        $table->add_key('unique_user_activity', XMLDB_KEY_UNIQUE, array('writeassistdevid', 'userid'));
        
        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }
        
        upgrade_mod_savepoint(true, 2025102103, 'writeassistdev');
    }
    
    // Version 2025102106: Add content version history table
    if ($oldversion < 2025102106) {
        // Create content versions table
        $table = new xmldb_table('writeassistdev_versions');
        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('writeassistdevid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
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
        $table->add_key('writeassistdev_fk', XMLDB_KEY_FOREIGN, array('writeassistdevid'), 'writeassistdev', array('id'));
        $table->add_key('modified_by_fk', XMLDB_KEY_FOREIGN, array('modified_by'), 'user', array('id'));
        
        $table->add_index('idx_user_activity_phase', XMLDB_INDEX_NOTUNIQUE, array('writeassistdevid', 'userid', 'phase'));
        $table->add_index('idx_version_number', XMLDB_INDEX_NOTUNIQUE, array('version_number'));
        $table->add_index('idx_created_at', XMLDB_INDEX_NOTUNIQUE, array('created_at'));
        
        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }
        
        upgrade_mod_savepoint(true, 2025102106, 'writeassistdev');
    }
    
    return true;
}
