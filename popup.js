// Jira Field Filler Popup Script
// Simplified popup with just current issue and complete button

// DOM elements
const elements = {
    status: document.getElementById('status'),
    currentIssue: document.getElementById('currentIssue'),
    currentIssueId: document.getElementById('currentIssueId'),
    noIssue: document.getElementById('noIssue'),
    completeTicket: document.getElementById('completeTicket')
};

// Show status message
function showStatus(message, type = 'success') {
    elements.status.textContent = message;
    elements.status.className = `status ${type}`;
    elements.status.style.display = 'block';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        elements.status.style.display = 'none';
    }, 3000);
}

// Complete the ticket
async function completeTicket() {
    const issueId = elements.currentIssueId.textContent;
    if (!issueId) {
        showStatus('No issue detected', 'error');
        return;
    }
    
    // Check if this is an ENG project ticket
    if (!issueId.startsWith('ENG-')) {
        showStatus('Only ENG project tickets are supported', 'error');
        return;
    }
    
    // Check if Parent field exists
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'checkParentField' });
        
        if (!response || !response.hasParent) {
            showStatus('Parent field must be filled before proceeding', 'error');
            return;
        }
    } catch (error) {
        console.error('Error checking parent field:', error);
        showStatus('Unable to verify Parent field. Please ensure it is filled.', 'error');
        return;
    }
    
    // Disable button and show loading
    elements.completeTicket.disabled = true;
    elements.completeTicket.textContent = 'Completing...';
    
    try {
        // Send all required fields with proper Jira API formatting
        const fields = {
            customfield_13812: 2,  // Story Points
            customfield_16030: 8,  // Estimated Story Points
            customfield_16195: 7,   // Actual Story Points
            customfield_16657: [{ value: "N/A" }],  // Tested on Tag(s)? (array format)
            customfield_16328: [{ value: "Not Required" }],  // Localization (array format)
            customfield_16228: [{ value: "N/A" }],  // Tested on FB? (array format)
            customfield_16921: { value: "Not Required" },  // Feature Enablement
            customfield_16987: {  // Tested on FB? Description (Atlassian Document Format)
                type: "doc",
                version: 1,
                content: [
                    {
                        type: "paragraph",
                        content: [
                            {
                                type: "text",
                                text: "Not Required"
                            }
                        ]
                    }
                ]
            },
            customfield_15001: {  // Feature Enablement Description (Atlassian Document Format)
                type: "doc",
                version: 1,
                content: [
                    {
                        type: "paragraph",
                        content: [
                            {
                                type: "text",
                                text: "Not Required"
                            }
                        ]
                    }
                ]
            }
        };
        
        // Step 1: Update fields
        const updateFieldsResponse = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: 'updateFields',
                issueId: issueId,
                fields: fields
            }, resolve);
        });
        
        if (!updateFieldsResponse.success) {
            showStatus(`Failed to update fields: ${updateFieldsResponse.error}`, 'error');
            elements.completeTicket.textContent = '✗ Error';
            elements.completeTicket.style.background = '#dc3545';
            return;
        }
        
        // Step 2: Move ticket to Done state
        elements.completeTicket.textContent = 'Moving to Done...';
        
        const moveToDoneResponse = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: 'moveToDone',
                issueId: issueId
            }, resolve);
        });
        
        if (!moveToDoneResponse.success) {
            showStatus(`Fields updated but failed to move to Done: ${moveToDoneResponse.error}`, 'error');
            elements.completeTicket.textContent = '✗ Partial Error';
            elements.completeTicket.style.background = '#dc3545';
            return;
        }
        
        // Both steps completed successfully
        showStatus(`Ticket ${issueId} completed and moved to Done!`, 'success');
        elements.completeTicket.textContent = '✓ Completed';
        elements.completeTicket.style.background = '#28a745';
    } catch (error) {
        console.error('Error completing ticket:', error);
        showStatus(`Error: ${error.message}`, 'error');
        elements.completeTicket.textContent = '✗ Error';
        elements.completeTicket.style.background = '#dc3545';
    }
    
    // Reset button after 3 seconds
    setTimeout(() => {
        elements.completeTicket.disabled = false;
        elements.completeTicket.textContent = 'Complete Ticket';
        elements.completeTicket.style.background = '#0052cc';
    }, 3000);
}

// Get current issue from active tab
async function getCurrentIssue() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab && tab.url && tab.url.includes('cybereason.atlassian.net')) {
            // Extract issue ID from URL
            const url = new URL(tab.url);
            const pathname = url.pathname;
            const searchParams = url.searchParams;
            
            // Try different patterns
            let issueId = null;
            
            // Pattern 1: Direct browse URL
            const browseMatch = pathname.match(/\/browse\/([A-Z]+-\d+)/);
            if (browseMatch) {
                issueId = browseMatch[1];
            }
            
            // Pattern 2: selectedIssue parameter
            if (!issueId) {
                issueId = searchParams.get('selectedIssue');
            }
            
            // Pattern 3: Any issue key in URL
            if (!issueId) {
                const issueKeyMatch = tab.url.match(/([A-Z]+-\d+)/);
                if (issueKeyMatch) {
                    issueId = issueKeyMatch[1];
                }
            }
            
            if (issueId) {
                elements.currentIssueId.textContent = issueId;
                elements.currentIssue.style.display = 'block';
                elements.noIssue.style.display = 'none';
                elements.completeTicket.style.display = 'block';
                return issueId;
            }
        }
        
        // No issue detected
        elements.currentIssue.style.display = 'none';
        elements.noIssue.style.display = 'block';
        elements.completeTicket.style.display = 'none';
        return null;
    } catch (error) {
        console.error('Error getting current issue:', error);
        elements.currentIssue.style.display = 'none';
        elements.noIssue.style.display = 'block';
        elements.completeTicket.style.display = 'none';
        return null;
    }
}

// Event listeners
elements.completeTicket.addEventListener('click', completeTicket);

// Initialize popup
async function initializePopup() {
    console.log('Initializing Jira Field Filler popup');
    
    // Get current issue
    await getCurrentIssue();
    
    console.log('Popup initialized successfully');
}

// Initialize when popup loads
document.addEventListener('DOMContentLoaded', initializePopup);
