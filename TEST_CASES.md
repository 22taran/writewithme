# 🧪 Test Cases - Database Migration

## 📋 **Test Strategy Overview**

**Objective**: Ensure complete data integrity and system functionality during database migration
**Coverage**: Unit tests, integration tests, performance tests, and user acceptance tests
**Framework**: PHPUnit for backend, Jest for frontend, Selenium for E2E

## 🔧 **Test Environment Setup**

### **Test Data Requirements**
```php
// Test data generator
class TestDataGenerator {
    public function generateSampleProject($userId = 123, $activityId = 456) {
        return [
            'metadata' => [
                'title' => 'Test Project',
                'created' => '2025-01-27T10:30:00.000Z',
                'modified' => '2025-01-27T11:45:00.000Z',
                'currentTab' => 'write'
            ],
            'plan' => [
                'templateName' => 'argumentative',
                'ideas' => [
                    [
                        'id' => 'idea_1',
                        'content' => 'Main argument point',
                        'location' => 'brainstorm',
                        'aiGenerated' => false
                    ],
                    [
                        'id' => 'idea_2', 
                        'content' => 'Supporting evidence',
                        'location' => 'outline',
                        'sectionId' => 'introduction',
                        'aiGenerated' => true
                    ]
                ],
                'outline' => [
                    [
                        'id' => 'introduction',
                        'title' => 'Introduction',
                        'description' => 'Hook and thesis',
                        'bubbles' => []
                    ]
                ]
            ],
            'write' => [
                'content' => '<p>This is the written content</p>',
                'wordCount' => 25
            ],
            'edit' => [
                'content' => '<p>This is the edited content</p>',
                'suggestions' => [
                    [
                        'id' => 'suggestion_1',
                        'content' => 'Consider adding more evidence',
                        'type' => 'comment',
                        'aiGenerated' => true
                    ]
                ]
            ],
            'chatHistory' => [
                [
                    'role' => 'user',
                    'content' => 'Help me brainstorm ideas',
                    'timestamp' => '2025-01-27T10:30:00.000Z'
                ],
                [
                    'role' => 'assistant',
                    'content' => 'Here are some ideas to consider...',
                    'timestamp' => '2025-01-27T10:30:15.000Z'
                ]
            ]
        ];
    }
}
```

## 🧪 **Unit Tests**

### **TC-001: JSON Data Parsing**

```php
<?php
class JsonParsingTest extends PHPUnit\Framework\TestCase {
    
    private $parser;
    private $testData;
    
    protected function setUp(): void {
        $this->parser = new ProjectDataParser();
        $this->testData = new TestDataGenerator();
    }
    
    /**
     * @test
     * Test parsing valid project JSON data
     */
    public function testParseValidProjectData() {
        $jsonData = $this->testData->generateSampleProject();
        $result = $this->parser->parse($jsonData);
        
        // Verify structure
        $this->assertIsArray($result);
        $this->assertArrayHasKey('ideas', $result);
        $this->assertArrayHasKey('chatHistory', $result);
        $this->assertArrayHasKey('content', $result);
        
        // Verify ideas
        $this->assertCount(2, $result['ideas']);
        $this->assertEquals('Main argument point', $result['ideas'][0]['content']);
        $this->assertFalse($result['ideas'][0]['aiGenerated']);
        
        // Verify chat history
        $this->assertCount(2, $result['chatHistory']);
        $this->assertEquals('user', $result['chatHistory'][0]['role']);
        $this->assertEquals('assistant', $result['chatHistory'][1]['role']);
    }
    
    /**
     * @test
     * Test parsing invalid JSON data
     */
    public function testParseInvalidJson() {
        $invalidJson = '{"invalid": json}';
        
        $this->expectException(InvalidJsonException::class);
        $this->parser->parse($invalidJson);
    }
    
    /**
     * @test
     * Test parsing empty project data
     */
    public function testParseEmptyProject() {
        $emptyData = [];
        $result = $this->parser->parse($emptyData);
        
        $this->assertEmpty($result['ideas']);
        $this->assertEmpty($result['chatHistory']);
        $this->assertEmpty($result['content']);
    }
    
    /**
     * @test
     * Test parsing malformed data structure
     */
    public function testParseMalformedData() {
        $malformedData = [
            'plan' => 'not_an_array',
            'write' => null,
            'chatHistory' => 'invalid'
        ];
        
        $this->expectException(DataStructureException::class);
        $this->parser->parse($malformedData);
    }
}
```

### **TC-002: Data Migration Tests**

```php
<?php
class DataMigrationTest extends PHPUnit\Framework\TestCase {
    
    private $migrator;
    private $testData;
    
    protected function setUp(): void {
        $this->migrator = new DataMigrator();
        $this->testData = new TestDataGenerator();
        $this->refreshDatabase();
    }
    
    /**
     * @test
     * Test migrating ideas to normalized table
     */
    public function testMigrateIdeas() {
        $jsonData = $this->testData->generateSampleProject();
        $userId = 123;
        $activityId = 456;
        
        $this->migrator->migrateIdeas($jsonData['plan']['ideas'], $activityId, $userId);
        
        // Verify ideas were inserted
        $this->assertDatabaseHas('writeassistdev_ideas', [
            'writeassistdevid' => $activityId,
            'userid' => $userId,
            'content' => 'Main argument point',
            'location' => 'brainstorm',
            'ai_generated' => false
        ]);
        
        $this->assertDatabaseHas('writeassistdev_ideas', [
            'writeassistdevid' => $activityId,
            'userid' => $userId,
            'content' => 'Supporting evidence',
            'location' => 'outline',
            'section_id' => 'introduction',
            'ai_generated' => true
        ]);
    }
    
    /**
     * @test
     * Test migrating chat history
     */
    public function testMigrateChatHistory() {
        $jsonData = $this->testData->generateSampleProject();
        $userId = 123;
        $activityId = 456;
        
        $this->migrator->migrateChatHistory($jsonData['chatHistory'], $activityId, $userId);
        
        $this->assertDatabaseHas('writeassistdev_chat', [
            'writeassistdevid' => $activityId,
            'userid' => $userId,
            'role' => 'user',
            'content' => 'Help me brainstorm ideas'
        ]);
        
        $this->assertDatabaseHas('writeassistdev_chat', [
            'writeassistdevid' => $activityId,
            'userid' => $userId,
            'role' => 'assistant',
            'content' => 'Here are some ideas to consider...'
        ]);
    }
    
    /**
     * @test
     * Test migrating written content
     */
    public function testMigrateContent() {
        $jsonData = $this->testData->generateSampleProject();
        $userId = 123;
        $activityId = 456;
        
        $this->migrator->migrateContent($jsonData['write'], $activityId, $userId, 'write');
        $this->migrator->migrateContent($jsonData['edit'], $activityId, $userId, 'edit');
        
        $this->assertDatabaseHas('writeassistdev_content', [
            'writeassistdevid' => $activityId,
            'userid' => $userId,
            'phase' => 'write',
            'content' => '<p>This is the written content</p>',
            'word_count' => 25
        ]);
        
        $this->assertDatabaseHas('writeassistdev_content', [
            'writeassistdevid' => $activityId,
            'userid' => $userId,
            'phase' => 'edit',
            'content' => '<p>This is the edited content</p>'
        ]);
    }
    
    /**
     * @test
     * Test migrating metadata
     */
    public function testMigrateMetadata() {
        $jsonData = $this->testData->generateSampleProject();
        $userId = 123;
        $activityId = 456;
        
        $this->migrator->migrateMetadata($jsonData['metadata'], $activityId, $userId);
        
        $this->assertDatabaseHas('writeassistdev_metadata', [
            'writeassistdevid' => $activityId,
            'userid' => $userId,
            'title' => 'Test Project',
            'current_tab' => 'write'
        ]);
    }
}
```

## 🔗 **Integration Tests**

### **TC-003: End-to-End Migration**

```php
<?php
class EndToEndMigrationTest extends PHPUnit\Framework\TestCase {
    
    private $migrationRunner;
    private $testData;
    
    protected function setUp(): void {
        $this->migrationRunner = new FullMigrationRunner();
        $this->testData = new TestDataGenerator();
        $this->refreshDatabase();
    }
    
    /**
     * @test
     * Test complete migration process
     */
    public function testCompleteMigration() {
        // Setup: Create test project in old format
        $projectId = $this->createTestProject();
        $userId = 123;
        
        // Execute: Run full migration
        $result = $this->migrationRunner->migrate($projectId, $userId);
        
        // Assert: Verify migration success
        $this->assertTrue($result['success']);
        $this->assertEquals(2, $result['ideas_migrated']);
        $this->assertEquals(2, $result['chat_messages_migrated']);
        $this->assertEquals(2, $result['content_records_migrated']);
        $this->assertEquals(1, $result['metadata_records_migrated']);
    }
    
    /**
     * @test
     * Test data integrity after migration
     */
    public function testDataIntegrityAfterMigration() {
        $projectId = $this->createTestProject();
        $userId = 123;
        
        $this->migrationRunner->migrate($projectId, $userId);
        
        // Verify no orphaned records
        $this->assertNoOrphanedIdeas();
        $this->assertNoOrphanedChatMessages();
        $this->assertNoOrphanedContent();
        
        // Verify foreign key constraints
        $this->assertAllForeignKeysValid();
        
        // Verify data consistency
        $this->assertDataConsistency();
    }
    
    /**
     * @test
     * Test rollback functionality
     */
    public function testMigrationRollback() {
        $projectId = $this->createTestProject();
        $userId = 123;
        
        // Run migration
        $this->migrationRunner->migrate($projectId, $userId);
        
        // Rollback
        $rollbackResult = $this->migrationRunner->rollback($projectId, $userId);
        
        $this->assertTrue($rollbackResult['success']);
        $this->assertDatabaseMissing('writeassistdev_ideas', [
            'writeassistdevid' => $projectId,
            'userid' => $userId
        ]);
    }
    
    private function assertNoOrphanedIdeas() {
        $orphanedIdeas = DB::table('writeassistdev_ideas')
            ->leftJoin('writeassistdev', 'writeassistdev_ideas.writeassistdevid', '=', 'writeassistdev.id')
            ->whereNull('writeassistdev.id')
            ->count();
            
        $this->assertEquals(0, $orphanedIdeas, 'Found orphaned ideas');
    }
    
    private function assertAllForeignKeysValid() {
        // Test foreign key constraints
        $invalidIdeas = DB::table('writeassistdev_ideas')
            ->whereNotIn('writeassistdevid', DB::table('writeassistdev')->pluck('id'))
            ->count();
            
        $this->assertEquals(0, $invalidIdeas, 'Found invalid foreign keys in ideas table');
    }
}
```

## ⚡ **Performance Tests**

### **TC-004: Query Performance**

```php
<?php
class PerformanceTest extends PHPUnit\Framework\TestCase {
    
    /**
     * @test
     * Test query performance with large dataset
     */
    public function testQueryPerformance() {
        // Create large dataset
        $this->createLargeDataset(1000, 10); // 1000 students, 10 activities each
        
        $startTime = microtime(true);
        
        // Test common queries
        $ideas = DB::table('writeassistdev_ideas')
            ->where('userid', 123)
            ->where('ai_generated', true)
            ->get();
            
        $endTime = microtime(true);
        $executionTime = ($endTime - $startTime) * 1000; // Convert to milliseconds
        
        $this->assertLessThan(100, $executionTime, 'Query took too long: ' . $executionTime . 'ms');
    }
    
    /**
     * @test
     * Test concurrent access performance
     */
    public function testConcurrentAccess() {
        $this->createTestData();
        
        $startTime = microtime(true);
        
        // Simulate 100 concurrent users
        $processes = [];
        for ($i = 0; $i < 100; $i++) {
            $processes[] = $this->simulateUserActivity($i);
        }
        
        // Wait for all processes to complete
        foreach ($processes as $process) {
            $this->assertTrue($process->wait());
        }
        
        $endTime = microtime(true);
        $totalTime = $endTime - $startTime;
        
        $this->assertLessThan(30, $totalTime, 'Concurrent access took too long: ' . $totalTime . 's');
    }
    
    /**
     * @test
     * Test migration performance with large dataset
     */
    public function testMigrationPerformance() {
        // Create large dataset
        $this->createLargeDataset(100, 5); // 100 students, 5 activities each
        
        $startTime = microtime(true);
        
        $migrationRunner = new FullMigrationRunner();
        $result = $migrationRunner->migrateAll();
        
        $endTime = microtime(true);
        $migrationTime = $endTime - $startTime;
        
        $this->assertTrue($result['success']);
        $this->assertLessThan(300, $migrationTime, 'Migration took too long: ' . $migrationTime . 's');
    }
    
    private function createLargeDataset($studentCount, $activityCount) {
        for ($student = 1; $student <= $studentCount; $student++) {
            for ($activity = 1; $activity <= $activityCount; $activity++) {
                $this->createTestProject($student, $activity);
            }
        }
    }
}
```

## 🔍 **Data Validation Tests**

### **TC-005: Data Integrity**

```php
<?php
class DataIntegrityTest extends PHPUnit\Framework\TestCase {
    
    /**
     * @test
     * Test no data loss during migration
     */
    public function testNoDataLoss() {
        $originalData = $this->getOriginalJsonData();
        $migrator = new FullMigrationRunner();
        $migrator->migrate();
        
        $migratedData = $this->reconstructFromNormalizedTables();
        
        // Compare original vs migrated data
        $this->assertEquals(
            $originalData['plan']['ideas'],
            $migratedData['plan']['ideas']
        );
        
        $this->assertEquals(
            $originalData['chatHistory'],
            $migratedData['chatHistory']
        );
        
        $this->assertEquals(
            $originalData['write']['content'],
            $migratedData['write']['content']
        );
    }
    
    /**
     * @test
     * Test data consistency across tables
     */
    public function testDataConsistency() {
        $migrator = new FullMigrationRunner();
        $migrator->migrate();
        
        // Verify user data isolation
        $this->assertUserDataIsolation();
        
        // Verify activity data isolation
        $this->assertActivityDataIsolation();
        
        // Verify referential integrity
        $this->assertReferentialIntegrity();
    }
    
    /**
     * @test
     * Test data validation rules
     */
    public function testDataValidationRules() {
        $invalidData = [
            'plan' => [
                'ideas' => [
                    [
                        'id' => '', // Empty ID should fail
                        'content' => str_repeat('a', 1001), // Too long content
                        'location' => 'invalid_location' // Invalid location
                    ]
                ]
            ]
        ];
        
        $migrator = new DataMigrator();
        
        $this->expectException(ValidationException::class);
        $migrator->migrateIdeas($invalidData['plan']['ideas'], 123, 456);
    }
    
    private function assertUserDataIsolation() {
        $user1Data = $this->getUserData(123);
        $user2Data = $this->getUserData(456);
        
        $this->assertNotEquals($user1Data, $user2Data);
        $this->assertEmpty(array_intersect($user1Data, $user2Data));
    }
}
```

## 🌐 **End-to-End Tests**

### **TC-006: User Interface Tests**

```javascript
// Frontend E2E tests using Jest and Puppeteer
describe('Database Migration E2E Tests', () => {
    
    test('User can access migrated project data', async () => {
        const page = await browser.newPage();
        
        // Login as test user
        await page.goto('/login');
        await page.type('#username', 'testuser');
        await page.type('#password', 'testpass');
        await page.click('#login-button');
        
        // Navigate to writing activity
        await page.goto('/mod/writeassistdev/view.php?id=123');
        
        // Verify project data loads correctly
        await page.waitForSelector('#ideaBubbles');
        const ideas = await page.$$eval('.idea-bubble', bubbles => 
            bubbles.map(bubble => bubble.textContent)
        );
        
        expect(ideas).toContain('Main argument point');
        expect(ideas).toContain('Supporting evidence');
    });
    
    test('User can save new data after migration', async () => {
        const page = await browser.newPage();
        
        // Login and navigate to activity
        await page.goto('/mod/writeassistdev/view.php?id=123');
        
        // Add new idea
        await page.click('#addIdeaBubble');
        await page.type('.idea-bubble:last-child .bubble-content', 'New idea after migration');
        
        // Save project
        await page.click('#saveBtn');
        await page.waitForSelector('.save-success', { timeout: 5000 });
        
        // Verify save was successful
        const saveStatus = await page.$eval('.save-success', el => el.textContent);
        expect(saveStatus).toContain('Saved successfully');
    });
    
    test('Chat functionality works after migration', async () => {
        const page = await browser.newPage();
        
        // Login and navigate to activity
        await page.goto('/mod/writeassistdev/view.php?id=123');
        
        // Send chat message
        await page.type('#userInput', 'Help me with my essay');
        await page.click('#sendMessage');
        
        // Wait for AI response
        await page.waitForSelector('.message.assistant', { timeout: 10000 });
        
        // Verify chat history
        const chatMessages = await page.$$eval('.message', messages => 
            messages.map(msg => ({
                role: msg.classList.contains('user') ? 'user' : 'assistant',
                content: msg.textContent
            }))
        );
        
        expect(chatMessages).toHaveLength(2); // Original + new messages
        expect(chatMessages[chatMessages.length - 1].role).toBe('assistant');
    });
});
```

## 📊 **Test Execution Plan**

### **Pre-Migration Testing**
1. **Unit Tests**: Run all unit tests (TC-001, TC-002)
2. **Integration Tests**: Run integration tests (TC-003)
3. **Performance Tests**: Run performance tests (TC-004)
4. **Data Validation**: Run data integrity tests (TC-005)

### **Migration Testing**
1. **Staging Environment**: Run full migration on staging
2. **Data Validation**: Verify all data migrated correctly
3. **Performance Testing**: Ensure performance meets requirements
4. **User Acceptance**: Run E2E tests (TC-006)

### **Post-Migration Testing**
1. **Smoke Tests**: Basic functionality verification
2. **Regression Tests**: Ensure no functionality lost
3. **Performance Monitoring**: Monitor system performance
4. **User Feedback**: Collect user feedback on migration

## 🎯 **Success Criteria**

### **Test Coverage Requirements**
- **Unit Tests**: > 90% code coverage
- **Integration Tests**: All critical paths covered
- **Performance Tests**: All queries < 100ms
- **E2E Tests**: All user workflows tested

### **Data Integrity Requirements**
- **Zero Data Loss**: 100% data preservation
- **Data Consistency**: All foreign keys valid
- **User Isolation**: No data leakage between users
- **Activity Isolation**: No data leakage between activities

### **Performance Requirements**
- **Query Performance**: < 100ms for standard operations
- **Migration Time**: < 4 hours for full dataset
- **Concurrent Users**: Support 100+ concurrent users
- **System Uptime**: 99.9% availability during migration

---

**Test Plan Version**: 1.0  
**Last Updated**: 2025-01-27  
**Next Review**: 2025-02-03
