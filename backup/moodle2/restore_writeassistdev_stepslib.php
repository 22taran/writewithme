<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Define all the restore steps that will be used by the restore_writeassistdev_activity_task
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Structure step to restore one writeassistdev activity
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class restore_writeassistdev_activity_structure_step extends restore_activity_structure_step {

    protected function define_structure() {

        $paths = array();
        $userinfo = $this->get_setting_value('userinfo');

        $paths[] = new restore_path_element('writeassistdev', '/activity/writeassistdev');
        if ($userinfo) {
            $paths[] = new restore_path_element('writeassistdev_work', '/activity/writeassistdev/works/work');
        }

        // Return the paths wrapped into standard activity structure
        return $this->prepare_activity_structure($paths);
    }

    protected function process_writeassistdev($data) {
        global $DB;

        $data = (object)$data;
        $oldid = $data->id;
        $data->course = $this->get_courseid();

        // Any changes to the list of dates that needs to be rolled should be same during the restore.
        $data->timecreated = $this->apply_date_offset($data->timecreated);
        $data->timemodified = $this->apply_date_offset($data->timemodified);

        // Insert the writeassistdev record
        $newitemid = $DB->insert_record('writeassistdev', $data);
        // Immediately after inserting "activity" record, call this
        $this->apply_activity_instance($newitemid);
    }

    protected function process_writeassistdev_work($data) {
        global $DB;

        $data = (object)$data;
        $oldid = $data->id;

        $data->writeassistdevid = $this->get_new_parentid('writeassistdev');
        $data->userid = $this->get_mappingid('user', $data->userid);
        $data->timecreated = $this->apply_date_offset($data->timecreated);
        $data->timemodified = $this->apply_date_offset($data->timemodified);

        $newitemid = $DB->insert_record('writeassistdev_work', $data);
        $this->set_mapping('writeassistdev_work', $oldid, $newitemid);
    }

    protected function after_execute() {
        // Add writeassistdev related files, no need to match by itemname (just internally handled context)
        $this->add_related_files('mod_writeassistdev', 'intro', null);
    }
}
