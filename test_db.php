<?php
// Test script to check database tables
require_once('../../config.php');

echo "<h1>Database Test</h1>";

try {
    // Check if tables exist
    $dbman = $DB->get_manager();
    
    $tables = [
        'researchflow',
        'researchflow_metadata',
        'researchflow_ideas', 
        'researchflow_content',
        'researchflow_chat'
    ];
    
    echo "<h2>Table Existence Check:</h2>";
    foreach ($tables as $table) {
        $exists = $dbman->table_exists($table);
        echo "<p>$table: " . ($exists ? "EXISTS" : "NOT EXISTS") . "</p>";
    }
    
    // List all tables with researchflow in name
    echo "<h2>All researchflow tables:</h2>";
    $allTables = $DB->get_tables();
    $writeassistTables = array_filter($allTables, function($table) {
        return strpos($table, 'researchflow') !== false;
    });
    foreach ($writeassistTables as $table) {
        echo "<p>$table</p>";
    }
    
    // Test basic queries
    echo "<h2>Test Queries:</h2>";
    
    // Test researchflow table
    try {
        $activities = $DB->get_records('researchflow', null, '', 'id,name');
        echo "<p>researchflow table: " . count($activities) . " records</p>";
        if (!empty($activities)) {
            echo "<ul>";
            foreach ($activities as $activity) {
                echo "<li>ID: {$activity->id}, Name: {$activity->name}</li>";
            }
            echo "</ul>";
        }
    } catch (Exception $e) {
        echo "<p>researchflow query error: " . $e->getMessage() . "</p>";
    }
    
    // Test metadata table
    try {
        $metadata = $DB->get_records('researchflow_metadata');
        echo "<p>researchflow_metadata table: " . count($metadata) . " records</p>";
    } catch (Exception $e) {
        echo "<p>researchflow_metadata query error: " . $e->getMessage() . "</p>";
    }
    
    // Test chat table
    try {
        $chat = $DB->get_records('researchflow_chat');
        echo "<p>researchflow_chat table: " . count($chat) . " records</p>";
    } catch (Exception $e) {
        echo "<p>researchflow_chat query error: " . $e->getMessage() . "</p>";
    }
    
} catch (Exception $e) {
    echo "<p>Error: " . $e->getMessage() . "</p>";
    echo "<p>Trace: " . $e->getTraceAsString() . "</p>";
}
?>
