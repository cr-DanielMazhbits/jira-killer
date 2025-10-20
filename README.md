# Jira Field Filler Chrome Extension

A Chrome extension that automatically completes Jira tickets by filling required fields and moving tickets to Done state.

## Features

- **ENG Project Only**: Validates that tickets belong to the ENG project
- **Parent Field Validation**: Ensures Parent field is filled before processing
- **Automatic Field Population**: Fills all required Jira fields with predefined values
- **Automatic State Transition**: Moves tickets to Done state after field updates
- **Smart Issue Detection**: Detects Jira issue IDs from various URL patterns
- **Real-time Status**: Shows success/error feedback for each operation
- **Multiple URL Support**: Works with different Jira page types (browse, board, sprint, etc.)

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The extension will appear in your Chrome toolbar

## Usage

### Basic Usage

1. Navigate to any ENG Jira issue page (e.g., `https://cybereason.atlassian.net/browse/ENG-3153`)
2. Ensure the **Parent** field is filled
3. Click the extension icon in your toolbar
4. Click the **"Complete Ticket"** button
5. Watch the progress:
   - "Completing..." - Updating fields
   - "Moving to Done..." - Transitioning ticket state
   - "✓ Completed" - Success!

### Requirements

- **Project**: Only ENG project tickets are supported (e.g., ENG-3153)
- **Parent Field**: Must be filled before the extension can process the ticket

### Supported URL Patterns

The extension works with various Jira URL patterns:

- Direct issue: `/browse/ENG-3153`
- Issues page: `/issues/?filter=33127&selectedIssue=ENG-3153`
- Board view: `/jira/software/projects/ENG/boards/123?selectedIssue=ENG-3153`
- Sprint view: `/jira/software/projects/ENG/sprint/456?selectedIssue=ENG-3153`

## What It Does

When you click "Complete Ticket", the extension performs two steps:

### Step 1: Update Fields

Updates the following Jira fields with proper formatting:

```javascript
{
  customfield_13812: 10,  // Story Points
  customfield_16030: 8,   // Estimated Story Points
  customfield_16195: 7,   // Actual Story Points
  customfield_16657: [{ value: "N/A" }],  // Tested on Tag(s)?
  customfield_16328: [{ value: "Not Required" }],  // Localization
  customfield_16228: [{ value: "N/A" }],  // Tested on FB?
  customfield_16921: { value: "Not Required" },  // Feature Enablement
  customfield_16987: {  // Tested on FB? Description (Atlassian Document Format)
    type: "doc",
    version: 1,
    content: [{
      type: "paragraph",
      content: [{ type: "text", text: "Not Required" }]
    }]
  },
  customfield_15001: {  // Feature Enablement Description (Atlassian Document Format)
    type: "doc",
    version: 1,
    content: [{
      type: "paragraph",
      content: [{ type: "text", text: "Not Required" }]
    }]
  }
}
```

### Step 2: Move to Done

Automatically transitions the ticket to Done state after successful field updates.

## API Integration

The extension communicates with two backend endpoints:

### 1. Update Fields
```
POST http://monithor.cybereason.net:9966/jira/update-fields
```

**Request:**
```json
{
  "issueId": "ENG-3153",
  "fields": { /* field values as shown above */ }
}
```

### 2. Move to Done
```
POST http://monithor.cybereason.net:9966/jira/update-done-state
```

**Request:**
```json
{
  "issueId": "ENG-3153"
}
```

## Testing with curl

You can test the API endpoints manually:

### Test Field Update
```bash
curl -X POST http://monithor.cybereason.net:9966/jira/update-fields \
  -H "Content-Type: application/json" \
  -d '{"issueId": "ENG-2975", "fields": {"customfield_13812": 10, "customfield_16030": 8, "customfield_16195": 7, "customfield_16657": [{"value": "N/A"}], "customfield_16328": [{"value": "Not Required"}], "customfield_16228": [{"value": "N/A"}], "customfield_16921": {"value": "Not Required"}, "customfield_16987": {"type": "doc", "version": 1, "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Not Required"}]}]}, "customfield_15001": {"type": "doc", "version": 1, "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Not Required"}]}]}}}'
```

### Test Move to Done
```bash
curl -X POST http://monithor.cybereason.net:9966/jira/update-done-state \
  -H "Content-Type: application/json" \
  -d '{"issueId":"ENG-2975"}'
```

## File Structure

```
jira-killer/
├── manifest.json          # Extension manifest (Manifest V3)
├── content.js            # Content script for Jira pages (issue detection, parent validation)
├── background.js         # Background script for API calls
├── popup.html           # Extension popup interface
├── popup.js             # Popup script logic (main workflow)
├── content.css          # Additional styling
└── README.md            # This file
```

## Error Handling

The extension handles various error scenarios with clear messages:

### Validation Errors
- **Non-ENG ticket**: "Only ENG project tickets are supported"
- **Missing Parent**: "Parent field must be filled before proceeding"
- **No issue detected**: "No Jira issue detected. Please navigate to a Jira issue page."

### API Errors
- **Step 1 fails**: "Failed to update fields: [error message]"
- **Step 2 fails**: "Fields updated but failed to move to Done: [error message]"
- **Network errors**: "Unable to connect to backend server"
- **Server errors**: "Backend server error"

### Success Message
Only displays when **both** steps complete successfully:
- "Ticket [ISSUE-ID] completed and moved to Done!"

## Development

### Prerequisites

- Chrome browser (or Chromium-based browser)
- Backend server running at `http://monithor.cybereason.net:9966`

### Local Development

1. Make changes to the extension files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes on Jira pages

### Debugging

- **Content Script**: Open DevTools on the Jira page (F12) and check Console
- **Background Script**: Go to `chrome://extensions/` → Click "service worker" link
- **Popup Script**: Right-click the extension icon → Inspect popup

## Browser Compatibility

- Chrome (Manifest V3)
- Chromium-based browsers (Edge, Brave, Opera, etc.)

## Security

- Extension only runs on `https://cybereason.atlassian.net/*`
- API calls only to `http://monithor.cybereason.net:9966/*`
- No sensitive data stored locally
- All operations require explicit user action

## Troubleshooting

### Common Issues

1. **Button not appearing in popup**
   - Make sure you're on a Cybereason Jira page
   - Check that the URL contains a valid issue ID

2. **"Only ENG project tickets are supported"**
   - This extension only works with ENG-* tickets
   - Navigate to an ENG project ticket

3. **"Parent field must be filled before proceeding"**
   - Fill in the Parent field in Jira before using the extension
   - The Parent field must contain a valid issue key (e.g., ENG-9)

4. **API errors**
   - Verify your backend server is running
   - Check network connectivity to `monithor.cybereason.net:9966`
   - Review backend logs for error details

### Debug Steps

1. Open Chrome DevTools (F12)
2. Check the Console tab for error messages
3. Verify the extension is enabled in `chrome://extensions/`
4. Test the API endpoints directly using curl commands above
5. Check the Network tab to see API request/response details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly on actual Jira tickets
5. Submit a pull request

## License

This project is for internal use at Cybereason.
