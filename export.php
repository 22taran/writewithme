<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Export student work as DOCX or PDF
 * @package    mod_researchflow
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once('../../config.php');
require_once($CFG->dirroot . '/mod/researchflow/lib.php');
require_once($CFG->dirroot . '/mod/researchflow/classes/data/ProjectDataManager.php');

$id = required_param('id', PARAM_INT); // Course Module ID
$format = required_param('format', PARAM_ALPHA); // 'docx' or 'pdf'
$userid = optional_param('userid', 0, PARAM_INT); // Optional: for instructors viewing student work

if (!$cm = get_coursemodule_from_id('researchflow', $id, 0, false, MUST_EXIST)) {
    print_error('invalidcoursemodule');
}

$course = $DB->get_record('course', array('id' => $cm->course), '*', MUST_EXIST);
$instance = $DB->get_record('researchflow', ['id' => $cm->instance], '*', MUST_EXIST);

require_login($course, true, $cm);

$context = context_module::instance($cm->id);
require_capability('mod/researchflow:view', $context);

// Determine which user's work to export
$exportuserid = $userid ? $userid : $USER->id;

// If exporting another user's work, require instructor capability
if ($exportuserid != $USER->id) {
    require_capability('mod/researchflow:addinstance', $context);
}

// Load project data
$dataManager = new \mod_researchflow\data\ProjectDataManager();
$project = $dataManager->loadProject($instance->id, $exportuserid);

// Get content from 'edit' phase (final version), fallback to 'write' phase
$content = '';
$wordCount = 0;
if ($project && isset($project['edit']) && !empty($project['edit']['content'])) {
    $content = $project['edit']['content'];
    $wordCount = $project['edit']['wordCount'];
} elseif ($project && isset($project['write']) && !empty($project['write']['content'])) {
    $content = $project['write']['content'];
    $wordCount = $project['write']['wordCount'];
}

// Get user info
$user = $DB->get_record('user', ['id' => $exportuserid], '*', MUST_EXIST);

// Prepare filename
$filename = clean_filename($instance->name . '_' . fullname($user) . '_' . date('Y-m-d'));

// Strip HTML tags and clean content for export
$plaincontent = strip_tags($content);
$plaincontent = html_entity_decode($plaincontent, ENT_QUOTES, 'UTF-8');

if ($format === 'docx') {
    // Export as DOCX
    export_as_docx($instance, $user, $content, $filename);
} elseif ($format === 'pdf') {
    // Export as PDF
    export_as_pdf($instance, $user, $content, $filename);
} else {
    print_error('invalidformat');
}

/**
 * Export content as DOCX file
 */
function export_as_docx($instance, $user, $content, $filename) {
    // Create an HTML file that can be opened in Word (Word can open HTML files)
    // This is a simple approach that works without external libraries
    header('Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    header('Content-Disposition: attachment; filename="' . $filename . '.docx"');
    
    // Clean and prepare content - preserve formatting but ensure it's safe
    $content = clean_html_for_word($content);
    
    // Convert HTML to a Word-compatible format with comprehensive styling
    $html = '<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
    <meta charset="UTF-8">
    <meta name="ProgId" content="Word.Document">
    <meta name="Generator" content="Moodle AI Writing Assistant">
    <meta name="Originator" content="Moodle">
    <title>' . htmlspecialchars($instance->name) . '</title>
    <!--[if gte mso 9]>
    <xml>
        <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
        @page {
            size: 8.5in 11in;
            margin: 1in;
        }
        body {
            font-family: "Times New Roman", serif;
            font-size: 12pt;
            line-height: 1.5;
            margin: 0;
            padding: 0;
        }
        h1 {
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 12pt;
        }
        h2 {
            font-size: 14pt;
            font-weight: bold;
            margin-top: 12pt;
            margin-bottom: 10pt;
        }
        h3 {
            font-size: 13pt;
            font-weight: bold;
            margin-top: 10pt;
            margin-bottom: 8pt;
        }
        h4, h5, h6 {
            font-size: 12pt;
            font-weight: bold;
            margin-top: 8pt;
            margin-bottom: 6pt;
        }
        .info {
            font-size: 11pt;
            margin-bottom: 24pt;
        }
        p {
            margin: 0 0 12pt 0;
        }
        /* Preserve Quill editor formatting */
        strong, b {
            font-weight: bold;
        }
        em, i {
            font-style: italic;
        }
        u {
            text-decoration: underline;
        }
        s, strike {
            text-decoration: line-through;
        }
        ul, ol {
            margin: 12pt 0;
            padding-left: 30pt;
        }
        li {
            margin: 6pt 0;
        }
        blockquote {
            margin: 12pt 0;
            padding-left: 20pt;
            border-left: 3pt solid #ccc;
            font-style: italic;
        }
        code {
            font-family: "Courier New", monospace;
            background-color: #f5f5f5;
            padding: 2pt 4pt;
        }
        pre {
            font-family: "Courier New", monospace;
            background-color: #f5f5f5;
            padding: 12pt;
            margin: 12pt 0;
            white-space: pre-wrap;
        }
        /* Preserve inline styles from Quill */
        [style*="font-size"] {
            /* Preserve font sizes */
        }
        [style*="color"] {
            /* Preserve text colors */
        }
        [style*="background-color"] {
            /* Preserve background colors */
        }
        [style*="text-align"] {
            /* Preserve text alignment */
        }
        sub {
            vertical-align: sub;
            font-size: smaller;
        }
        sup {
            vertical-align: super;
            font-size: smaller;
        }
    </style>
</head>
<body>
    <h1>' . htmlspecialchars($instance->name) . '</h1>
    <div class="info">
        <p><strong>Student:</strong> ' . htmlspecialchars(fullname($user)) . '</p>
        <p><strong>Date:</strong> ' . date('F j, Y') . '</p>
    </div>
    <div class="content">' . $content . '</div>
</body>
</html>';
    
    echo $html;
    exit;
}

/**
 * Clean HTML content for Word export while preserving formatting
 */
function clean_html_for_word($html) {
    if (empty($html)) {
        return '';
    }
    
    // Decode HTML entities
    $html = html_entity_decode($html, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    
    // Remove Quill-specific classes that Word doesn't understand, but keep inline styles
    $html = preg_replace('/\s*class="[^"]*"/', '', $html);
    $html = preg_replace('/\s*data-[^=]*="[^"]*"/', '', $html);
    
    // Ensure proper paragraph structure - Word prefers <p> tags
    // Convert <br> tags to proper paragraph breaks where needed
    $html = preg_replace('/<br\s*\/?>\s*<br\s*\/?>/i', '</p><p>', $html);
    
    // Ensure content is wrapped in paragraphs if it's not already
    if (!preg_match('/^<[ph]/i', trim($html))) {
        $html = '<p>' . $html . '</p>';
    }
    
    // Clean up empty paragraphs
    $html = preg_replace('/<p>\s*<\/p>/i', '', $html);
    
    return $html;
}

/**
 * Export content as PDF file
 */
function export_as_pdf($instance, $user, $content, $filename) {
    global $CFG;
    
    // Check if TCPDF is available
    $tcpdfpath = $CFG->dirroot . '/lib/tcpdf/tcpdf.php';
    if (file_exists($tcpdfpath)) {
        require_once($tcpdfpath);
        
        $pdf = new TCPDF(PDF_PAGE_ORIENTATION, PDF_UNIT, PDF_PAGE_FORMAT, true, 'UTF-8', false);
        $pdf->SetCreator('Moodle AI Writing Assistant');
        $pdf->SetAuthor(fullname($user));
        $pdf->SetTitle($instance->name);
        $pdf->SetSubject('Student Assignment');
        
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(false);
        $pdf->AddPage();
        
        // Add title
        $pdf->SetFont('helvetica', 'B', 16);
        $pdf->Write(0, $instance->name, '', 0, 'L', true);
        $pdf->Ln(5);
        
        // Add student info
        $pdf->SetFont('helvetica', '', 11);
        $pdf->Write(0, 'Student: ' . fullname($user), '', 0, 'L', true);
        $pdf->Write(0, 'Date: ' . date('F j, Y'), '', 0, 'L', true);
        $pdf->Ln(10);
        
        // Clean and prepare HTML content for PDF
        $htmlcontent = clean_html_for_pdf($content);
        
        // Use writeHTML to preserve formatting instead of strip_tags
        $pdf->SetFont('times', '', 12);
        $pdf->writeHTML($htmlcontent, true, false, true, false, '');
        
        $pdf->Output($filename . '.pdf', 'D');
        exit;
    } else {
        // Fallback: Use browser's print to PDF with full formatting
        header('Content-Type: text/html; charset=UTF-8');
        
        // Clean content for display
        $htmlcontent = clean_html_for_pdf($content);
        
        echo '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>' . htmlspecialchars($instance->name) . '</title>
    <style>
        @media print {
            @page { margin: 1in; }
        }
        body { 
            font-family: "Times New Roman", serif; 
            font-size: 12pt; 
            line-height: 1.5; 
            margin: 1in; 
        }
        h1 { 
            font-size: 16pt; 
            font-weight: bold; 
            margin-bottom: 12pt; 
        }
        h2 {
            font-size: 14pt;
            font-weight: bold;
            margin-top: 12pt;
            margin-bottom: 10pt;
        }
        h3 {
            font-size: 13pt;
            font-weight: bold;
            margin-top: 10pt;
            margin-bottom: 8pt;
        }
        .info { 
            font-size: 11pt; 
            margin-bottom: 24pt; 
        }
        p {
            margin: 0 0 12pt 0;
        }
        strong, b {
            font-weight: bold;
        }
        em, i {
            font-style: italic;
        }
        u {
            text-decoration: underline;
        }
        s, strike {
            text-decoration: line-through;
        }
        ul, ol {
            margin: 12pt 0;
            padding-left: 30pt;
        }
        li {
            margin: 6pt 0;
        }
        blockquote {
            margin: 12pt 0;
            padding-left: 20pt;
            border-left: 3pt solid #ccc;
            font-style: italic;
        }
        code {
            font-family: "Courier New", monospace;
            background-color: #f5f5f5;
            padding: 2pt 4pt;
        }
        pre {
            font-family: "Courier New", monospace;
            background-color: #f5f5f5;
            padding: 12pt;
            margin: 12pt 0;
            white-space: pre-wrap;
        }
    </style>
    <script>
        window.onload = function() {
            window.print();
        };
    </script>
</head>
<body>
    <h1>' . htmlspecialchars($instance->name) . '</h1>
    <div class="info">
        <p><strong>Student:</strong> ' . htmlspecialchars(fullname($user)) . '</p>
        <p><strong>Date:</strong> ' . date('F j, Y') . '</p>
    </div>
    <div class="content">' . $htmlcontent . '</div>
</body>
</html>';
        exit;
    }
}

/**
 * Clean HTML content for PDF export while preserving formatting
 */
function clean_html_for_pdf($html) {
    if (empty($html)) {
        return '';
    }
    
    // Decode HTML entities
    $html = html_entity_decode($html, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    
    // Remove Quill-specific attributes that PDF renderers don't understand
    $html = preg_replace('/\s*class="[^"]*"/', '', $html);
    $html = preg_replace('/\s*data-[^=]*="[^"]*"/', '', $html);
    
    // Ensure proper paragraph structure
    $html = preg_replace('/<br\s*\/?>\s*<br\s*\/?>/i', '</p><p>', $html);
    
    // Clean up empty paragraphs
    $html = preg_replace('/<p>\s*<\/p>/i', '', $html);
    
    // Ensure content is wrapped if needed
    if (!preg_match('/^<[ph]/i', trim($html))) {
        $html = '<p>' . $html . '</p>';
    }
    
    // Add basic styling for better PDF rendering
    // Wrap content in a div with basic styles that TCPDF can understand
    $html = '<div style="font-family: times; font-size: 12pt; line-height: 1.5;">' . $html . '</div>';
    
    return $html;
}
