<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Definition of the form for the writeassistdev module
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>
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
