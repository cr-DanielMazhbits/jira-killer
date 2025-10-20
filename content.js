// Jira Field Filler Content Script
// Handles issue ID extraction and button injection

// URL patterns for different Jira page types
const JIRA_URL_PATTERNS = [
  // Direct issue browse
  /\/browse\/([A-Z]+-\d+)/,
  
  // Issues page with selectedIssue parameter
  /\/issues\/.*selectedIssue=([A-Z]+-\d+)/,
  
  // Board view with selectedIssue
  /\/jira\/software\/projects\/[^\/]+\/boards\/\d+.*selectedIssue=([A-Z]+-\d+)/,
  
  // Sprint view with selectedIssue
  /\/jira\/software\/projects\/[^\/]+\/sprint\/\d+.*selectedIssue=([A-Z]+-\d+)/,
  
  // Any URL with issue key in query params
  /[?&]selectedIssue=([A-Z]+-\d+)/
];

// Default field configuration
function getDefaultFields() {
  return {
    customfield_13812: 5,        // Story Points
    customfield_16030: 8,        // Estimated Story Points
    customfield_16195: 7,        // Actual Story Points
    customfield_16328: {value: "None"},  // Localization
    customfield_16228: {value: "Yes"},    // Tested on FB?
    customfield_16921: {value: "Add option"}  // Feature Enablement
  };
}

// Extract issue ID from current URL
function extractIssueIdFromUrl() {
  const url = window.location.href;
  
  // Try each pattern
  for (const pattern of JIRA_URL_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      return match[1]; // Return the captured issue ID
    }
  }
  
  // Fallback: look for any issue key pattern in the URL
  const issueKeyMatch = url.match(/([A-Z]+-\d+)/);
  return issueKeyMatch ? issueKeyMatch[1] : null;
}

// Create and inject the Fill Ticket button
function createAndInjectButton(container, issueId) {
  const fillButton = document.createElement('button');
  fillButton.textContent = 'Fill Ticket';
  fillButton.className = 'jira-fill-button';
  fillButton.setAttribute('data-issue-id', issueId);
  
  // Style the button
  fillButton.style.cssText = `
    background: #0052cc;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 3px;
    margin-left: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
  `;
  
  // Add hover effect
  fillButton.addEventListener('mouseenter', () => {
    if (!fillButton.disabled) {
      fillButton.style.background = '#0065ff';
    }
  });
  
  fillButton.addEventListener('mouseleave', () => {
    if (!fillButton.disabled) {
      fillButton.style.background = '#0052cc';
    }
  });
  
  fillButton.addEventListener('click', () => handleFillClick(issueId));
  container.appendChild(fillButton);
}

// Inject button into Jira page
function injectFillButton(issueId) {
  // Wait for Jira page to fully load
  const checkForJiraElements = setInterval(() => {
    const actionsContainer = document.querySelector('.issue-header-actions') || 
                            document.querySelector('.issue-header-content') ||
                            document.querySelector('[data-testid="issue.views.issue-base.foundation.breadcrumbs"]') ||
                            document.querySelector('.issue-header') ||
                            document.querySelector('.issue-header-main') ||
                            document.querySelector('.issue-header-actions-container');
    
    if (actionsContainer && !document.querySelector('.jira-fill-button')) {
      createAndInjectButton(actionsContainer, issueId);
      clearInterval(checkForJiraElements);
    }
  }, 500);
  
  // Clear interval after 10 seconds to prevent infinite checking
  setTimeout(() => clearInterval(checkForJiraElements), 10000);
}

// Handle button click event
async function handleFillClick(issueId) {
  const button = document.querySelector('.jira-fill-button');
  const originalText = button.textContent;
  
  // Show loading state
  button.textContent = 'Updating...';
  button.disabled = true;
  button.style.background = '#666';
  button.style.cursor = 'not-allowed';
  
  try {
    // Get field configuration from storage
    const config = await chrome.storage.sync.get(['fieldConfig']);
    const fields = config.fieldConfig || getDefaultFields();
    
    // Send message to background script
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'updateFields',
        issueId: issueId,
        fields: fields
      }, resolve);
    });
    
    if (response.success) {
      showStatus('success', `Fields updated for ${issueId}`);
      button.textContent = '✓ Updated';
      button.style.background = '#28a745';
    } else {
      showStatus('error', `Failed: ${response.error}`);
      button.textContent = '✗ Error';
      button.style.background = '#dc3545';
    }
  } catch (error) {
    showStatus('error', `Error: ${error.message}`);
    button.textContent = '✗ Error';
    button.style.background = '#dc3545';
  }
  
  // Reset button after 3 seconds
  setTimeout(() => {
    button.textContent = originalText;
    button.disabled = false;
    button.style.background = '#0052cc';
    button.style.cursor = 'pointer';
  }, 3000);
}

// Show status message to user
function showStatus(type, message) {
  // Remove existing status
  const existingStatus = document.querySelector('.jira-status');
  if (existingStatus) existingStatus.remove();
  
  const statusDiv = document.createElement('div');
  statusDiv.className = `jira-status jira-status-${type}`;
  statusDiv.textContent = message;
  statusDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 4px;
    color: white;
    font-weight: bold;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    ${type === 'success' ? 'background: #28a745;' : 'background: #dc3545;'}
  `;
  
  document.body.appendChild(statusDiv);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (statusDiv.parentNode) {
      statusDiv.remove();
    }
  }, 5000);
}

// Handle URL changes (for SPA navigation)
function handleUrlChange() {
  setTimeout(() => {
    const issueId = extractIssueIdFromUrl();
    if (issueId) {
      // Remove existing button
      const existingButton = document.querySelector('.jira-fill-button');
      if (existingButton) {
        existingButton.remove();
      }
      // Re-inject button for new issue
      injectFillButton(issueId);
    }
  }, 1000); // Wait for Jira to load
}

// Initialize the extension
function initializeExtension() {
  const issueId = extractIssueIdFromUrl();
  if (issueId) {
    console.log(`Jira Field Filler: Detected issue ${issueId}`);
    injectFillButton(issueId);
  } else {
    console.log('Jira Field Filler: No issue ID detected in URL');
  }
}

// Listen for URL changes (SPA navigation)
window.addEventListener('popstate', handleUrlChange);

// Override pushState and replaceState to catch programmatic navigation
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function() {
  originalPushState.apply(history, arguments);
  handleUrlChange();
};

history.replaceState = function() {
  originalReplaceState.apply(history, arguments);
  handleUrlChange();
};

// Check if Parent field is filled
function checkParentField() {
  // Look for Parent field in Jira's UI
  // Try multiple selectors as Jira's structure can vary
  const parentSelectors = [
    '[data-testid="issue.views.field.rich-text.parent"]',
    '[data-testid="issue.views.field.parent"]',
    '.parent-field',
    '[aria-label*="Parent"]',
    'div[data-testid*="parent"]',
    // Also check for the actual parent link/value
    'a[data-testid="issue.views.field.parent.common.ui.read-view.parent-issue-link"]',
    'span[data-testid="issue.views.field.parent.common.ui.read-view.parent-issue-link"]'
  ];
  
  for (const selector of parentSelectors) {
    const parentElement = document.querySelector(selector);
    if (parentElement) {
      // Check if element exists and has content
      const textContent = parentElement.textContent?.trim();
      const hasLink = parentElement.querySelector('a[href*="/browse/"]');
      
      if (textContent && textContent.length > 0 && textContent !== 'None' && textContent !== 'Add parent') {
        console.log('Parent field found with value:', textContent);
        return true;
      }
      
      if (hasLink) {
        console.log('Parent field found with link');
        return true;
      }
    }
  }
  
  // Additional check: look for any element containing parent issue key
  const allElements = document.querySelectorAll('[data-testid*="parent"], [class*="parent"]');
  for (const element of allElements) {
    const text = element.textContent?.trim();
    // Check if it matches issue key pattern (e.g., ENG-1234)
    if (text && /[A-Z]+-\d+/.test(text)) {
      console.log('Parent field found via pattern match:', text);
      return true;
    }
  }
  
  console.log('Parent field not found or empty');
  return false;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkParentField') {
    const hasParent = checkParentField();
    sendResponse({ hasParent: hasParent });
    return true;
  }
});

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

// Also initialize after a short delay to catch dynamically loaded content
setTimeout(initializeExtension, 2000);
