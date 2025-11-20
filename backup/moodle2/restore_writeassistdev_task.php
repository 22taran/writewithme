<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Define the restore_writeassistdev_activity_task class
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/mod/writeassistdev/backup/moodle2/restore_writeassistdev_stepslib.php');

/**
 * writeassistdev restore task that provides all the settings and steps to perform one
 * complete restore of the activity
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class restore_writeassistdev_activity_task extends restore_activity_task {

    /**
     * Define (add) particular settings this activity can have
     */
    protected function define_my_settings() {
        // No particular settings for this activity
    }

    /**
     * Define (add) particular steps this activity can have
     */
    protected function define_my_steps() {
        // writeassistdev only has one structure step
        $this->add_step(new restore_writeassistdev_activity_structure_step('writeassistdev_activity'));
    }

    /**
     * Define the contents in the activity that must be
     * processed by the link decoder
     */
    static public function define_decode_contents() {
        $contents = array();

        $contents[] = new restore_decode_content('writeassistdev', array('intro'), 'writeassistdev');

        return $contents;
    }

    /**
     * Define the decoding rules for links belonging
     * to the activity to be executed by the link decoder
     */
    static public function define_decode_rules() {
        $rules = array();

        $rules[] = new restore_decode_rule('writeassistdevVIEWBYID', '/mod/writeassistdev/view.php?id=$1', 'course_module');
        $rules[] = new restore_decode_rule('writeassistdevINDEX', '/mod/writeassistdev/index.php?id=$1', 'course');

        return $rules;
    }

    /**
     * Define the restore log rules that will be applied
     * by the {@link restore_logs_processor} when restoring
     * writeassistdev logs. It must return one array
     * of {@link restore_log_rule} objects
     */
    static public function define_restore_log_rules() {
        $rules = array();

        $rules[] = new restore_log_rule('writeassistdev', 'add', 'view.php?id={course_module}', '{writeassistdev}');
        $rules[] = new restore_log_rule('writeassistdev', 'update', 'view.php?id={course_module}', '{writeassistdev}');
        $rules[] = new restore_log_rule('writeassistdev', 'view', 'view.php?id={course_module}', '{writeassistdev}');

        return $rules;
    }

    /**
     * Define the restore log rules that will be applied
     * by the {@link restore_logs_processor} when restoring
     * course logs. It must return one array
     * of {@link restore_log_rule} objects
     */
    static public function define_restore_log_rules_for_course() {
        $rules = array();

        $rules[] = new restore_log_rule('writeassistdev', 'view all', 'index.php?id={course}', null);

        return $rules;
    }
}
