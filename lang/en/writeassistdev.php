<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Language strings for AI Writing Assistant module
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

$string['modulename'] = 'AI Writing Assistant';
$string['modulenameplural'] = 'AI Writing Assistants';
$string['modulename_help'] = 'The AI Writing Assistant module provides students with an AI-powered tool to help with writing tasks, including planning, writing, and editing.';
$string['pluginname'] = 'AI Writing Assistant';

// Capability strings
$string['writeassistdev:addinstance'] = 'Add a new AI Writing Assistant';
$string['writeassistdev:view'] = 'View AI Writing Assistant';
$string['writeassistdev:submit'] = 'Submit work to AI Writing Assistant';

// Activity view strings
$string['ai_writing_assistant'] = 'AI Writing Assistant';
$string['plan_organize'] = 'Plan & Organize';
$string['write'] = 'Write';
$string['edit_revise'] = 'Edit & Revise';
$string['clear'] = 'Clear';
$string['regenerate'] = 'Regenerate';
$string['send'] = 'Send';
$string['ask_for_help'] = 'Ask for help with your writing...';
$string['clear_chat'] = 'Clear chat';
$string['regenerate_response'] = 'Regenerate last AI response';
$string['select_template'] = 'Select a template...';
$string['brainstorm'] = 'Brainstorm';
$string['add_idea'] = 'Add Idea';
$string['outline'] = 'Outline';
$string['my_outline'] = 'My Outline';

// Form strings
$string['description'] = 'Description';
$string['template'] = 'Writing Template';
$string['template_help'] = 'Select a writing template that will guide students through the writing process. This template will be automatically loaded when students access the activity.';
$string['goals'] = 'Assignment Goals';
$string['plan_goal'] = 'Plan & Organize Goal';
$string['plan_goal_help'] = 'Enter the goal for the Plan & Organize phase. This will be displayed to students in read-only mode.';
$string['write_goal'] = 'Write Goal';
$string['write_goal_help'] = 'Enter the goal for the Write phase. This will be displayed to students in read-only mode.';
$string['edit_goal'] = 'Edit & Revise Goal';
$string['edit_goal_help'] = 'Enter the goal for the Edit & Revise phase. This will be displayed to students in read-only mode.';

// Settings strings
$string['settingsdescription'] = 'Configure settings for the AI Writing Assistant module.';
$string['api_endpoint'] = 'API Endpoint';
$string['api_endpoint_desc'] = 'The URL endpoint for the AI API service (required). Example: http://your-server:5004. AI features will not work until this is configured.';
$string['api_key'] = 'API Key';
$string['api_key_desc'] = 'The API key for authenticating with the AI service.';
$string['enabled'] = 'Enabled';
$string['enabled_desc'] = 'Enable or disable the AI Writing Assistant module.';

// Error messages
$string['error_no_api_key'] = 'API key not configured. Please contact your administrator.';
$string['error_api_unavailable'] = 'AI service is currently unavailable. Please try again later.';
$string['error_invalid_response'] = 'Invalid response from AI service.';

// Success messages
$string['success_saved'] = 'Your work has been saved successfully.';
$string['success_submitted'] = 'Your work has been submitted successfully.';

// Event strings
$string['eventcoursemoduleviewed'] = 'Course module viewed';

// Page type strings
$string['page-mod-writeassistdev-x'] = 'Any AI Writing Assistant module page';
