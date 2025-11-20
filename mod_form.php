<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Definition of the form for the writeassistdev module
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/course/moodleform_mod.php');

/**
 * Form for creating/editing a writeassistdev instance
 */
class mod_writeassistdev_mod_form extends moodleform_mod {

    /**
     * Defines the form elements
     */
    public function definition() {
        // CRITICAL: Ensure goal fields exist in defaultvalues BEFORE form definition
        // This prevents YUI form JavaScript errors when fields are missing
        // Moodle's YUI form system initializes fields based on defaultvalues
        // If fields don't exist, it tries to access null.field.setAttribute and fails
        if ($this->_instance && isset($this->_defaultvalues)) {
            // We're editing an existing instance - ensure goal fields exist
            if (!array_key_exists('plan_goal', $this->_defaultvalues)) {
                $this->_defaultvalues['plan_goal'] = '';
            }
            if (!array_key_exists('write_goal', $this->_defaultvalues)) {
                $this->_defaultvalues['write_goal'] = '';
            }
            if (!array_key_exists('edit_goal', $this->_defaultvalues)) {
                $this->_defaultvalues['edit_goal'] = '';
            }
            // Also ensure they're not null
            if ($this->_defaultvalues['plan_goal'] === null) {
                $this->_defaultvalues['plan_goal'] = '';
            }
            if ($this->_defaultvalues['write_goal'] === null) {
                $this->_defaultvalues['write_goal'] = '';
            }
            if ($this->_defaultvalues['edit_goal'] === null) {
                $this->_defaultvalues['edit_goal'] = '';
            }
        }
        
        $mform = $this->_form;

        // Adding the "general" fieldset, where all the common settings are shown.
        $mform->addElement('header', 'general', get_string('general', 'form'));

        // Adding the standard "name" field.
        $mform->addElement('text', 'name', get_string('name'), array('size' => '64'));
        $mform->setType('name', PARAM_TEXT);
        $mform->addRule('name', null, 'required', null, 'client');

        // Adding the standard "intro" field.
        $mform->addElement('editor', 'intro', get_string('description', 'mod_writeassistdev'));
        $mform->setType('intro', PARAM_RAW);

        // Adding template selector
        $templates = $this->get_available_templates();
        $mform->addElement('select', 'template', get_string('template', 'mod_writeassistdev'), $templates);
        $mform->setType('template', PARAM_TEXT);
        $mform->addHelpButton('template', 'template', 'mod_writeassistdev');
        $mform->setDefault('template', 'argumentative'); // Default to argumentative essay

        // Add instructor goals for each tab
        $mform->addElement('header', 'goals', get_string('goals', 'mod_writeassistdev'));
        
        $mform->addElement('textarea', 'plan_goal', get_string('plan_goal', 'mod_writeassistdev'), array('rows' => 3, 'cols' => 60));
        $mform->setType('plan_goal', PARAM_TEXT);
        $mform->addHelpButton('plan_goal', 'plan_goal', 'mod_writeassistdev');
        $mform->setDefault('plan_goal', '');
        
        $mform->addElement('textarea', 'write_goal', get_string('write_goal', 'mod_writeassistdev'), array('rows' => 3, 'cols' => 60));
        $mform->setType('write_goal', PARAM_TEXT);
        $mform->addHelpButton('write_goal', 'write_goal', 'mod_writeassistdev');
        $mform->setDefault('write_goal', '');
        
        $mform->addElement('textarea', 'edit_goal', get_string('edit_goal', 'mod_writeassistdev'), array('rows' => 3, 'cols' => 60));
        $mform->setType('edit_goal', PARAM_TEXT);
        $mform->addHelpButton('edit_goal', 'edit_goal', 'mod_writeassistdev');
        $mform->setDefault('edit_goal', '');

        // Add standard elements, common to all modules.
        $this->standard_coursemodule_elements();

        // Add standard buttons, common to all modules.
        $this->add_action_buttons();
    }

    /**
     * Preprocessing form data
     *
     * @param array $defaultvalues
     */
    public function data_preprocessing(&$defaultvalues) {
        parent::data_preprocessing($defaultvalues);

        if (isset($defaultvalues['intro'])) {
            $defaultvalues['intro'] = array(
                'text' => $defaultvalues['intro'],
                'format' => $defaultvalues['introformat']
            );
        }
        
        // CRITICAL: Ensure goal fields are ALWAYS present in the array with string values
        // Moodle's form JavaScript requires all form fields to exist in $defaultvalues
        // If a field is missing entirely, YUI form init will fail with "null is not an object"
        // This prevents "TypeError: null is not an object (evaluating 'this.field.setAttribute')"
        
        // Always set these fields, even if they don't exist in the database record
        if (!array_key_exists('plan_goal', $defaultvalues)) {
            $defaultvalues['plan_goal'] = '';
        }
        if (!array_key_exists('write_goal', $defaultvalues)) {
            $defaultvalues['write_goal'] = '';
        }
        if (!array_key_exists('edit_goal', $defaultvalues)) {
            $defaultvalues['edit_goal'] = '';
        }
        
        // Convert null to empty string (in case field exists but is null)
        $defaultvalues['plan_goal'] = ($defaultvalues['plan_goal'] !== null) ? (string)$defaultvalues['plan_goal'] : '';
        $defaultvalues['write_goal'] = ($defaultvalues['write_goal'] !== null) ? (string)$defaultvalues['write_goal'] : '';
        $defaultvalues['edit_goal'] = ($defaultvalues['edit_goal'] !== null) ? (string)$defaultvalues['edit_goal'] : '';
    }

    /**
     * Get available templates for the selector
     *
     * @return array
     */
    private function get_available_templates() {
        global $CFG;
        
        $templates = array('' => get_string('select_template', 'mod_writeassistdev'));
        
        $templatesFile = $CFG->dirroot . '/mod/writeassistdev/data/templates/templates.json';
        if (file_exists($templatesFile)) {
            $templatesData = json_decode(file_get_contents($templatesFile), true);
            if (isset($templatesData['templates'])) {
                foreach ($templatesData['templates'] as $template) {
                    $templates[$template['id']] = $template['name'] . ' - ' . $template['description'];
                }
            }
        }
        
        return $templates;
    }
}
