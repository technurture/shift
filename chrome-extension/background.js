// MailSift Chrome Extension - Background Service Worker

// Update this with your production domain when deploying
const API_BASE_URL = 'https://415e01b1-e6ef-463a-8513-1b94cf932054-00-2illqfo9cdugi.kirk.replit.dev';

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('MailSift extension installed');
    // Open welcome page or dashboard
    chrome.tabs.create({ url: `${API_BASE_URL}?ref=extension` });
  }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getAuthStatus') {
    getAuthStatus().then(sendResponse);
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'saveExtraction') {
    saveExtraction(request.data).then(sendResponse);
    return true;
  }
  
  if (request.action === 'login') {
    handleLogin(request.credentials).then(sendResponse);
    return true;
  }
  
  if (request.action === 'logout') {
    handleLogout().then(sendResponse);
    return true;
  }
});

// Check authentication status
async function getAuthStatus() {
  try {
    const { authToken } = await chrome.storage.local.get(['authToken']);
    
    if (!authToken) {
      return { isLoggedIn: false };
    }
    
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.ok) {
      const user = await response.json();
      return { isLoggedIn: true, user };
    } else {
      // Token expired, clear it
      await chrome.storage.local.remove(['authToken', 'userData']);
      return { isLoggedIn: false };
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    return { isLoggedIn: false, error: error.message };
  }
}

// Handle login
async function handleLogin(credentials) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/mobile/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    });
    
    if (response.ok) {
      const data = await response.json();
      await chrome.storage.local.set({
        authToken: data.token,
        userData: data.user
      });
      return { success: true, user: data.user };
    } else {
      const error = await response.json();
      return { success: false, error: error.message || 'Login failed' };
    }
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
}

// Handle logout
async function handleLogout() {
  try {
    await chrome.storage.local.remove(['authToken', 'userData']);
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: error.message };
  }
}

// Save extraction to the server
async function saveExtraction(data) {
  try {
    const { authToken } = await chrome.storage.local.get(['authToken']);
    
    if (!authToken) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const response = await fetch(`${API_BASE_URL}/api/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      const result = await response.json();
      return { success: true, data: result };
    } else {
      const error = await response.json();
      return { success: false, error: error.message || 'Failed to save' };
    }
  } catch (error) {
    console.error('Save extraction error:', error);
    return { success: false, error: error.message };
  }
}

// Context menu for quick extraction
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'mailsift-extract',
    title: 'Extract emails with MailSift',
    contexts: ['page', 'selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'mailsift-extract') {
    // Open popup or trigger extraction
    chrome.action.openPopup();
  }
});
