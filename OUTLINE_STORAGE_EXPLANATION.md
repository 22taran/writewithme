# 📋 Outline Storage Explanation

## **Current Database Structure:**

### **What Gets Stored in Database:**

✅ **Ideas Table (`writeassistdev_ideas`):**
- All bubbles (both brainstorm AND outline) stored in ONE table
- Fields: `id`, `writeassistdevid`, `userid`, `content`, `location`, `section_id`, `ai_generated`, `created_at`, `modified_at`
- `location` = `'brainstorm'` or `'outline'`
- `section_id` = section ID when `location = 'outline'` (e.g., `'introduction'`, `'main-arguments'`)

### **What Gets Stored in JSON (old format):**

✅ **Outline Structure (`plan.outline`):**
- Section definitions from template
- Fields: `id`, `title`, `description`, `bubbles` array
- **Currently NOT loaded** (TODO in reconstructProject)

## **How It Works:**

### **Saving:**
1. All bubbles collected by `collectBubbleData()`
2. Includes `location` and `sectionId` for outline bubbles
3. Saved to `writeassistdev_ideas` table
4. Outline structure saved in JSON (not used for restoration)

### **Loading:**
1. Bubbles loaded from `writeassistdev_ideas` table
2. `location` and `sectionId` determine where bubble goes
3. If `location='outline'` and `sectionId='introduction'`
4. Bubble added to that section's outline container

## **Current Issue (FIXED):**

### **Problem:**
- `collectBubbleData()` was NOT including `sectionId` when collecting outline bubbles
- Only had: `id`, `content`, `location`, `aiGenerated`
- Missing: `sectionId` ❌

### **Fix Applied:**
```javascript
// OLD (broken):
const bubbleData = {
    id: bubble.id,
    content: bubble.content,
    location: bubble.location || 'brainstorm',
    aiGenerated: bubble.aiGenerated || false
};

// NEW (fixed):
const bubbleData = {
    id: bubble.id,
    content: bubble.content,
    location: bubble.location || 'brainstorm',
    sectionId: bubble.sectionId || null,  // ✅ ADDED
    aiGenerated: bubble.aiGenerated || false
};
```

### **Result:**
- Outline bubbles now save `sectionId` to database ✅
- On refresh, `restoreBubblesFromState()` uses `sectionId` to place bubble in correct section ✅
- Bubble persistence works correctly ✅

## **Database Schema:**

```sql
CREATE TABLE writeassistdev_ideas (
    id BIGINT PRIMARY KEY,
    writeassistdevid BIGINT,
    userid BIGINT,
    content TEXT,
    location VARCHAR(20),          -- 'brainstorm' or 'outline'
    section_id VARCHAR(50),       -- Section ID when in outline (e.g., 'introduction')
    ai_generated BOOLEAN,
    created_at INT,
    modified_at INT
);
```

## **Example Data:**

```json
// Brainstorm bubble:
{
    "id": "bubble_123",
    "content": "AI for mental health",
    "location": "brainstorm",
    "sectionId": null,
    "aiGenerated": true
}

// Outline bubble:
{
    "id": "bubble_456", 
    "content": "This supports my thesis",
    "location": "outline",
    "sectionId": "main-arguments",  // ✅ CRITICAL!
    "aiGenerated": false
}
```

## **Why This Works:**

1. **Frontend Dragging:**
   - User drags bubble to outline section
   - `handleDragEnd()` calls `bubble.setLocation('outline', sectionId)`
   - Sets both `location` and `sectionId`

2. **Frontend Saving:**
   - `collectBubbleData()` now includes `sectionId`
   - Saved to database with proper association

3. **Frontend Loading:**
   - `restoreBubblesFromState()` uses `sectionId` to find correct section
   - Places bubble in that section's container

## **Conclusion:**

✅ **No separate outline table needed** - ideas table handles everything  
✅ **sectionId is the key** - links bubbles to their outline sections  
✅ **Fix ensures sectionId is saved** - persistence now works correctly  
