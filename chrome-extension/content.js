// MilkTheLink Chrome Extension - Content Script
// This script runs on all web pages to enable email extraction

(function() {
  'use strict';
  
  // Email regex patterns - global for matching, non-global for validation
  const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const EMAIL_VALIDATION_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractEmails') {
      const emails = extractEmailsFromPage();
      sendResponse({ emails });
    }
    return true; // Keep the message channel open for async response
  });
  
  // Extract emails from the current page
  function extractEmailsFromPage() {
    const emails = new Set();
    
    // 1. Extract from visible text content
    const bodyText = document.body.innerText || '';
    const textMatches = bodyText.match(EMAIL_REGEX) || [];
    textMatches.forEach(email => emails.add(email.toLowerCase()));
    
    // 2. Extract from mailto links
    const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
    mailtoLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href) {
        const email = href.replace('mailto:', '').split('?')[0].toLowerCase();
        if (EMAIL_VALIDATION_REGEX.test(email)) {
          emails.add(email);
        }
      }
    });
    
    // 3. Extract from data attributes
    const dataEmailElements = document.querySelectorAll('[data-email], [data-mail], [data-contact]');
    dataEmailElements.forEach(el => {
      const attrs = ['data-email', 'data-mail', 'data-contact'];
      attrs.forEach(attr => {
        const value = el.getAttribute(attr);
        if (value && EMAIL_VALIDATION_REGEX.test(value)) {
          emails.add(value.toLowerCase());
        }
      });
    });
    
    // 4. Extract from input fields (contact forms, etc.)
    const inputs = document.querySelectorAll('input[type="email"], input[name*="email"], input[id*="email"]');
    inputs.forEach(input => {
      if (input.value && EMAIL_VALIDATION_REGEX.test(input.value)) {
        emails.add(input.value.toLowerCase());
      }
    });
    
    // 5. Extract from HTML comments (sometimes emails are in comments)
    const walker = document.createTreeWalker(
      document.documentElement,
      NodeFilter.SHOW_COMMENT,
      null,
      false
    );
    
    let comment;
    while (comment = walker.nextNode()) {
      const commentMatches = comment.nodeValue.match(EMAIL_REGEX) || [];
      commentMatches.forEach(email => emails.add(email.toLowerCase()));
    }
    
    // Filter out invalid/example emails
    return filterEmails(Array.from(emails));
  }
  
  // Filter out false positives and example emails
  function filterEmails(emails) {
    const invalidPatterns = [
      /\.(png|jpg|jpeg|gif|webp|svg|css|js|ico|woff|woff2|ttf|eot)$/i,
      /(example|test|domain|yoursite|yourdomain|sample|placeholder)\.(com|org|net|io)/i,
      /^(no-?reply|noreply|donotreply|do-not-reply)/i,
      /sentry\.io$/i,
      /webpack/i
    ];
    
    return emails.filter(email => {
      // Check against invalid patterns
      for (const pattern of invalidPatterns) {
        if (pattern.test(email)) {
          return false;
        }
      }
      
      // Additional validation
      const parts = email.split('@');
      if (parts.length !== 2) return false;
      if (parts[0].length < 1 || parts[1].length < 4) return false;
      if (!parts[1].includes('.')) return false;
      
      return true;
    });
  }
  
  // Quick extract function that can be called from popup
  window.milkthelinkExtract = extractEmailsFromPage;
  
})();
