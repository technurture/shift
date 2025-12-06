// MailSift Chrome Extension - Popup Script

// Update this with your production domain when deploying
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000' 
  : 'https://415e01b1-e6ef-463a-8513-1b94cf932054-00-2illqfo9cdugi.kirk.replit.dev';

let currentEmails = [];
let isLoggedIn = false;
let userStats = null;

// DOM Elements
const elements = {
  currentUrl: document.getElementById('current-url'),
  extractBtn: document.getElementById('extract-btn'),
  loading: document.getElementById('loading'),
  results: document.getElementById('results'),
  noResults: document.getElementById('no-results'),
  error: document.getElementById('error'),
  errorMessage: document.getElementById('error-message'),
  emailList: document.getElementById('email-list'),
  emailCount: document.getElementById('email-count'),
  copyAllBtn: document.getElementById('copy-all-btn'),
  saveBtn: document.getElementById('save-btn'),
  retryBtn: document.getElementById('retry-btn'),
  authSection: document.getElementById('auth-section'),
  mainSection: document.getElementById('main-section'),
  loginBtn: document.getElementById('login-btn'),
  signupLink: document.getElementById('signup-link'),
  dashboardLink: document.getElementById('dashboard-link'),
  userStatus: document.getElementById('user-status'),
  statsText: document.getElementById('stats-text'),
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toast-message')
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await getCurrentTab();
  await checkAuthStatus();
  setupEventListeners();
});

// Get current tab URL
async function getCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const url = new URL(tab.url);
      elements.currentUrl.textContent = url.hostname + url.pathname.slice(0, 30) + (url.pathname.length > 30 ? '...' : '');
      elements.dashboardLink.href = API_BASE_URL + '/dashboard';
    }
  } catch (error) {
    elements.currentUrl.textContent = 'Unable to get current page';
  }
}

// Check if user is logged in
async function checkAuthStatus() {
  try {
    const { authToken, userData } = await chrome.storage.local.get(['authToken', 'userData']);
    
    if (authToken) {
      // Verify token is still valid
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const user = await response.json();
        isLoggedIn = true;
        userStats = user;
        updateUIForLoggedInUser(user);
        return;
      } else {
        // Token expired, clear it
        await chrome.storage.local.remove(['authToken', 'userData']);
      }
    }
    
    updateUIForLoggedOutUser();
  } catch (error) {
    console.error('Auth check failed:', error);
    updateUIForLoggedOutUser();
  }
}

function updateUIForLoggedInUser(user) {
  elements.userStatus.textContent = user.email;
  elements.userStatus.classList.add('logged-in');
  elements.authSection.classList.add('hidden');
  elements.mainSection.classList.remove('hidden');
  
  const plan = user.plan || 'free';
  const limit = plan === 'free' ? 500 : plan === 'basic' ? 1000 : 'Unlimited';
  const remaining = typeof limit === 'number' ? Math.max(0, limit - (user.emailsExtracted || 0)) : 'Unlimited';
  elements.statsText.textContent = `${plan.charAt(0).toUpperCase() + plan.slice(1)}: ${remaining} emails remaining`;
}

function updateUIForLoggedOutUser() {
  isLoggedIn = false;
  elements.userStatus.textContent = 'Not signed in';
  elements.userStatus.classList.remove('logged-in');
  // Still allow extraction but show save option as disabled
  elements.mainSection.classList.remove('hidden');
  elements.statsText.textContent = 'Sign in to save emails';
}

// Setup event listeners
function setupEventListeners() {
  elements.extractBtn.addEventListener('click', extractEmails);
  elements.copyAllBtn.addEventListener('click', copyAllEmails);
  elements.saveBtn.addEventListener('click', saveToAccount);
  elements.retryBtn.addEventListener('click', extractEmails);
  elements.loginBtn.addEventListener('click', openLogin);
  elements.signupLink.addEventListener('click', openSignup);
  elements.dashboardLink.addEventListener('click', openDashboard);
}

// Extract emails from current page
async function extractEmails() {
  showLoading();
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
      throw new Error('Unable to access current tab');
    }
    
    // Check if we can inject scripts
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      throw new Error('Cannot extract emails from browser pages');
    }
    
    // Execute content script to extract emails
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractEmailsFromPage
    });
    
    if (results && results[0] && results[0].result) {
      currentEmails = results[0].result;
      
      if (currentEmails.length > 0) {
        showResults(currentEmails);
      } else {
        showNoResults();
      }
    } else {
      showNoResults();
    }
  } catch (error) {
    console.error('Extraction error:', error);
    showError(error.message || 'Failed to extract emails');
  }
}

// Function injected into the page to extract emails
function extractEmailsFromPage() {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = new Set();
  
  // Get all text content
  const bodyText = document.body.innerText || '';
  const matches = bodyText.match(emailRegex) || [];
  matches.forEach(email => emails.add(email.toLowerCase()));
  
  // Check mailto links
  const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
  mailtoLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href) {
      const email = href.replace('mailto:', '').split('?')[0].toLowerCase();
      if (emailRegex.test(email)) {
        emails.add(email);
      }
    }
  });
  
  // Check data attributes that might contain emails
  const allElements = document.querySelectorAll('[data-email], [data-mail]');
  allElements.forEach(el => {
    const dataEmail = el.getAttribute('data-email') || el.getAttribute('data-mail');
    if (dataEmail && emailRegex.test(dataEmail)) {
      emails.add(dataEmail.toLowerCase());
    }
  });
  
  // Check for Cloudflare-obfuscated emails (data-cfemail attribute)
  const cfEmailElements = document.querySelectorAll('[data-cfemail]');
  cfEmailElements.forEach(el => {
    const encoded = el.getAttribute('data-cfemail');
    if (encoded) {
      try {
        const decoded = decodeCfEmail(encoded);
        if (decoded && emailRegex.test(decoded)) {
          emails.add(decoded.toLowerCase());
        }
      } catch (e) {
        // Skip invalid encoded emails
      }
    }
  });
  
  // Decode Cloudflare email protection
  function decodeCfEmail(encoded) {
    let email = '';
    const r = parseInt(encoded.substr(0, 2), 16);
    for (let i = 2; i < encoded.length; i += 2) {
      const c = parseInt(encoded.substr(i, 2), 16) ^ r;
      email += String.fromCharCode(c);
    }
    return email;
  }
  
  // Extract from JSON-LD structured data
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  jsonLdScripts.forEach(script => {
    try {
      const data = JSON.parse(script.textContent);
      extractEmailsFromJsonLd(data);
    } catch (e) {
      // Skip invalid JSON
    }
  });
  
  function extractEmailsFromJsonLd(obj) {
    if (!obj || typeof obj !== 'object') return;
    
    if (Array.isArray(obj)) {
      obj.forEach(item => extractEmailsFromJsonLd(item));
      return;
    }
    
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (typeof value === 'string') {
        if (key.toLowerCase() === 'email' || key.toLowerCase().includes('email')) {
          const cleanEmail = value.replace('mailto:', '').toLowerCase();
          if (emailRegex.test(cleanEmail)) {
            emails.add(cleanEmail);
          }
        }
        const foundEmails = value.match(emailRegex) || [];
        foundEmails.forEach(email => emails.add(email.toLowerCase()));
      } else if (typeof value === 'object') {
        extractEmailsFromJsonLd(value);
      }
    }
  }
  
  // Look for encoded email patterns like [at], (at), [dot], (dot), etc.
  const encodedEmailPatterns = [
    /([a-zA-Z0-9._%+-]+)\s*[\[\(]\s*at\s*[\]\)]\s*([a-zA-Z0-9.-]+)\s*[\[\(]\s*dot\s*[\]\)]\s*([a-zA-Z]{2,})/gi,
    /([a-zA-Z0-9._%+-]+)\s*\[at\]\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    /([a-zA-Z0-9._%+-]+)\s*\(at\)\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    /([a-zA-Z0-9._%+-]+)\s*@\s*([a-zA-Z0-9.-]+)\s*[\[\(]\s*dot\s*[\]\)]\s*([a-zA-Z]{2,})/gi,
  ];
  
  const pageHtml = document.body.innerHTML || '';
  
  encodedEmailPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(pageHtml)) !== null) {
      let email;
      if (match.length === 4) {
        email = `${match[1]}@${match[2]}.${match[3]}`.toLowerCase();
      } else if (match.length === 3) {
        email = `${match[1]}@${match[2]}`.toLowerCase();
      }
      if (email && emailRegex.test(email)) {
        emails.add(email);
      }
    }
  });
  
  // Filter out common false positives
  const filtered = Array.from(emails).filter(email => {
    const lowerEmail = email.toLowerCase();
    // Filter out image/file extensions mistaken as emails
    if (lowerEmail.endsWith('.png') || lowerEmail.endsWith('.jpg') || 
        lowerEmail.endsWith('.gif') || lowerEmail.endsWith('.webp') ||
        lowerEmail.endsWith('.svg') || lowerEmail.endsWith('.css') ||
        lowerEmail.endsWith('.js')) {
      return false;
    }
    // Filter out example emails
    if (lowerEmail.includes('example.com') || lowerEmail.includes('test.com') ||
        lowerEmail.includes('domain.com') || lowerEmail.includes('yoursite.com')) {
      return false;
    }
    return true;
  });
  
  return filtered;
}

// UI State functions
function showLoading() {
  hideAllStates();
  elements.loading.classList.remove('hidden');
  elements.extractBtn.disabled = true;
}

function showResults(emails) {
  hideAllStates();
  elements.results.classList.remove('hidden');
  elements.emailCount.textContent = `${emails.length} email${emails.length !== 1 ? 's' : ''} found`;
  
  elements.emailList.innerHTML = '';
  emails.forEach(email => {
    const li = document.createElement('li');
    li.className = 'email-item';
    li.innerHTML = `
      <span class="email-text">${email}</span>
      <button class="copy-btn" data-email="${email}" title="Copy">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
      </button>
    `;
    elements.emailList.appendChild(li);
  });
  
  // Add click handlers for individual copy buttons
  elements.emailList.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      copyToClipboard(btn.dataset.email);
      showToast('Email copied!');
    });
  });
  
  elements.extractBtn.disabled = false;
}

function showNoResults() {
  hideAllStates();
  elements.noResults.classList.remove('hidden');
  elements.extractBtn.disabled = false;
}

function showError(message) {
  hideAllStates();
  elements.error.classList.remove('hidden');
  elements.errorMessage.textContent = message;
  elements.extractBtn.disabled = false;
}

function hideAllStates() {
  elements.loading.classList.add('hidden');
  elements.results.classList.add('hidden');
  elements.noResults.classList.add('hidden');
  elements.error.classList.add('hidden');
}

// Copy functions
function copyAllEmails() {
  if (currentEmails.length === 0) return;
  copyToClipboard(currentEmails.join('\n'));
  showToast(`${currentEmails.length} emails copied!`);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(err => {
    console.error('Failed to copy:', err);
  });
}

// Save to account
async function saveToAccount() {
  if (!isLoggedIn) {
    showToast('Please sign in to save emails');
    return;
  }
  
  if (currentEmails.length === 0) {
    showToast('No emails to save');
    return;
  }
  
  try {
    const { authToken } = await chrome.storage.local.get(['authToken']);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const response = await fetch(`${API_BASE_URL}/api/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        url: tab.url,
        emails: currentEmails
      })
    });
    
    if (response.ok) {
      showToast('Saved to your account!');
    } else {
      const error = await response.json();
      showToast(error.message || 'Failed to save');
    }
  } catch (error) {
    console.error('Save error:', error);
    showToast('Failed to save emails');
  }
}

// Navigation functions
function openLogin(e) {
  e.preventDefault();
  chrome.tabs.create({ url: `${API_BASE_URL}/auth?mode=login` });
}

function openSignup(e) {
  e.preventDefault();
  chrome.tabs.create({ url: `${API_BASE_URL}/auth?mode=signup` });
}

function openDashboard(e) {
  e.preventDefault();
  chrome.tabs.create({ url: `${API_BASE_URL}/dashboard` });
}

// Toast notification
function showToast(message) {
  elements.toastMessage.textContent = message;
  elements.toast.classList.remove('hidden');
  
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 2500);
}
