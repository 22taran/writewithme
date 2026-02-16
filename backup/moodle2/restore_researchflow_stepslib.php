<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Define all the restore steps that will be used by the restore_researchflow_activity_task
 * @package    mod_researchflow
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Structure step to restore one researchflow activity
 * @package    mod_researchflow
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class restore_researchflow_activity_structure_step extends restore_activity_structure_step {

    protected function define_structure() {

        $paths = array();
        $userinfo = $this->get_setting_value('userinfo');

        $paths[] = new restore_path_element('researchflow', '/activity/researchflow');
        if ($userinfo) {
            $paths[] = new restore_path_element('researchflow_work', '/activity/researchflow/works/work');
            $paths[] = new restore_path_element('researchflow_idea', '/activity/researchflow/ideas/idea');
            $paths[] = new restore_path_element('researchflow_content', '/activity/researchflow/contents/content');
            $paths[] = new restore_path_element('researchflow_chat_session', '/activity/researchflow/chat_sessions/chat_session');
            $paths[] = new restore_path_element('researchflow_chat', '/activity/researchflow/chats/chat');
            $paths[] = new restore_path_element('researchflow_metadata', '/activity/researchflow/metadatas/metadata');
            $paths[] = new restore_path_element('researchflow_version', '/activity/researchflow/versions/version');
            $paths[] = new restore_path_element('researchflow_activity_log', '/activity/researchflow/activity_logs/activity_log');
        }

        // Return the paths wrapped into standard activity structure
        return $this->prepare_activity_structure($paths);
    }

    protected function process_researchflow($data) {
        global $DB;

        $data = (object)$data;
        $oldid = $data->id;
        $data->course = $this->get_courseid();

        // Apply date offsets for timestamps
        $data->timecreated = $this->apply_date_offset($data->timecreated);
        $data->timemodified = $this->apply_date_offset($data->timemodified);
        if (isset($data->startdate) && !empty($data->startdate)) {
            $data->startdate = $this->apply_date_offset($data->startdate);
        }
        if (isset($data->duedate) && !empty($data->duedate)) {
            $data->duedate = $this->apply_date_offset($data->duedate);
        }
        if (isset($data->enddate) && !empty($data->enddate)) {
            $data->enddate = $this->apply_date_offset($data->enddate);
        }

        // Insert the researchflow record
        $newitemid = $DB->insert_record('researchflow', $data);
        // Immediately after inserting "activity" record, call this
        $this->apply_activity_instance($newitemid);
    }

    protected function process_researchflow_work($data) {
        global $DB;

        $data = (object)$data;
        $oldid = $data->id;

        $data->researchflowid = $this->get_new_parentid('researchflow');
        $data->userid = $this->get_mappingid('user', $data->userid);
        $data->timecreated = $this->apply_date_offset($data->timecreated);
        $data->timemodified = $this->apply_date_offset($data->timemodified);

        $newitemid = $DB->insert_record('researchflow_work', $data);
        $this->set_mapping('researchflow_work', $oldid, $newitemid);
    }

    protected function process_researchflow_idea($data) {
        global $DB;

        $data = (object)$data;
        $data->researchflowid = $this->get_new_parentid('researchflow');
        $data->userid = $this->get_mappingid('user', $data->userid);
        $data->created_at = $this->apply_date_offset($data->created_at);
        $data->modified_at = $this->apply_date_offset($data->modified_at);

        $DB->insert_record('researchflow_ideas', $data);
    }

    protected function process_researchflow_content($data) {
        global $DB;

        $data = (object)$data;
        $data->researchflowid = $this->get_new_parentid('researchflow');
        $data->userid = $this->get_mappingid('user', $data->userid);
        $data->created_at = $this->apply_date_offset($data->created_at);
        $data->modified_at = $this->apply_date_offset($data->modified_at);

        $DB->insert_record('researchflow_content', $data);
    }

    protected function process_researchflow_chat_session($data) {
        global $DB;

        $data = (object)$data;
        $data->researchflowid = $this->get_new_parentid('researchflow');
        $data->userid = $this->get_mappingid('user', $data->userid);
        $data->created_at = $this->apply_date_offset($data->created_at);
        $data->modified_at = $this->apply_date_offset($data->modified_at);

        $DB->insert_record('researchflow_chat_sessions', $data);
    }

    protected function process_researchflow_chat($data) {
        global $DB;

        $data = (object)$data;
        $data->researchflowid = $this->get_new_parentid('researchflow');
        $data->userid = $this->get_mappingid('user', $data->userid);
        $data->timestamp = $this->apply_date_offset($data->timestamp);
        $data->created_at = $this->apply_date_offset($data->created_at);

        $DB->insert_record('researchflow_chat', $data);
    }

    protected function process_researchflow_metadata($data) {
        global $DB;

        $data = (object)$data;
        $data->researchflowid = $this->get_new_parentid('researchflow');
        $data->userid = $this->get_mappingid('user', $data->userid);
        $data->created_at = $this->apply_date_offset($data->created_at);
        $data->modified_at = $this->apply_date_offset($data->modified_at);

        $DB->insert_record('researchflow_metadata', $data);
    }

    protected function process_researchflow_version($data) {
        global $DB;

        $data = (object)$data;
        $data->researchflowid = $this->get_new_parentid('researchflow');
        $data->userid = $this->get_mappingid('user', $data->userid);
        $data->created_at = $this->apply_date_offset($data->created_at);
        if (!empty($data->modified_by)) {
            $data->modified_by = $this->get_mappingid('user', $data->modified_by);
        }

        $DB->insert_record('researchflow_versions', $data);
    }

    protected function process_researchflow_activity_log($data) {
        global $DB;

        $data = (object)$data;
        $data->researchflowid = $this->get_new_parentid('researchflow');
        $data->userid = $this->get_mappingid('user', $data->userid);
        $data->timestamp = $this->apply_date_offset($data->timestamp);
        $data->created_at = $this->apply_date_offset($data->created_at);

        $DB->insert_record('researchflow_activity_log', $data);
    }

    protected function after_execute() {
        // Add researchflow related files, no need to match by itemname (just internally handled context)
        $this->add_related_files('mod_researchflow', 'intro', null);
    }
}
