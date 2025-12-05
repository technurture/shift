# MailSift Chrome Extension

Extract email addresses from any website instantly with the MailSift Chrome Extension.

## Features

- **One-Click Extraction**: Extract emails from any webpage with a single click
- **Smart Detection**: Finds emails in text, mailto links, and data attributes
- **Copy & Save**: Copy emails to clipboard or save to your MailSift account
- **Account Sync**: Syncs with your MailSift account for unlimited access
- **Privacy Focused**: Only extracts emails when you click - no background tracking

## Installation

### For Development/Testing

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked"
4. Select the `chrome-extension` folder from this project
5. The extension icon should appear in your toolbar

### For Production

1. Create icons (16x16, 32x32, 48x48, 128x128 PNG files) and place them in the `icons/` folder
2. Zip the entire `chrome-extension` folder
3. Submit to the Chrome Web Store

## Creating Icons

You need to create 4 icon sizes:
- `icon16.png` - 16x16 pixels
- `icon32.png` - 32x32 pixels  
- `icon48.png` - 48x48 pixels
- `icon128.png` - 128x128 pixels

Recommended: Use a purple/violet gradient matching the MailSift brand.

## Configuration

Update the `API_BASE_URL` in these files with your production domain:
- `popup.js`
- `background.js`

```javascript
const API_BASE_URL = 'https://your-domain.com';
```

## Usage

1. Navigate to any website
2. Click the MailSift extension icon
3. Click "Extract Emails from This Page"
4. View, copy, or save the extracted emails

## Permissions Explained

- `activeTab`: Access the current tab to extract emails
- `storage`: Store user authentication locally
- `scripting`: Inject extraction script into pages

## Support

For support, visit the MailSift dashboard or contact support@mailsift.com
