<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Course module viewed event for the writeassistdev module
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_writeassistdev\event;

defined('MOODLE_INTERNAL') || die();

/**
 * Course module viewed event class
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class course_module_viewed extends \core\event\course_module_viewed {

    /**
     * Initialize the event
     */
    protected function init() {
        $this->data['objecttable'] = 'writeassistdev';
        $this->data['crud'] = 'r';
        $this->data['edulevel'] = self::LEVEL_PARTICIPATING;
    }

    /**
     * Returns localised general event name
     *
     * @return string
     */
    public static function get_name() {
        return get_string('eventcoursemoduleviewed', 'mod_writeassistdev');
    }

    /**
     * Returns description of what happened
     *
     * @return string
     */
    public function get_description() {
        return "The user with id '$this->userid' viewed the AI Writing Assistant activity with course module id '$this->contextinstanceid'.";
    }

    /**
     * Returns relevant URL
     *
     * @return \moodle_url
     */
    public function get_url() {
        return new \moodle_url('/mod/writeassistdev/view.php', array('id' => $this->contextinstanceid));
    }

    /**
     * Return the legacy event log data
     *
     * @return array
     */
    protected function get_legacy_logdata() {
        return array($this->courseid, 'writeassistdev', 'view', 'view.php?id=' . $this->contextinstanceid,
            $this->objectid, $this->contextinstanceid);
    }
} 