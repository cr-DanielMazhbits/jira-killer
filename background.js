// Jira Field Filler Background Script
// Handles API communication with backend server

// Error messages for different failure types
const ERROR_MESSAGES = {
  'network': 'Unable to connect to backend server',
  'timeout': 'Request timed out',
  'server': 'Backend server error',
  'invalid': 'Invalid issue ID or field values',
  'cors': 'CORS error - check server configuration',
  'unknown': 'An unknown error occurred'
};

// Update Jira fields via API call
async function updateJiraFields(issueId, fields) {
  try {
    console.log(`Updating fields for issue ${issueId}:`, fields);
    
    const response = await fetch('http://monithor.cybereason.net:9966/jira/update-fields', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        issueId: issueId, 
        fields: fields 
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HTTP ${response.status}: ${response.statusText}`, errorText);
      
      if (response.status === 0) {
        throw new Error(ERROR_MESSAGES.network);
      } else if (response.status >= 500) {
        throw new Error(ERROR_MESSAGES.server);
      } else if (response.status >= 400) {
        throw new Error(ERROR_MESSAGES.invalid);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }
    
    const result = await response.json();
    console.log('API response:', result);
    return { success: true, data: result };
    
  } catch (error) {
    console.error('API call failed:', error);
    
    // Determine error type and return appropriate message
    let errorMessage = error.message;
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorMessage = ERROR_MESSAGES.network;
    } else if (error.name === 'AbortError') {
      errorMessage = ERROR_MESSAGES.timeout;
    } else if (error.message.includes('CORS')) {
      errorMessage = ERROR_MESSAGES.cors;
    }
    
    return { 
      success: false, 
      error: errorMessage,
      details: error.message 
    };
  }
}

// Validate field configuration
function validateFields(fields) {
  if (!fields || typeof fields !== 'object') {
    return { valid: false, error: 'Invalid field configuration' };
  }
  
  // Check for required fields or validate field types
  const requiredFields = ['customfield_13812', 'customfield_16030', 'customfield_16195'];
  const missingFields = requiredFields.filter(field => !(field in fields));
  
  if (missingFields.length > 0) {
    return { 
      valid: false, 
      error: `Missing required fields: ${missingFields.join(', ')}` 
    };
  }
  
  return { valid: true };
}

// Move Jira ticket to Done state
async function moveJiraToDone(issueId) {
  try {
    console.log(`Moving issue ${issueId} to Done state`);
    
    const response = await fetch('http://monithor.cybereason.net:9966/jira/update-done-state', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        issueId: issueId
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HTTP ${response.status}: ${response.statusText}`, errorText);
      
      if (response.status === 0) {
        throw new Error(ERROR_MESSAGES.network);
      } else if (response.status >= 500) {
        throw new Error(ERROR_MESSAGES.server);
      } else if (response.status >= 400) {
        throw new Error(ERROR_MESSAGES.invalid);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }
    
    const result = await response.json();
    console.log('Move to Done API response:', result);
    return { success: true, data: result };
    
  } catch (error) {
    console.error('Move to Done API call failed:', error);
    
    // Determine error type and return appropriate message
    let errorMessage = error.message;
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorMessage = ERROR_MESSAGES.network;
    } else if (error.name === 'AbortError') {
      errorMessage = ERROR_MESSAGES.timeout;
    } else if (error.message.includes('CORS')) {
      errorMessage = ERROR_MESSAGES.cors;
    }
    
    return { 
      success: false, 
      error: errorMessage,
      details: error.message 
    };
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  if (request.action === 'updateFields') {
    const { issueId, fields } = request;
    
    // Validate input
    if (!issueId || typeof issueId !== 'string') {
      sendResponse({ 
        success: false, 
        error: 'Invalid issue ID' 
      });
      return;
    }
    
    // Validate fields
    const validation = validateFields(fields);
    if (!validation.valid) {
      sendResponse({ 
        success: false, 
        error: validation.error 
      });
      return;
    }
    
    // Make API call
    updateJiraFields(issueId, fields)
      .then(result => {
        console.log('API call completed:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.error('API call error:', error);
        sendResponse({ 
          success: false, 
          error: error.message || ERROR_MESSAGES.unknown 
        });
      });
    
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'getDefaultFields') {
    const defaultFields = {
      customfield_13812: 5,        // Story Points
      customfield_16030: 8,        // Estimated Story Points
      customfield_16195: 7,        // Actual Story Points
      customfield_16328: {value: "None"},  // Localization
      customfield_16228: {value: "Yes"},    // Tested on FB?
      customfield_16921: {value: "Add option"}  // Feature Enablement
    };
    sendResponse({ success: true, fields: defaultFields });
    return;
  }
  
  if (request.action === 'saveFieldConfig') {
    chrome.storage.sync.set({ fieldConfig: request.fields })
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ 
          success: false, 
          error: 'Failed to save configuration' 
        });
      });
    return true;
  }
  
  if (request.action === 'loadFieldConfig') {
    chrome.storage.sync.get(['fieldConfig'])
      .then(result => {
        const fields = result.fieldConfig || {
          customfield_13812: 5,
          customfield_16030: 8,
          customfield_16195: 7,
          customfield_16328: {value: "None"},
          customfield_16228: {value: "Yes"},
          customfield_16921: {value: "Add option"}
        };
        sendResponse({ success: true, fields });
      })
      .catch(error => {
        sendResponse({ 
          success: false, 
          error: 'Failed to load configuration' 
        });
      });
    return true;
  }
  
  if (request.action === 'moveToDone') {
    const { issueId } = request;
    
    // Validate input
    if (!issueId || typeof issueId !== 'string') {
      sendResponse({ 
        success: false, 
        error: 'Invalid issue ID' 
      });
      return;
    }
    
    // Make API call to move ticket to Done
    moveJiraToDone(issueId)
      .then(result => {
        console.log('Move to Done completed:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.error('Move to Done error:', error);
        sendResponse({ 
          success: false, 
          error: error.message || ERROR_MESSAGES.unknown 
        });
      });
    
    return true; // Keep message channel open for async response
  }
  
  // Unknown action
  sendResponse({ 
    success: false, 
    error: 'Unknown action' 
  });
});

// Handle extension installation/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Jira Field Filler extension installed/updated:', details.reason);
  
  // Set default configuration if first install
  if (details.reason === 'install') {
    const defaultFields = {
      customfield_13812: 5,
      customfield_16030: 8,
      customfield_16195: 7,
      customfield_16328: {value: "None"},
      customfield_16228: {value: "Yes"},
      customfield_16921: {value: "Add option"}
    };
    
    chrome.storage.sync.set({ fieldConfig: defaultFields })
      .then(() => {
        console.log('Default field configuration saved');
      })
      .catch(error => {
        console.error('Failed to save default configuration:', error);
      });
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Jira Field Filler extension started');
});
