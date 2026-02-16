<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Version details
 * @package    mod_researchflow
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$plugin = new stdClass();
$plugin->version   = 2025052001;
$plugin->requires  = 2022041900; // Moodle 4.0 or later (compatible with 4.0, 4.1, 4.2, 4.3, 4.4, and 5.0)
$plugin->component = 'mod_researchflow';
$plugin->cron      = 0;
$plugin->maturity  = MATURITY_STABLE;
$plugin->release   = '5.0';
