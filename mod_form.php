<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Definition of the form for the researchflow module
 * @package    mod_researchflow
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/course/moodleform_mod.php');

/**
 * Form for creating/editing a researchflow instance
 */
class mod_researchflow_mod_form extends moodleform_mod {

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
        $mform->addElement('editor', 'intro', get_string('description', 'mod_researchflow'));
        $mform->setType('intro', PARAM_RAW);

        // Adding template selector
        $templates = $this->get_available_templates();
        $mform->addElement('select', 'template', get_string('template', 'mod_researchflow'), $templates);
        $mform->setType('template', PARAM_TEXT);
        $mform->addHelpButton('template', 'template', 'mod_researchflow');
        $mform->setDefault('template', 'argumentative'); // Default to argumentative essay

        // Add instructor goals for each tab
        $mform->addElement('header', 'goals', get_string('goals', 'mod_researchflow'));
        
        $mform->addElement('textarea', 'plan_goal', get_string('plan_goal', 'mod_researchflow'), array('rows' => 3, 'cols' => 60));
        $mform->setType('plan_goal', PARAM_TEXT);
        $mform->addHelpButton('plan_goal', 'plan_goal', 'mod_researchflow');
        $mform->setDefault('plan_goal', '');
        
        $mform->addElement('textarea', 'write_goal', get_string('write_goal', 'mod_researchflow'), array('rows' => 3, 'cols' => 60));
        $mform->setType('write_goal', PARAM_TEXT);
        $mform->addHelpButton('write_goal', 'write_goal', 'mod_researchflow');
        $mform->setDefault('write_goal', '');
        
        $mform->addElement('textarea', 'edit_goal', get_string('edit_goal', 'mod_researchflow'), array('rows' => 3, 'cols' => 60));
        $mform->setType('edit_goal', PARAM_TEXT);
        $mform->addHelpButton('edit_goal', 'edit_goal', 'mod_researchflow');
        $mform->setDefault('edit_goal', '');

        // Outline Structure ---------------------------------------------------------
        $mform->addElement('header', 'outline', 'Outline Structure');
        $mform->setExpanded('outline', false);
        
        $outlinehelp = 'Define the outline sections that students will use for their assignment. Each section should have an id, title, description, required flag, and allowMultiple flag.';
        $mform->addElement('static', 'outline_help', '', $outlinehelp);
        
        // Default outline structure
        $defaultoutline = json_encode([
            [
                'id' => 'introduction',
                'title' => 'Introduction',
                'description' => 'Hook, background, and thesis statement',
                'required' => true,
                'allowMultiple' => false
            ],
            [
                'id' => 'main-arguments',
                'title' => 'Main Arguments',
                'description' => 'Your key points supporting your thesis',
                'required' => true,
                'allowMultiple' => true
            ],
            [
                'id' => 'conclusion',
                'title' => 'Conclusion',
                'description' => 'Restate thesis and summarize main points',
                'required' => true,
                'allowMultiple' => false
            ]
        ], JSON_PRETTY_PRINT);
        
        $mform->addElement('textarea', 'custom_outline', 'Outline Sections (JSON)', 
            array('rows' => 15, 'cols' => 80, 'wrap' => 'off'));
        $mform->setType('custom_outline', PARAM_RAW);
        $mform->addHelpButton('custom_outline', 'outline_structure', 'mod_researchflow');
        $mform->setDefault('custom_outline', $defaultoutline);

        // Availability ---------------------------------------------------------------
        $mform->addElement('header', 'accesscontrol', get_string('availability', 'core'));

        $mform->addElement('date_time_selector', 'startdate', 'Start date', array('optional' => true));
        $mform->addHelpButton('startdate', 'startdate', 'mod_researchflow');

        $mform->addElement('date_time_selector', 'duedate', 'Due date', array('optional' => true));
        $mform->addHelpButton('duedate', 'duedate', 'mod_researchflow');

        $mform->addElement('date_time_selector', 'enddate', 'End date', array('optional' => true));
        $mform->addHelpButton('enddate', 'enddate', 'mod_researchflow');

        // Get course context safely - check if course exists
        global $COURSE;
        $courseid = null;
        if (isset($this->course) && isset($this->course->id)) {
            $courseid = $this->course->id;
        } else if (isset($COURSE) && isset($COURSE->id)) {
            $courseid = $COURSE->id;
        }
        
        if ($courseid) {
            try {
                $coursecontext = context_course::instance($courseid);
                // To be removed (deprecated) with MDL-67526.
                if (!empty($CFG->enableplagiarism)) {
                    require_once($CFG->libdir . '/plagiarismlib.php');
                    plagiarism_get_form_elements_module($mform, $coursecontext, 'mod_researchflow');
                }
            } catch (Exception $e) {
                // Course context not available, skip plagiarism elements
                debugging('Could not get course context for plagiarism elements: ' . $e->getMessage(), DEBUG_NORMAL);
            }
        }

        // Common module settings, Restrict availability, Activity completion etc. ----
        $features = array('groups' => true, 'groupings' => true,
                'outcomes' => true, 'gradecat' => false, 'idnumber' => false);

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
        
        // Convert timestamp fields to date_time_selector format (array with enabled, year, month, day, hour, minute)
        if (isset($defaultvalues['startdate']) && is_numeric($defaultvalues['startdate'])) {
            $defaultvalues['startdate'] = array(
                'enabled' => 1,
                'year' => (int)date('Y', $defaultvalues['startdate']),
                'month' => (int)date('n', $defaultvalues['startdate']),
                'day' => (int)date('j', $defaultvalues['startdate']),
                'hour' => (int)date('G', $defaultvalues['startdate']),
                'minute' => (int)date('i', $defaultvalues['startdate'])
            );
        } else if (!isset($defaultvalues['startdate'])) {
            $defaultvalues['startdate'] = array('enabled' => 0);
        }
        
        if (isset($defaultvalues['duedate']) && is_numeric($defaultvalues['duedate'])) {
            $defaultvalues['duedate'] = array(
                'enabled' => 1,
                'year' => (int)date('Y', $defaultvalues['duedate']),
                'month' => (int)date('n', $defaultvalues['duedate']),
                'day' => (int)date('j', $defaultvalues['duedate']),
                'hour' => (int)date('G', $defaultvalues['duedate']),
                'minute' => (int)date('i', $defaultvalues['duedate'])
            );
        } else if (!isset($defaultvalues['duedate'])) {
            $defaultvalues['duedate'] = array('enabled' => 0);
        }
        
        if (isset($defaultvalues['enddate']) && is_numeric($defaultvalues['enddate'])) {
            $defaultvalues['enddate'] = array(
                'enabled' => 1,
                'year' => (int)date('Y', $defaultvalues['enddate']),
                'month' => (int)date('n', $defaultvalues['enddate']),
                'day' => (int)date('j', $defaultvalues['enddate']),
                'hour' => (int)date('G', $defaultvalues['enddate']),
                'minute' => (int)date('i', $defaultvalues['enddate'])
            );
        } else if (!isset($defaultvalues['enddate'])) {
            $defaultvalues['enddate'] = array('enabled' => 0);
        }
        
        // Handle custom_outline - ensure it's formatted nicely
        if (isset($defaultvalues['custom_outline']) && !empty($defaultvalues['custom_outline'])) {
            // Try to decode and re-encode to ensure proper formatting
            $decoded = json_decode($defaultvalues['custom_outline'], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $defaultvalues['custom_outline'] = json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            }
        } else if (!isset($defaultvalues['custom_outline'])) {
            // Set default outline if not set
            $defaultvalues['custom_outline'] = json_encode([
                [
                    'id' => 'introduction',
                    'title' => 'Introduction',
                    'description' => 'Hook, background, and thesis statement',
                    'required' => true,
                    'allowMultiple' => false
                ],
                [
                    'id' => 'main-arguments',
                    'title' => 'Main Arguments',
                    'description' => 'Your key points supporting your thesis',
                    'required' => true,
                    'allowMultiple' => true
                ],
                [
                    'id' => 'conclusion',
                    'title' => 'Conclusion',
                    'description' => 'Restate thesis and summarize main points',
                    'required' => true,
                    'allowMultiple' => false
                ]
            ], JSON_PRETTY_PRINT);
        }
    }

    /**
     * Get available templates for the selector
     *
     * @return array
     */
    private function get_available_templates() {
        global $CFG;
        
        $templates = array('' => get_string('select_template', 'mod_researchflow'));
        
        $templatesFile = $CFG->dirroot . '/mod/researchflow/data/templates/templates.json';
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
