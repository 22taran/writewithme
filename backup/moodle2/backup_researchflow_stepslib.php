<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Define all the backup steps that will be used by the backup_researchflow_activity_task
 * @package    mod_researchflow
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Define the complete researchflow structure for backup, with file and id annotations
 * @package    mod_researchflow
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class backup_researchflow_activity_structure_step extends backup_activity_structure_step {

    protected function define_structure() {

        // To know if we are including userinfo
        $userinfo = $this->get_setting_value('userinfo');

        // Define each element separated
        $researchflow = new backup_nested_element('researchflow', array('id'), array(
            'name', 'intro', 'introformat', 'template', 'plan_goal', 'write_goal', 'edit_goal',
            'startdate', 'duedate', 'enddate', 'custom_outline',
            'timecreated', 'timemodified'));

        $works = new backup_nested_element('works');
        $work = new backup_nested_element('work', array('id'), array(
            'userid', 'content', 'timecreated', 'timemodified'));

        $ideas = new backup_nested_element('ideas');
        $idea = new backup_nested_element('idea', array('id'), array(
            'userid', 'content', 'location', 'section_id', 'ai_generated', 'created_at', 'modified_at'));

        $contents = new backup_nested_element('contents');
        $content = new backup_nested_element('content', array('id'), array(
            'userid', 'phase', 'content', 'word_count', 'created_at', 'modified_at'));

        $chat_sessions = new backup_nested_element('chat_sessions');
        $chat_session = new backup_nested_element('chat_session', array('id'), array(
            'userid', 'session_id', 'title', 'is_active', 'created_at', 'modified_at'));

        $chats = new backup_nested_element('chats');
        $chat = new backup_nested_element('chat', array('id'), array(
            'userid', 'chat_session_id', 'role', 'content', 'timestamp', 'created_at'));

        $metadatas = new backup_nested_element('metadatas');
        $metadata = new backup_nested_element('metadata', array('id'), array(
            'userid', 'title', 'description', 'current_tab', 'instructor_instructions', 'goal', 'plan_outline',
            'created_at', 'modified_at'));

        $versions = new backup_nested_element('versions');
        $version = new backup_nested_element('version', array('id'), array(
            'userid', 'phase', 'content', 'word_count', 'version_number', 'created_at', 'modified_by', 'change_summary'));

        $activity_logs = new backup_nested_element('activity_logs');
        $activity_log = new backup_nested_element('activity_log', array('id'), array(
            'userid', 'phase', 'action_type', 'content_length', 'word_count', 'pasted_content', 'pasted_length',
            'typed_content', 'typing_speed', 'session_id', 'timestamp', 'created_at'));

        // Build the tree
        $researchflow->add_child($works);
        $works->add_child($work);
        $researchflow->add_child($ideas);
        $ideas->add_child($idea);
        $researchflow->add_child($contents);
        $contents->add_child($content);
        $researchflow->add_child($chat_sessions);
        $chat_sessions->add_child($chat_session);
        $researchflow->add_child($chats);
        $chats->add_child($chat);
        $researchflow->add_child($metadatas);
        $metadatas->add_child($metadata);
        $researchflow->add_child($versions);
        $versions->add_child($version);
        $researchflow->add_child($activity_logs);
        $activity_logs->add_child($activity_log);

        // Define sources
        $researchflow->set_source_table('researchflow', array('id' => backup::VAR_ACTIVITYID));

        // All the other elements only happen if we are including user info
        if ($userinfo) {
            $work->set_source_table('researchflow_work', array('researchflowid' => backup::VAR_PARENTID));
            $idea->set_source_table('researchflow_ideas', array('researchflowid' => backup::VAR_PARENTID));
            $content->set_source_table('researchflow_content', array('researchflowid' => backup::VAR_PARENTID));
            $chat_session->set_source_table('researchflow_chat_sessions', array('researchflowid' => backup::VAR_PARENTID));
            $chat->set_source_table('researchflow_chat', array('researchflowid' => backup::VAR_PARENTID));
            $metadata->set_source_table('researchflow_metadata', array('researchflowid' => backup::VAR_PARENTID));
            $version->set_source_table('researchflow_versions', array('researchflowid' => backup::VAR_PARENTID));
            $activity_log->set_source_table('researchflow_activity_log', array('researchflowid' => backup::VAR_PARENTID));
        }

        // Define id annotations
        $work->annotate_ids('user', 'userid');
        $idea->annotate_ids('user', 'userid');
        $content->annotate_ids('user', 'userid');
        $chat_session->annotate_ids('user', 'userid');
        $chat->annotate_ids('user', 'userid');
        $metadata->annotate_ids('user', 'userid');
        $version->annotate_ids('user', 'userid');
        $version->annotate_ids('user', 'modified_by');
        $activity_log->annotate_ids('user', 'userid');

        // Define file annotations
        $researchflow->annotate_files('mod_researchflow', 'intro', null);

        // Return the root element (researchflow), wrapped into the activity structure
        return $this->prepare_activity_structure($researchflow);
    }
}
