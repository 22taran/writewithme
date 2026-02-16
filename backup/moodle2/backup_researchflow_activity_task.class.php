<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Define the backup_researchflow_activity_task class
 * @package    mod_researchflow
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/mod/researchflow/backup/moodle2/backup_researchflow_stepslib.php');

/**
 * researchflow backup task that provides all the settings and steps to perform one
 * complete backup of the activity
 * @package    mod_researchflow
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class backup_researchflow_activity_task extends backup_activity_task {

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
        // researchflow only has one structure step
        $this->add_step(new backup_researchflow_activity_structure_step('researchflow_structure', 'researchflow.xml'));
    }

    /**
     * Code the transformations to perform in the activity in
     * order to get transportable (encoded) links
     *
     * @param string $content HTML text that may contain URLs to the activity
     * @return string The content with URLs encoded for transport
     */
    static public function encode_content_links($content) {
        global $CFG;

        $base = preg_quote($CFG->wwwroot, "/");

        // Link to the list of researchflow activities in a course (matches restore rule RESEARCHFLOWINDEX)
        $search = "/(" . $base . "\/mod\/researchflow\/index.php\?id\=)([0-9]+)/";
        $content = preg_replace($search, '$@RESEARCHFLOWINDEX*$2@$', $content);

        // Link to researchflow view by course module id (matches restore rule RESEARCHFLOWVIEWBYID)
        $search = "/(" . $base . "\/mod\/researchflow\/view.php\?id\=)([0-9]+)/";
        $content = preg_replace($search, '$@RESEARCHFLOWVIEWBYID*$2@$', $content);

        return $content;
    }
}
