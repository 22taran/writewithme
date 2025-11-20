<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Settings for the writeassistdev module
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

if ($ADMIN->fulltree) {
    $settings->add(new admin_setting_heading(
        'writeassistdev_settings',
        get_string('pluginname', 'mod_writeassistdev'),
        get_string('settingsdescription', 'mod_writeassistdev')
    ));

    $settings->add(new admin_setting_configtext(
        'mod_writeassistdev/api_endpoint',
        get_string('api_endpoint', 'mod_writeassistdev'),
        get_string('api_endpoint_desc', 'mod_writeassistdev'),
        '',
        PARAM_URL
    ));

}
