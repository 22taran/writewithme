<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Settings for the researchflow module
 * @package    mod_researchflow
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

if ($ADMIN->fulltree) {
    $settings->add(new admin_setting_heading(
        'researchflow_settings',
        get_string('pluginname', 'mod_researchflow'),
        get_string('settingsdescription', 'mod_researchflow')
    ));

    $settings->add(new admin_setting_configtext(
        'mod_researchflow/api_endpoint',
        get_string('api_endpoint', 'mod_researchflow'),
        get_string('api_endpoint_desc', 'mod_researchflow'),
        '',
        PARAM_URL
    ));

    $settings->add(new admin_setting_configpasswordunmask(
        'mod_researchflow/api_key',
        get_string('api_key', 'mod_researchflow'),
        get_string('api_key_desc', 'mod_researchflow'),
        ''
    ));

}
