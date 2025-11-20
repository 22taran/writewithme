<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * CLI script to check migration status
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('CLI_SCRIPT', true);

require_once(__DIR__ . '/../../../config.php');
require_once($CFG->libdir . '/clilib.php');

$usage = "Usage: php check_migration_status.php [options]\n";
$usage .= "Options:\n";
$usage .= "  --json    Output in JSON format\n";
$usage .= "  --help, -h    Show this help message\n";

list($options, $unrecognized) = cli_get_params([
    'json' => false,
    'help' => false
], [
    'h' => 'help'
]);

if ($options['help']) {
    echo $usage;
    exit(0);
}

echo "Migration Status Report\n";
echo "======================\n\n";

// Count total records in old format
$oldRecords = $DB->count_records('writeassistdev_work');
echo "Records in old format (JSON blob): $oldRecords\n";

// Count records in new format
$newMetadata = $DB->count_records('writeassistdev_metadata');
$newIdeas = $DB->count_records('writeassistdev_ideas');
$newContent = $DB->count_records('writeassistdev_content');
$newChat = $DB->count_records('writeassistdev_chat');

echo "Records in new format:\n";
echo "  Metadata: $newMetadata\n";
echo "  Ideas: $newIdeas\n";
echo "  Content: $newContent\n";
echo "  Chat: $newChat\n\n";

// Check for data integrity
echo "Data Integrity Checks:\n";

// Check for orphaned records
$orphanedIdeas = $DB->count_records_sql("
    SELECT COUNT(*) FROM {writeassistdev_ideas} i 
    LEFT JOIN {writeassistdev} w ON i.writeassistdevid = w.id 
    WHERE w.id IS NULL
");
echo "  Orphaned ideas: $orphanedIdeas\n";

$orphanedContent = $DB->count_records_sql("
    SELECT COUNT(*) FROM {writeassistdev_content} c 
    LEFT JOIN {writeassistdev} w ON c.writeassistdevid = w.id 
    WHERE w.id IS NULL
");
echo "  Orphaned content: $orphanedContent\n";

$orphanedChat = $DB->count_records_sql("
    SELECT COUNT(*) FROM {writeassistdev_chat} c 
    LEFT JOIN {writeassistdev} w ON c.writeassistdevid = w.id 
    WHERE w.id IS NULL
");
echo "  Orphaned chat: $orphanedChat\n";

// Check for missing data
$missingMetadata = $DB->count_records_sql("
    SELECT COUNT(*) FROM {writeassistdev_work} w 
    LEFT JOIN {writeassistdev_metadata} m ON w.writeassistdevid = m.writeassistdevid AND w.userid = m.userid 
    WHERE m.id IS NULL
");
echo "  Missing metadata: $missingMetadata\n";

// Calculate migration percentage
$totalOldRecords = $oldRecords;
$totalNewRecords = $newMetadata;
$migrationPercentage = $totalOldRecords > 0 ? round(($totalNewRecords / $totalOldRecords) * 100, 2) : 0;

echo "\nMigration Progress:\n";
echo "  Migrated: $totalNewRecords / $totalOldRecords ($migrationPercentage%)\n";

echo "\nMigration Status: ";
if ($missingMetadata == 0 && $orphanedIdeas == 0 && $orphanedContent == 0 && $orphanedChat == 0) {
    echo "✓ COMPLETE\n";
} else {
    echo "⚠ INCOMPLETE\n";
}

// Output JSON if requested
if ($options['json']) {
    $status = [
        'old_records' => $oldRecords,
        'new_metadata' => $newMetadata,
        'new_ideas' => $newIdeas,
        'new_content' => $newContent,
        'new_chat' => $newChat,
        'orphaned_ideas' => $orphanedIdeas,
        'orphaned_content' => $orphanedContent,
        'orphaned_chat' => $orphanedChat,
        'missing_metadata' => $missingMetadata,
        'migration_percentage' => $migrationPercentage,
        'is_complete' => ($missingMetadata == 0 && $orphanedIdeas == 0 && $orphanedContent == 0 && $orphanedChat == 0)
    ];
    
    echo "\n" . json_encode($status, JSON_PRETTY_PRINT) . "\n";
}
