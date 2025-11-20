<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Define all the backup steps that will be used by the backup_writeassistdev_activity_task
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Define the complete writeassistdev structure for backup, with file and id annotations
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class backup_writeassistdev_activity_structure_step extends backup_activity_structure_step {

    protected function define_structure() {

        // To know if we are including userinfo
        $userinfo = $this->get_setting_value('userinfo');

        // Define each element separated
        $writeassistdev = new backup_nested_element('writeassistdev', array('id'), array(
            'name', 'intro', 'introformat', 'template', 'timecreated', 'timemodified'));

        $works = new backup_nested_element('works');
        $work = new backup_nested_element('work', array('id'), array(
            'userid', 'content', 'timecreated', 'timemodified'));

        // Build the tree
        $writeassistdev->add_child($works);
        $works->add_child($work);

        // Define sources
        $writeassistdev->set_source_table('writeassistdev', array('id' => backup::VAR_ACTIVITYID));

        // All the other elements only happen if we are including user info
        if ($userinfo) {
            $work->set_source_table('writeassistdev_work', array('writeassistdevid' => backup::VAR_PARENTID));
        }

        // Define id annotations
        $work->annotate_ids('user', 'userid');

        // Define file annotations
        $writeassistdev->annotate_files('mod_writeassistdev', 'intro', null);

        // Return the root element (writeassistdev), wrapped into the activity structure
        return $this->prepare_activity_structure($writeassistdev);
    }
}
