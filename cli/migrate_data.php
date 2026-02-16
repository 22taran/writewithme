<?php
// This file is part of Moodle - http://moodle.org/
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * CLI script for data migration
 * @package    mod_researchflow
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>, Tarandeep Singh <tarandesingh@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('CLI_SCRIPT', true);

require_once(__DIR__ . '/../../../config.php');
require_once($CFG->libdir . '/clilib.php');

use mod_researchflow\migration\DataMigrator;

$usage = "Usage: php migrate_data.php [options]\n";
$usage .= "Options:\n";
$usage .= "  --dry-run    Show what would be migrated without actually doing it\n";
$usage .= "  --batch-size=N    Process N records at a time (default: 100)\n";
$usage .= "  --user-id=N    Migrate only specific user\n";
$usage .= "  --activity-id=N    Migrate only specific activity\n";
$usage .= "  --help, -h    Show this help message\n";

list($options, $unrecognized) = cli_get_params([
    'dry-run' => false,
    'batch-size' => 100,
    'user-id' => null,
    'activity-id' => null,
    'help' => false
], [
    'h' => 'help'
]);

if ($options['help']) {
    echo $usage;
    exit(0);
}

$migrator = new DataMigrator();
$dryRun = $options['dry-run'];
$batchSize = (int)$options['batch-size'];

echo "Starting data migration...\n";
echo "Dry run: " . ($dryRun ? 'YES' : 'NO') . "\n";
echo "Batch size: $batchSize\n\n";

// Get records to migrate
$where = [];
$params = [];

if ($options['user-id']) {
    $where[] = 'userid = ?';
    $params[] = $options['user-id'];
}

if ($options['activity-id']) {
    $where[] = 'researchflowid = ?';
    $params[] = $options['activity-id'];
}

$whereClause = empty($where) ? '' : 'WHERE ' . implode(' AND ', $where);
$sql = "SELECT * FROM {researchflow_work} $whereClause ORDER BY id";
$records = $DB->get_records_sql($sql, $params);

echo "Found " . count($records) . " records to migrate\n\n";

$successCount = 0;
$errorCount = 0;
$errors = [];

foreach (array_chunk($records, $batchSize) as $batch) {
    echo "Processing batch of " . count($batch) . " records...\n";
    
    foreach ($batch as $record) {
        if ($dryRun) {
            echo "Would migrate: User {$record->userid}, Activity {$record->researchflowid}\n";
            $successCount++;
        } else {
            $result = $migrator->migrate($record->researchflowid, $record->userid);
            
            if ($result['success']) {
                $successCount++;
                echo "✓ Migrated: User {$record->userid}, Activity {$record->researchflowid}\n";
                echo "  - Ideas: {$result['ideas_migrated']}\n";
                echo "  - Chat messages: {$result['chat_messages_migrated']}\n";
                echo "  - Content records: {$result['content_records_migrated']}\n";
            } else {
                $errorCount++;
                $errors[] = "User {$record->userid}, Activity {$record->researchflowid}: {$result['message']}";
                echo "✗ Failed: User {$record->userid}, Activity {$record->researchflowid}\n";
                echo "  Error: {$result['message']}\n";
            }
        }
    }
    
    echo "Batch complete. Success: $successCount, Errors: $errorCount\n\n";
}

echo "Migration complete!\n";
echo "Total records processed: " . ($successCount + $errorCount) . "\n";
echo "Successful migrations: $successCount\n";
echo "Failed migrations: $errorCount\n";

if (!empty($errors)) {
    echo "\nErrors:\n";
    foreach ($errors as $error) {
        echo "- $error\n";
    }
}

if ($dryRun) {
    echo "\nThis was a dry run. No data was actually migrated.\n";
    echo "Run without --dry-run to perform the actual migration.\n";
}
