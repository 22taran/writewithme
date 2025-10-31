<?php
/**
 * Version Manager
 * 
 * Handles content version history for Write/Edit modules
 * 
 * @package    mod_writeassistdev
 * @copyright  2025 Mitchell Petingola <mpetingola@algomau.ca>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_writeassistdev\data;

defined('MOODLE_INTERNAL') || die();

/**
 * VersionManager class
 * 
 * Manages version history snapshots for content
 */
class VersionManager {
    
    const MAX_VERSIONS_PER_DOCUMENT = 50; // Keep last 50 versions
    const AUTO_SAVE_THRESHOLD = 50; // Words changed to trigger auto-version
    
    /**
     * Save a version snapshot
     * 
     * @param int $writeassistdevid Activity ID
     * @param int $userid User ID
     * @param string $phase Phase name (write/edit)
     * @param string $content Content text
     * @param int $wordCount Word count
     * @param string $changeSummary Summary of change (e.g., "Auto-saved", "Manual save")
     * @return int|false Version number or false on failure
     */
    public static function saveVersion($writeassistdevid, $userid, $phase, $content, $wordCount = 0, $changeSummary = 'Auto-saved') {
        global $DB, $USER;
        
        try {
            // Get next version number
            $lastVersion = $DB->get_field('writeassistdev_versions', 
                'MAX(version_number)', 
                [
                    'writeassistdevid' => $writeassistdevid,
                    'userid' => $userid,
                    'phase' => $phase
                ]
            );
            $versionNumber = ($lastVersion ? $lastVersion : 0) + 1;
            
            $record = [
                'writeassistdevid' => $writeassistdevid,
                'userid' => $userid,
                'phase' => $phase,
                'content' => $content,
                'word_count' => $wordCount,
                'version_number' => $versionNumber,
                'created_at' => time(),
                'modified_by' => $USER->id,
                'change_summary' => $changeSummary
            ];
            
            $versionId = $DB->insert_record('writeassistdev_versions', $record);
            
            // Clean up old versions (keep only last MAX_VERSIONS)
            self::cleanupOldVersions($writeassistdevid, $userid, $phase);
            
            return $versionNumber;
        } catch (\Exception $e) {
            error_log('VersionManager::saveVersion error: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Get version history for a document
     * 
     * @param int $writeassistdevid Activity ID
     * @param int $userid User ID
     * @param string $phase Phase name
     * @param int $limit Number of versions to return
     * @return array Array of versions
     */
    public static function getVersionHistory($writeassistdevid, $userid, $phase, $limit = 50) {
        global $DB;
        
        try {
            $versions = $DB->get_records('writeassistdev_versions', 
                [
                    'writeassistdevid' => $writeassistdevid,
                    'userid' => $userid,
                    'phase' => $phase
                ],
                'version_number DESC',
                '*',
                0,
                $limit
            );
            
            return array_values($versions);
        } catch (\Exception $e) {
            error_log('VersionManager::getVersionHistory error: ' . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Get a specific version by version number
     * 
     * @param int $writeassistdevid Activity ID
     * @param int $userid User ID
     * @param string $phase Phase name
     * @param int $versionNumber Version number
     * @return object|null Version record or null
     */
    public static function getVersion($writeassistdevid, $userid, $phase, $versionNumber) {
        global $DB;
        
        try {
            return $DB->get_record('writeassistdev_versions', [
                'writeassistdevid' => $writeassistdevid,
                'userid' => $userid,
                'phase' => $phase,
                'version_number' => $versionNumber
            ]);
        } catch (\Exception $e) {
            error_log('VersionManager::getVersion error: ' . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Clean up old versions, keeping only the most recent ones
     * 
     * @param int $writeassistdevid Activity ID
     * @param int $userid User ID
     * @param string $phase Phase name
     */
    private static function cleanupOldVersions($writeassistdevid, $userid, $phase) {
        global $DB;
        
        try {
            // Count total versions
            $count = $DB->count_records('writeassistdev_versions', [
                'writeassistdevid' => $writeassistdevid,
                'userid' => $userid,
                'phase' => $phase
            ]);
            
            // If we exceed the limit, delete oldest ones
            if ($count > self::MAX_VERSIONS_PER_DOCUMENT) {
                $excess = $count - self::MAX_VERSIONS_PER_DOCUMENT;
                
                // Get IDs of oldest versions to delete
                $oldVersions = $DB->get_records('writeassistdev_versions',
                    [
                        'writeassistdevid' => $writeassistdevid,
                        'userid' => $userid,
                        'phase' => $phase
                    ],
                    'version_number ASC',
                    'id',
                    0,
                    $excess
                );
                
                foreach ($oldVersions as $version) {
                    $DB->delete_records('writeassistdev_versions', ['id' => $version->id]);
                }
            }
        } catch (\Exception $e) {
            error_log('VersionManager::cleanupOldVersions error: ' . $e->getMessage());
        }
    }
    
    /**
     * Check if we should create a version (based on word count difference)
     * 
     * @param int $writeassistdevid Activity ID
     * @param int $userid User ID
     * @param string $phase Phase name
     * @param int $newWordCount New word count
     * @return bool True if should create version
     */
    public static function shouldCreateVersion($writeassistdevid, $userid, $phase, $newWordCount) {
        global $DB;
        
        try {
            // Get current content word count
            $current = $DB->get_record('writeassistdev_content', [
                'writeassistdevid' => $writeassistdevid,
                'userid' => $userid,
                'phase' => $phase
            ]);
            
            if (!$current) {
                return true; // First save, create version
            }
            
            $wordDiff = abs($newWordCount - ($current->word_count ?? 0));
            
            // Create version if significant change
            return $wordDiff >= self::AUTO_SAVE_THRESHOLD;
        } catch (\Exception $e) {
            error_log('VersionManager::shouldCreateVersion error: ' . $e->getMessage());
            return false;
        }
    }
}

