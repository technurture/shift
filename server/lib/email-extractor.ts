import * as cheerio from "cheerio";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import dns from "dns";
import { promisify } from "util";

// Add stealth plugin for better anti-bot bypass
puppeteer.use(StealthPlugin());

const resolveMx = promisify(dns.resolveMx);

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Disposable email domains blacklist
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
  '10minutemail.com', 'temp-mail.org', 'fakeinbox.com', 'getnada.com',
  'maildrop.cc', 'yopmail.com', 'trashmail.com', 'sharklasers.com',
  'dispostable.com', 'mailnesia.com', 'spamgourmet.com', 'mytrashmail.com',
  'emailondeck.com', 'tempr.email', 'mohmal.com', 'tempail.com',
]);

const OBFUSCATED_PATTERNS = [
  /([a-zA-Z0-9._%+-]+)\s*\[\s*at\s*\]\s*([a-zA-Z0-9.-]+)\s*\[\s*dot\s*\]\s*([a-zA-Z]{2,})/gi,
  /([a-zA-Z0-9._%+-]+)\s*\(\s*at\s*\)\s*([a-zA-Z0-9.-]+)\s*\(\s*dot\s*\)\s*([a-zA-Z]{2,})/gi,
  /([a-zA-Z0-9._%+-]+)\s*@\s*([a-zA-Z0-9.-]+)\s*\.\s*([a-zA-Z]{2,})/g,
  /([a-zA-Z0-9._%+-]+)\s*\[at\]\s*([a-zA-Z0-9.-]+)\s*\[dot\]\s*([a-zA-Z]{2,})/gi,
  /([a-zA-Z0-9._%+-]+)\s*\(at\)\s*([a-zA-Z0-9.-]+)\s*\(dot\)\s*([a-zA-Z]{2,})/gi,
  /([a-zA-Z0-9._%+-]+)\s+at\s+([a-zA-Z0-9.-]+)\s+dot\s+([a-zA-Z]{2,})/gi,
  /([a-zA-Z0-9._%+-]+)\s*<at>\s*([a-zA-Z0-9.-]+)\s*<dot>\s*([a-zA-Z]{2,})/gi,
  /([a-zA-Z0-9._%+-]+)\s*{at}\s*([a-zA-Z0-9.-]+)\s*{dot}\s*([a-zA-Z]{2,})/gi,
  /([a-zA-Z0-9._%+-]+)\s*#at#\s*([a-zA-Z0-9.-]+)\s*#dot#\s*([a-zA-Z]{2,})/gi,
  /([a-zA-Z0-9._%+-]+)\s*-at-\s*([a-zA-Z0-9.-]+)\s*-dot-\s*([a-zA-Z]{2,})/gi,
  /([a-zA-Z0-9._%+-]+)\s*_at_\s*([a-zA-Z0-9.-]+)\s*_dot_\s*([a-zA-Z]{2,})/gi,
  /([a-zA-Z0-9._%+-]+)\s*@\s*([a-zA-Z0-9.-]+)\s*\(dot\)\s*([a-zA-Z]{2,})/gi,
  /([a-zA-Z0-9._%+-]+)\s*\(at\)\s*([a-zA-Z0-9.-]+)\s*\.\s*([a-zA-Z]{2,})/gi,
];

const CRITICAL_POLICY_PATHS = [
  '/policies/terms-of-service',
  '/policies/privacy-policy',
  '/policies/refund-policy',
  '/policies/shipping-policy',
  '/policies/contact-information',
  '/policies/legal-notice',
  '/policies/terms',
  '/policies/privacy',
  '/policies/tos',
  '/terms-of-service',
  '/privacy-policy',
  '/terms-and-conditions',
  '/legal/terms',
  '/legal/privacy',
  '/tos',
  '/pages/terms-of-service',
  '/pages/privacy-policy',
  '/pages/terms-and-conditions',
  '/pages/contact-us',
  '/pages/about-us',
  '/pages/contact',
  '/pages/about',
  '/pages/legal',
  '/pages/imprint',
  '/page/terms-of-service',
  '/page/privacy-policy',
  '/page/contact',
  '/page/about',
  '/checkout',
  '/cart',
  '/checkouts',
  '/account',
  '/account/login',
  '/account/register',
  '/pages/faq',
  '/pages/faqs',
  '/pages/shipping',
  '/pages/returns',
  '/pages/warranty',
  '/pages/size-guide',
  '/pages/track-order',
  '/pages/order-tracking',
  '/collections',
  '/products',
  '/apps/helpdesk',
  '/apps/help-center',
  '/apps/contact-form',
  // Shopify specific paths
  '/checkout/contact_information',
  '/checkout/shipping',
  '/checkout/payment',
  '/checkout/thank_you',
  '/account/addresses',
  '/account/orders',
  '/orders/customer_lookup',
  '/tools/recurring',
  '/a/account',
  '/a/orders',
  '/apps/easy-contact-form',
  '/apps/formbuilder',
  '/community/store-information',
  '/admin/settings',
  // WordPress specific paths
  '/wp-content/themes',
  '/wp-admin',
  '/wp-login.php',
  '/wp-includes',
  '/xmlrpc.php',
  '/wp-json/contact-form-7',
  '/wp-json/wp/v2/pages',
  '/wp-content/plugins/contact-form-7',
  '/author',
  '/feed',
  // WooCommerce specific paths
  '/my-account',
  '/my-account/edit-account',
  '/my-account/orders',
  '/my-account/addresses',
  '/wc-api',
  '/shop',
  '/product-category',
  '/product',
  '/woocommerce',
  '/checkout/order-pay',
  '/checkout/order-received',
  '/shop/customer-service',
  '/shop/contact',
  // Magento specific paths
  '/customer/account',
  '/customer/account/login',
  '/customer/account/create',
  '/checkout/cart',
  '/checkout/onepage',
  '/sales/order/history',
  '/contacts',
  '/catalogsearch',
  '/cms/page',
  '/cms/noroute',
  // BigCommerce specific paths
  '/account.php',
  '/cart.php',
  '/checkout.php',
  '/createaccount.php',
  '/login.php',
  '/wishlist.php',
  // PrestaShop specific paths
  '/contact-us',
  '/my-account',
  '/order-history',
  '/addresses',
  '/identity',
  '/module/contactform/contactform',
  // OpenCart specific paths
  '/index.php?route=account/account',
  '/index.php?route=checkout/checkout',
  '/index.php?route=information/contact',
  // Squarespace specific paths
  '/config',
  '/commerce',
  '/api/commerce',
  // Wix specific paths
  '/_api/wix-ecommerce',
  '/_api/members',
  '/members-area',
  // CRM and Support platforms
  '/support/tickets',
  '/support/new',
  '/helpdesk',
  '/ticket',
  '/tickets',
  '/submit-request',
  '/hc/en-us/requests/new',
  '/knowledge-base',
  '/kb',
  '/zendesk',
  '/freshdesk',
  '/intercom',
  '/hubspot',
  '/salesforce',
  '/crm',
  '/customer-portal',
  '/portal',
  '/client-area',
  '/clientarea',
  '/members',
  '/membership',
  '/dashboard',
  '/user/dashboard',
  '/account/dashboard',
];

// Platform detection patterns
const PLATFORM_SIGNATURES = {
  shopify: [
    'cdn.shopify.com',
    'myshopify.com',
    'shopify-assets',
    'Shopify.theme',
    'shopify_analytics',
    'ShopifyAnalytics',
    '/checkouts/',
    'shopify_pay',
  ],
  wordpress: [
    'wp-content',
    'wp-includes',
    'wp-json',
    'WordPress',
    'xmlrpc.php',
    'wp-admin',
    'wp-login.php',
  ],
  woocommerce: [
    'woocommerce',
    'wc-add-to-cart',
    'wc_add_to_cart',
    'WooCommerce',
    '/wc-api/',
    'wc-blocks',
  ],
  magento: [
    'Mage.',
    'mage/',
    '/static/version',
    'Magento_',
    'catalogsearch',
    '/customer/account',
  ],
  bigcommerce: [
    'cdn.bigcommerce.com',
    'stencil',
    'bigcommerce',
    '/api/storefront/',
  ],
  squarespace: [
    'squarespace.com',
    'static1.squarespace.com',
    'sqsp',
    'sqs-layout',
  ],
  wix: [
    'wix.com',
    'wixsite.com',
    'wix-users',
    '_wix_',
    'parastorage.com',
  ],
  hubspot: [
    'hubspot.com',
    'hs-scripts.com',
    'hsforms.com',
    'HubSpot',
  ],
  zendesk: [
    'zendesk.com',
    'zdassets.com',
    'zopim',
    'zendesk_widget',
  ],
  salesforce: [
    'force.com',
    'salesforce.com',
    'salesforce-experience',
  ],
  freshdesk: [
    'freshdesk.com',
    'freshworks.com',
  ],
};

// Shopify-specific endpoints to check for contact info
const SHOPIFY_API_ENDPOINTS = [
  '/products.json',
  '/collections.json', 
  '/pages.json',
  '/blogs.json',
  '/shop.js',
  '/cart.js',
  '/meta.json',
  '/?view=json',
  '/pages/contact.json',
  '/pages/about.json',
];

// Enhanced Shopify policy pages
const SHOPIFY_POLICY_PAGES = [
  '/policies/contact-information',
  '/policies/terms-of-service',
  '/policies/privacy-policy',
  '/policies/refund-policy',
  '/policies/shipping-policy',
  '/policies/legal-notice',
  '/pages/store-policy',
  '/pages/store-policies',
  '/pages/legal',
  '/pages/contact-us',
  '/pages/about-us',
  '/pages/about',
  '/pages/contact',
  '/pages/customer-service',
  '/pages/support',
  '/pages/help',
  '/pages/faq',
  '/pages/faqs',
  '/pages/team',
  '/pages/our-team',
  '/pages/our-story',
];

const PRIORITY_CONTACT_PATHS = [
  ...CRITICAL_POLICY_PATHS,
  '/contact',
  '/contact-us',
  '/contactus',
  '/contact.html',
  '/contact.php',
  '/about/contact',
  '/about-us/contact',
  '/support',
  '/support/contact',
  '/help',
  '/help/contact',
  '/help-center',
  '/helpcenter',
  '/customer-service',
  '/customer-support',
  '/get-in-touch',
  '/reach-us',
  '/write-to-us',
  '/email-us',
  '/about',
  '/about-us',
  '/aboutus',
  '/about.html',
  '/company',
  '/company/about',
  '/team',
  '/our-team',
  '/meet-the-team',
  '/leadership',
  '/management',
  '/legal',
  '/legal/terms',
  '/legal/privacy',
  '/legal/tos',
  '/legal/terms-of-service',
  '/privacy',
  '/privacy-policy',
  '/privacypolicy',
  '/terms',
  '/terms-of-service',
  '/termsofservice',
  '/terms-and-conditions',
  '/termsandconditions',
  '/tos',
  '/t-and-c',
  '/tc',
  '/conditions',
  '/disclaimer',
  '/imprint',
  '/impressum',
  '/info',
  '/information',
  '/faq',
  '/faqs',
  '/frequently-asked-questions',
  '/careers',
  '/jobs',
  '/work-with-us',
  '/join-us',
  '/press',
  '/media',
  '/newsroom',
  '/news',
  '/blog',
  '/sp-help-center',
  '/seller-center',
  '/vendor',
  '/partners',
  '/become-a-partner',
  '/sp-contact',
  '/sp-about_us',
  '/login',
  '/signin',
  '/sign-in',
  '/signup',
  '/sign-up',
  '/register',
  '/authentication',
  '/auth',
  '/footer',
  '/sitemap',
  '/site-map',
  '/pages/contact',
  '/pages/about',
  '/pages/terms',
  '/pages/privacy',
  '/page/contact',
  '/page/about',
  '/page/terms',
  '/en/contact',
  '/en/about',
  '/en/terms',
  '/us/contact',
  '/us/about',
  // WooCommerce and other e-commerce platforms (not in CRITICAL_POLICY_PATHS)
  '/shop/terms-and-conditions',
  '/shop/privacy-policy',
  '/store/terms',
  '/store/privacy',
  '/policy/terms',
  '/policy/privacy',
  '/policy/tos',
  '/info/contact',
  '/info/about',
  '/info/terms',
];

const DESKTOP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const DESKTOP_VIEWPORT = { width: 1920, height: 1080 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

const COMMON_EMAIL_PREFIXES = [
  'info',
  'contact',
  'support',
  'help',
  'hello',
  'hi',
  'sales',
  'admin',
  'enquiry',
  'enquiries',
  'inquiry',
  'service',
  'customerservice',
  'customer-service',
  'customercare',
  'customer-care',
  'feedback',
  'press',
  'media',
  'pr',
  'marketing',
  'hr',
  'careers',
  'jobs',
  'legal',
  'billing',
  'accounts',
  'orders',
  'team',
  'office',
  'general',
];

export interface ExtractionResult {
  emails: string[];
  error?: string;
  pagesScanned?: number;
  methods?: string[];
  validatedEmails?: string[];
  extractionDetails?: {
    blocked?: boolean;
    blockedReason?: string;
    suggestedAction?: string;
  };
}

// MX record cache to avoid repeated DNS lookups
const mxCache = new Map<string, { hasMx: boolean; timestamp: number }>();
const MX_CACHE_TTL = 3600000; // 1 hour cache

// Validate email domain has MX records
async function validateEmailMx(email: string): Promise<boolean> {
  try {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;
    
    // Check cache first
    const cached = mxCache.get(domain);
    if (cached && Date.now() - cached.timestamp < MX_CACHE_TTL) {
      return cached.hasMx;
    }
    
    // Check for disposable email domains
    if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
      mxCache.set(domain, { hasMx: false, timestamp: Date.now() });
      return false;
    }
    
    // Perform MX lookup
    const mxRecords = await resolveMx(domain);
    const hasMx = mxRecords && mxRecords.length > 0;
    mxCache.set(domain, { hasMx, timestamp: Date.now() });
    return hasMx;
  } catch (error: any) {
    // DNS lookup failed - domain likely doesn't exist
    console.log(`[EmailValidator] MX lookup failed for ${email}: ${error.message}`);
    return false;
  }
}

// Batch validate emails with MX records
async function validateEmails(emails: string[]): Promise<string[]> {
  const validEmails: string[] = [];
  
  // Group by domain to reduce DNS lookups
  const byDomain = new Map<string, string[]>();
  for (const email of emails) {
    const domain = email.split('@')[1]?.toLowerCase();
    if (domain) {
      if (!byDomain.has(domain)) {
        byDomain.set(domain, []);
      }
      byDomain.get(domain)!.push(email);
    }
  }
  
  // Validate each domain once
  const validationPromises = Array.from(byDomain.entries()).map(async ([domain, domainEmails]) => {
    // Check first email of each domain
    const isValid = await validateEmailMx(domainEmails[0]);
    if (isValid) {
      return domainEmails;
    }
    return [];
  });
  
  const results = await Promise.all(validationPromises);
  results.forEach(emails => validEmails.push(...emails));
  
  return validEmails;
}

// Detect if page is blocked by anti-bot measures
interface BlockedStatus {
  isBlocked: boolean;
  reason?: string;
  suggestion?: string;
}

function detectBlockedPage(html: string, statusCode?: number): BlockedStatus {
  const lowerHtml = html.toLowerCase();
  
  // Common bot detection/CAPTCHA indicators
  const captchaPatterns = [
    'captcha', 'recaptcha', 'hcaptcha', 'cloudflare', 'cf-challenge',
    'challenge-running', 'ray-id', 'ddos-protection', 'bot-protection',
    'access denied', 'please verify', 'are you a robot', 'human verification',
    'security check', 'checking your browser', 'just a moment',
    'enable javascript', 'javascript is required',
  ];
  
  const isCaptcha = captchaPatterns.some(pattern => lowerHtml.includes(pattern));
  
  // Check for Cloudflare challenge page
  const isCloudflare = lowerHtml.includes('cloudflare') && 
    (lowerHtml.includes('checking your browser') || lowerHtml.includes('ray-id'));
  
  // Check for rate limiting
  const isRateLimited = lowerHtml.includes('rate limit') || 
    lowerHtml.includes('too many requests') || statusCode === 429;
  
  // Check for access denied
  const isAccessDenied = lowerHtml.includes('403 forbidden') || 
    lowerHtml.includes('access denied') || statusCode === 403;
  
  // Check for login required
  const isLoginRequired = (lowerHtml.includes('login') || lowerHtml.includes('sign in')) &&
    lowerHtml.includes('required');
  
  if (isCloudflare) {
    return {
      isBlocked: true,
      reason: 'Cloudflare protection detected',
      suggestion: 'The website uses Cloudflare protection. Try visiting the website directly and looking for contact information on their About or Contact page.'
    };
  }
  
  if (isCaptcha) {
    return {
      isBlocked: true,
      reason: 'CAPTCHA verification required',
      suggestion: 'The website requires human verification. Visit the website directly to find their contact email.'
    };
  }
  
  if (isRateLimited) {
    return {
      isBlocked: true,
      reason: 'Rate limited by the website',
      suggestion: 'Too many requests were made. Please try again in a few minutes.'
    };
  }
  
  if (isAccessDenied) {
    return {
      isBlocked: true,
      reason: 'Access denied by the website',
      suggestion: 'The website is blocking automated access. Try visiting directly to find contact info.'
    };
  }
  
  if (isLoginRequired) {
    return {
      isBlocked: true,
      reason: 'Login required',
      suggestion: 'This page requires authentication. Try the public contact or about pages instead.'
    };
  }
  
  return { isBlocked: false };
}

let browserInstance: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
let bedrockClient: BedrockRuntimeClient | null = null;

function getBedrockClient(): BedrockRuntimeClient | null {
  if (!process.env.ACCESS_KEY_ID || !process.env.SECRET_ACCESS_KEY) {
    return null;
  }
  
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
      },
    });
  }
  return bedrockClient;
}

// Random user agents for better anti-bot bypass
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    console.log('[EmailExtractor] Launching browser with stealth mode...');
    
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium';
    console.log(`[EmailExtractor] Using Chrome at: ${executablePath}`);
    
    browserInstance = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-first-run',
        '--safebrowsing-disable-auto-update',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
      ],
    });
    console.log('[EmailExtractor] Browser launched successfully with stealth');
  }
  return browserInstance;
}

// Extract emails from iframes on the page
async function extractFromIframes(page: any): Promise<Set<string>> {
  const emails = new Set<string>();
  
  try {
    const frames = page.frames();
    for (const frame of frames) {
      try {
        const frameContent = await frame.content();
        const frameEmails = extractEmailsFromHtml(frameContent);
        frameEmails.forEach(e => emails.add(e));
      } catch {
        // Frame might be cross-origin, skip
      }
    }
  } catch (error) {
    console.log('[EmailExtractor] Failed to extract from iframes');
  }
  
  return emails;
}

// Extract emails from Shadow DOM elements
async function extractFromShadowDOM(page: any): Promise<Set<string>> {
  const emails = new Set<string>();
  
  try {
    const shadowEmails = await page.evaluate(() => {
      const emails: string[] = [];
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      
      function traverseShadowRoots(root: Document | ShadowRoot) {
        const elements = root.querySelectorAll('*');
        elements.forEach(el => {
          // Check text content
          const text = el.textContent || '';
          const found = text.match(emailRegex);
          if (found) emails.push(...found);
          
          // Check attributes
          Array.from(el.attributes || []).forEach(attr => {
            const attrMatch = attr.value.match(emailRegex);
            if (attrMatch) emails.push(...attrMatch);
          });
          
          // Recursively check shadow roots
          if (el.shadowRoot) {
            traverseShadowRoots(el.shadowRoot);
          }
        });
      }
      
      traverseShadowRoots(document);
      return emails;
    });
    
    shadowEmails.forEach((email: string) => {
      if (isValidEmail(email.toLowerCase())) {
        emails.add(email.toLowerCase());
      }
    });
  } catch (error) {
    console.log('[EmailExtractor] Failed to extract from Shadow DOM');
  }
  
  return emails;
}

// Wait for dynamic content to load with MutationObserver
async function waitForDynamicContent(page: any, timeout: number = 5000): Promise<void> {
  try {
    await page.evaluate((timeout: number) => {
      return new Promise<void>((resolve) => {
        let lastMutationTime = Date.now();
        const startTime = Date.now();
        
        const observer = new MutationObserver(() => {
          lastMutationTime = Date.now();
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true
        });
        
        // Check every 200ms if mutations have stopped
        const checkInterval = setInterval(() => {
          const now = Date.now();
          // If no mutations for 1 second, or total timeout reached
          if (now - lastMutationTime > 1000 || now - startTime > timeout) {
            clearInterval(checkInterval);
            observer.disconnect();
            resolve();
          }
        }, 200);
      });
    }, timeout);
  } catch {
    // Fallback to simple wait
    await new Promise(r => setTimeout(r, 2000));
  }
}

type DeviceMode = 'desktop' | 'mobile';

function isPolicyPage(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  const policyKeywords = [
    'policies', 'policy', 'terms', 'privacy', 'legal', 'tos', 
    'terms-of-service', 'privacy-policy', 'refund', 'shipping',
    'conditions', 'disclaimer', 'imprint', 'impressum'
  ];
  return policyKeywords.some(keyword => lowerUrl.includes(keyword));
}

function isShopifyOrEcommerce(html: string): boolean {
  const shopifyIndicators = [
    'cdn.shopify.com',
    'shopify.com',
    'Shopify.theme',
    'shopify-section',
    'ShopifyAnalytics',
    'myshopify.com',
    'woocommerce',
    'WooCommerce',
    'bigcommerce',
    'BigCommerce',
    'magento',
    'Magento',
    'prestashop',
    'opencart'
  ];
  return shopifyIndicators.some(indicator => html.includes(indicator));
}

interface FetchResult {
  html: string | null;
  blocked?: BlockedStatus;
  iframeEmails?: Set<string>;
  shadowEmails?: Set<string>;
}

async function fetchPageWithBrowser(url: string, waitTime: number = 3000, mode: DeviceMode = 'desktop', fullScroll: boolean = false, isRetry: boolean = false): Promise<string | null> {
  let page: any = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    
    // Use random user agent for better anti-bot bypass
    const userAgent = mode === 'mobile' ? MOBILE_USER_AGENT : getRandomUserAgent();
    const viewport = mode === 'mobile' ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT;
    
    await page.setUserAgent(userAgent);
    await page.setViewport(viewport);
    
    // Set extra headers for more realistic requests
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
    });
    
    await page.setRequestInterception(true);
    page.on('request', (req: any) => {
      const resourceType = req.resourceType();
      if (['image', 'media', 'font'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    
    // Longer wait for retries to ensure JavaScript fully loads
    const effectiveWait = isRetry ? waitTime + 2000 : waitTime;
    await new Promise(resolve => setTimeout(resolve, effectiveWait));
    
    // Wait for Shopify-specific elements to load
    try {
      await page.waitForFunction(() => {
        // Check if page is fully loaded
        return document.readyState === 'complete';
      }, { timeout: 5000 });
    } catch {
      // Continue even if timeout
    }
    
    if (fullScroll || isPolicyPage(url)) {
      await page.evaluate(async () => {
        const scrollStep = 400;
        const scrollDelay = 80;
        const maxScrolls = 20;
        let scrollCount = 0;
        let lastHeight = 0;
        let stableCount = 0;
        
        while (scrollCount < maxScrolls && stableCount < 2) {
          const currentHeight = document.body.scrollHeight;
          if (currentHeight === lastHeight) {
            stableCount++;
          } else {
            stableCount = 0;
            lastHeight = currentHeight;
          }
          
          window.scrollBy(0, scrollStep);
          await new Promise(r => setTimeout(r, scrollDelay));
          
          if (window.scrollY + window.innerHeight >= document.body.scrollHeight) {
            break;
          }
          scrollCount++;
        }
        
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const html = await page.content();
    return html;
  } catch (error: any) {
    console.error(`[EmailExtractor] Browser fetch (${mode}) failed for ${url}:`, error.message);
    return null;
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {}
    }
  }
}

async function fetchWithMobileFallback(url: string, waitTime: number = 3000): Promise<{ html: string | null; mobileHtml: string | null; emails: Set<string>; usedMobile: boolean }> {
  const shouldFullScroll = isPolicyPage(url);
  console.log(`[EmailExtractor] Fetching with desktop viewport: ${url}${shouldFullScroll ? ' (full scroll for policy page)' : ''}`);
  
  // Use longer wait time for e-commerce sites
  const effectiveWaitTime = waitTime + 1000; // Add 1 second for more reliable extraction
  
  let desktopHtml = await fetchPageWithBrowser(url, effectiveWaitTime, 'desktop', shouldFullScroll, false);
  
  let allEmails = new Set<string>();
  let usedMobile = false;
  let mobileHtmlResult: string | null = null;
  let isEcommerce = false;
  
  if (desktopHtml) {
    isEcommerce = isShopifyOrEcommerce(desktopHtml);
    const desktopEmails = extractEmailsFromHtml(desktopHtml);
    desktopEmails.forEach(e => allEmails.add(e));
    console.log(`[EmailExtractor] Desktop extraction found ${desktopEmails.size} emails${isEcommerce ? ' (e-commerce site detected)' : ''}`);
    
    // Retry with longer wait if e-commerce site and no emails found
    if (desktopEmails.size === 0 && isEcommerce) {
      console.log(`[EmailExtractor] E-commerce site with no emails, retrying with longer wait...`);
      const retryHtml = await fetchPageWithBrowser(url, effectiveWaitTime + 2000, 'desktop', true, true);
      if (retryHtml) {
        const retryEmails = extractEmailsFromHtml(retryHtml);
        retryEmails.forEach(e => allEmails.add(e));
        if (retryEmails.size > 0) {
          console.log(`[EmailExtractor] Retry found ${retryEmails.size} emails`);
          desktopHtml = retryHtml;
        }
      }
    }
    
    if (allEmails.size < 2) {
      console.log(`[EmailExtractor] Few emails found on desktop, trying mobile viewport...`);
      const mobileHtml = await fetchPageWithBrowser(url, effectiveWaitTime, 'mobile', shouldFullScroll, false);
      
      if (mobileHtml) {
        mobileHtmlResult = mobileHtml;
        const mobileEmails = extractEmailsFromHtml(mobileHtml);
        const beforeCount = allEmails.size;
        mobileEmails.forEach(e => allEmails.add(e));
        const newFromMobile = allEmails.size - beforeCount;
        
        if (newFromMobile > 0) {
          console.log(`[EmailExtractor] Mobile extraction found ${newFromMobile} additional emails`);
          usedMobile = true;
        }
        
        return { html: desktopHtml, mobileHtml: mobileHtmlResult, emails: allEmails, usedMobile };
      }
    }
  } else {
    console.log(`[EmailExtractor] Desktop fetch failed, trying mobile as fallback...`);
    const mobileHtml = await fetchPageWithBrowser(url, effectiveWaitTime, 'mobile', shouldFullScroll, false);
    
    if (mobileHtml) {
      mobileHtmlResult = mobileHtml;
      isEcommerce = isShopifyOrEcommerce(mobileHtml);
      const mobileEmails = extractEmailsFromHtml(mobileHtml);
      mobileEmails.forEach(e => allEmails.add(e));
      usedMobile = true;
      
      // Retry mobile if e-commerce and no emails
      if (mobileEmails.size === 0 && isEcommerce) {
        console.log(`[EmailExtractor] E-commerce mobile with no emails, retrying...`);
        const retryMobile = await fetchPageWithBrowser(url, effectiveWaitTime + 2000, 'mobile', true, true);
        if (retryMobile) {
          const retryEmails = extractEmailsFromHtml(retryMobile);
          retryEmails.forEach(e => allEmails.add(e));
          if (retryEmails.size > 0) {
            console.log(`[EmailExtractor] Mobile retry found ${retryEmails.size} emails`);
            mobileHtmlResult = retryMobile;
          }
        }
      }
      
      return { html: mobileHtml, mobileHtml: mobileHtmlResult, emails: allEmails, usedMobile };
    }
  }
  
  return { html: desktopHtml, mobileHtml: mobileHtmlResult, emails: allEmails, usedMobile };
}

async function fetchPageSimple(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: AbortSignal.timeout(20000),
      redirect: 'follow',
    });
    
    if (!response.ok) return null;
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/xhtml')) {
      return null;
    }
    
    return await response.text();
  } catch (error: any) {
    console.error(`[EmailExtractor] Simple fetch failed for ${url}:`, error.message);
    return null;
  }
}

// Get the brand/company name from a domain
function getBrandName(domain: string): string {
  const cleanDomain = domain.replace('www.', '');
  const parts = cleanDomain.split('.');
  return parts[0];
}

// Check if domain has a country-code TLD (like .ng, .uk, .de)
function hasCountryCodeTLD(domain: string): boolean {
  const cleanDomain = domain.replace('www.', '');
  const parts = cleanDomain.split('.');
  // Patterns like .com.ng, .co.uk, .com.au
  if (parts.length >= 3) {
    const lastTwo = parts.slice(-2).join('.');
    const ccTLDs = ['com.ng', 'co.ng', 'com.uk', 'co.uk', 'com.au', 'co.au', 'com.br', 'com.mx', 'co.in', 'com.gh', 'co.ke', 'com.eg', 'co.za', 'com.pk', 'com.bd'];
    if (ccTLDs.includes(lastTwo)) return true;
  }
  // Two-letter country codes
  const tld = parts[parts.length - 1];
  return tld.length === 2 && parts.length >= 2;
}

// Get base domain without country code
function getBaseDomainWithoutCountryCode(domain: string): string {
  const cleanDomain = domain.replace('www.', '');
  const parts = cleanDomain.split('.');
  
  if (parts.length >= 3) {
    const lastTwo = parts.slice(-2).join('.');
    const ccTLDs = ['com.ng', 'co.ng', 'com.uk', 'co.uk', 'com.au', 'co.au', 'com.br', 'com.mx', 'co.in', 'com.gh', 'co.ke', 'com.eg', 'co.za', 'com.pk', 'com.bd'];
    if (ccTLDs.includes(lastTwo)) {
      return parts.slice(0, -2).join('.') + '.com';
    }
  }
  
  if (parts.length >= 2 && parts[parts.length - 1].length === 2) {
    return parts.slice(0, -1).join('.') + '.com';
  }
  
  return cleanDomain;
}

async function searchForEmails(domain: string): Promise<Set<string>> {
  const emails = new Set<string>();
  const brandName = getBrandName(domain);
  const cleanDomain = domain.replace('www.', '');
  
  // Get all possible email domains to search for
  const searchDomains = [cleanDomain];
  if (hasCountryCodeTLD(domain)) {
    searchDomains.push(getBaseDomainWithoutCountryCode(domain));
  }
  searchDomains.push(`${brandName}.com`);
  
  console.log(`[EmailExtractor] Searching for emails related to: ${searchDomains.join(', ')}`);
  
  const searchQueries = [
    // Search for brand emails
    `"@${brandName}" contact email`,
    `${brandName} official email address`,
    `${brandName} customer service email`,
    `${brandName} support email contact`,
    `"contact@${brandName}" OR "info@${brandName}" OR "support@${brandName}"`,
    // Site-specific searches
    `site:${cleanDomain} email contact`,
  ];
  
  // Add domain-specific searches
  for (const searchDomain of searchDomains) {
    searchQueries.push(`"@${searchDomain}"`);
  }
  
  for (const query of searchQueries.slice(0, 6)) {
    try {
      const encodedQuery = encodeURIComponent(query);
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(15000),
      });
      
      if (response.ok) {
        const html = await response.text();
        const foundEmails = html.match(EMAIL_REGEX) || [];
        foundEmails.forEach((email: string) => {
          const cleaned = email.toLowerCase().trim();
          // Accept emails from any of the search domains
          const isRelevant = searchDomains.some(d => cleaned.includes(d.split('.')[0]));
          if (isValidEmail(cleaned) && isRelevant) {
            emails.add(cleaned);
          }
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (err: any) {
      console.log(`[EmailExtractor] Search query failed: ${err.message}`);
    }
  }
  
  console.log(`[EmailExtractor] Web search found ${emails.size} emails`);
  return emails;
}

function getRelatedDomains(domain: string): string[] {
  const cleanDomain = domain.replace('www.', '');
  const brandName = getBrandName(domain);
  const parts = cleanDomain.split('.');
  
  const relatedDomains: string[] = [];
  const prefixes = ['group', 'corporate', 'corp', 'about', 'contact', 'info', 'support', 'help', 'company', 'press', 'media', 'investor', 'investors', 'ir', 'careers', 'jobs', 'seller', 'vendor', 'partner'];
  
  // For country-code TLDs, create variations with .com
  // e.g., for jumia.com.ng -> group.jumia.com (not group.jumia.com.ng)
  if (hasCountryCodeTLD(domain)) {
    // Add prefix subdomains with .com
    for (const prefix of prefixes) {
      relatedDomains.push(`${prefix}.${brandName}.com`);
    }
    
    // Add the base .com domain
    relatedDomains.push(`${brandName}.com`);
    relatedDomains.push(`www.${brandName}.com`);
    
    // Add group/corporate variations
    relatedDomains.push(`${brandName}group.com`);
    relatedDomains.push(`${brandName}-group.com`);
    relatedDomains.push(`${brandName}corporate.com`);
  }
  
  // Also add subdomains on the original domain
  const tld = parts.slice(1).join('.');
  for (const prefix of prefixes.slice(0, 8)) {
    relatedDomains.push(`${prefix}.${brandName}.${tld}`);
  }
  
  // Add base variations
  relatedDomains.push(`${brandName}.com`);
  relatedDomains.push(`${brandName}group.com`);
  relatedDomains.push(`${brandName}-group.com`);
  relatedDomains.push(`www.${brandName}.com`);
  
  // Remove duplicates and the original domain
  const unique = Array.from(new Set(relatedDomains)).filter(d => d !== cleanDomain && d !== `www.${cleanDomain}`);
  
  console.log(`[EmailExtractor] Related domains to check: ${unique.slice(0, 10).join(', ')}`);
  
  return unique;
}

async function analyzeWithAI(textContent: string, domain: string): Promise<Set<string>> {
  const emails = new Set<string>();
  const client = getBedrockClient();
  
  if (!client) {
    console.log('[EmailExtractor] AWS Bedrock not configured, skipping AI analysis');
    return emails;
  }
  
  try {
    console.log('[EmailExtractor] Analyzing content with AWS Bedrock AI...');
    
    const truncatedContent = textContent.substring(0, 15000);
    
    const prompt = `You are an expert email extraction specialist analyzing e-commerce and Shopify websites. Your job is to find ALL contact email addresses from website content.

CRITICAL: Look VERY carefully for:
1. Direct email addresses (e.g., support@company.com, info@store.com)
2. Obfuscated emails: "support [at] company [dot] com", "support(at)company(dot)com", "support AT company DOT com"
3. Email patterns in text: "email us at support at company.com", "contact: info at domain.com"
4. JavaScript/JSON embedded emails: "email": "contact@store.com", 'shopEmail': 'info@domain.com'
5. Emails mentioned in policy/legal text, terms of service, privacy policy sections
6. Store owner emails, merchant emails, notification emails mentioned anywhere
7. Emails in footer sections, "Contact Us" references, customer service information
8. Emails in WhatsApp/phone contact sections (often nearby)
9. Look for email domains that match the website domain or brand name

Domain being analyzed: ${domain}
Brand name: ${domain.split('.')[0]}

Website content:
${truncatedContent}

IMPORTANT: Only include emails that are ACTUALLY present in the content above.
- DO NOT fabricate or guess email addresses
- Only extract emails you can directly see in the text
- If text says "email us" without an actual email, do not invent one

Respond ONLY with a JSON object in this exact format:
{"emails": ["email1@domain.com", "email2@domain.com"], "confidence": "high/medium/low"}

If no emails found, respond with: {"emails": [], "confidence": "low"}`;

    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    if (responseBody.content && responseBody.content[0] && responseBody.content[0].text) {
      const text = responseBody.content[0].text;
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          // Extract only confirmed emails found in the actual page content
          // Do NOT use probableEmails as those are AI-fabricated guesses
          if (parsed.emails && Array.isArray(parsed.emails)) {
            parsed.emails.forEach((email: string) => {
              const cleaned = email.toLowerCase().trim();
              if (isValidEmail(cleaned)) {
                emails.add(cleaned);
              }
            });
          }
          // Log probable emails for debugging but do not add to results
          if (parsed.probableEmails && Array.isArray(parsed.probableEmails) && parsed.probableEmails.length > 0) {
            console.log(`[EmailExtractor] AI suggested probable emails (not added to results): ${parsed.probableEmails.join(', ')}`);
          }
        }
      } catch (parseError) {
        const foundEmails = text.match(EMAIL_REGEX) || [];
        foundEmails.forEach((email: string) => {
          const cleaned = email.toLowerCase().trim();
          if (isValidEmail(cleaned)) {
            emails.add(cleaned);
          }
        });
      }
    }
    
    console.log(`[EmailExtractor] AI analysis found ${emails.size} emails`);
  } catch (error: any) {
    console.log(`[EmailExtractor] AI analysis failed: ${error.message}`);
  }
  
  return emails;
}

// Extract emails from Shopify-specific sources (API endpoints, JS variables)
async function extractFromShopifyEndpoints(baseUrl: string): Promise<Set<string>> {
  const emails = new Set<string>();
  console.log('[EmailExtractor] Scanning Shopify-specific endpoints...');
  
  for (const endpoint of SHOPIFY_API_ENDPOINTS) {
    try {
      const url = `${baseUrl}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': DESKTOP_USER_AGENT,
          'Accept': 'application/json, text/javascript, */*',
        },
        signal: AbortSignal.timeout(10000),
      });
      
      if (response.ok) {
        const text = await response.text();
        
        // Extract emails from JSON/JS content
        const foundEmails = text.match(EMAIL_REGEX) || [];
        foundEmails.forEach(email => {
          const cleaned = email.toLowerCase().trim();
          if (isValidEmail(cleaned)) {
            emails.add(cleaned);
            console.log(`[EmailExtractor] Found email in Shopify endpoint ${endpoint}: ${cleaned}`);
          }
        });
        
        // Look for Shopify shop settings
        const shopEmailMatch = text.match(/"email"\s*:\s*"([^"]+@[^"]+)"/i);
        if (shopEmailMatch && isValidEmail(shopEmailMatch[1].toLowerCase())) {
          emails.add(shopEmailMatch[1].toLowerCase());
        }
        
        const customerEmailMatch = text.match(/"customer_email"\s*:\s*"([^"]+@[^"]+)"/i);
        if (customerEmailMatch && isValidEmail(customerEmailMatch[1].toLowerCase())) {
          emails.add(customerEmailMatch[1].toLowerCase());
        }
        
        const shopOwnerMatch = text.match(/"shop_owner"\s*:\s*"([^"]+)"/i);
        const shopDomainMatch = text.match(/"domain"\s*:\s*"([^"]+)"/i);
        if (shopOwnerMatch && shopDomainMatch) {
          // Try to construct potential email from shop owner name
          const ownerName = shopOwnerMatch[1].toLowerCase().replace(/\s+/g, '.');
          const domain = shopDomainMatch[1];
          const potentialEmail = `${ownerName}@${domain}`;
          if (isValidEmail(potentialEmail)) {
            console.log(`[EmailExtractor] Potential owner email: ${potentialEmail}`);
          }
        }
      }
    } catch (err) {
      // Silently continue - endpoint might not exist
    }
  }
  
  console.log(`[EmailExtractor] Shopify endpoints found ${emails.size} emails`);
  return emails;
}

// Extract emails from inline JavaScript/JSON in HTML
function extractFromJavaScriptVariables(html: string): Set<string> {
  const emails = new Set<string>();
  
  // Look for Shopify.shop configuration
  const shopifyShopMatch = html.match(/Shopify\.shop\s*=\s*"([^"]+)"/);
  const shopifyEmailMatch = html.match(/Shopify\..*?email.*?['":][\s]*['"]([^'"]+@[^'"]+)['"]/gi);
  
  if (shopifyEmailMatch) {
    shopifyEmailMatch.forEach(match => {
      const emailMatch = match.match(EMAIL_REGEX);
      if (emailMatch) {
        emailMatch.forEach(email => {
          if (isValidEmail(email.toLowerCase())) {
            emails.add(email.toLowerCase());
          }
        });
      }
    });
  }
  
  // Look for JSON-embedded contact info
  const jsonPatterns = [
    /"contact_email"\s*:\s*"([^"]+@[^"]+)"/gi,
    /"support_email"\s*:\s*"([^"]+@[^"]+)"/gi,
    /"store_email"\s*:\s*"([^"]+@[^"]+)"/gi,
    /"merchant_email"\s*:\s*"([^"]+@[^"]+)"/gi,
    /"owner_email"\s*:\s*"([^"]+@[^"]+)"/gi,
    /"notification_email"\s*:\s*"([^"]+@[^"]+)"/gi,
    /"reply_to"\s*:\s*"([^"]+@[^"]+)"/gi,
    /email['"]?\s*[:=]\s*['"]([^'"]+@[^'"]+)['"]/gi,
  ];
  
  jsonPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const email = match[1].toLowerCase().trim();
      if (isValidEmail(email)) {
        emails.add(email);
      }
    }
  });
  
  // Look for window.__INITIAL_STATE__ or similar React/Vue hydration data
  const initialStateMatch = html.match(/window\.__[A-Z_]+__\s*=\s*(\{[\s\S]*?\});/);
  if (initialStateMatch) {
    const stateEmails = initialStateMatch[1].match(EMAIL_REGEX) || [];
    stateEmails.forEach(email => {
      if (isValidEmail(email.toLowerCase())) {
        emails.add(email.toLowerCase());
      }
    });
  }
  
  return emails;
}

async function fetchSitemap(baseUrl: string): Promise<string[]> {
  const contactUrls: string[] = [];
  
  try {
    const sitemapUrls = [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap_index.xml`,
      `${baseUrl}/sitemap/sitemap.xml`,
    ];
    
    for (const sitemapUrl of sitemapUrls) {
      try {
        const response = await fetch(sitemapUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; EmailBot/1.0)',
          },
          signal: AbortSignal.timeout(10000),
        });
        
        if (response.ok) {
          const xml = await response.text();
          const $ = cheerio.load(xml, { xmlMode: true });
          
          $('loc').each((_, el) => {
            const url = $(el).text();
            const lowerUrl = url.toLowerCase();
            
            const contactKeywords = ['contact', 'about', 'support', 'help', 'team', 'legal', 'privacy', 'terms', 'faq', 'customer', 'service', 'info', 'company'];
            if (contactKeywords.some(keyword => lowerUrl.includes(keyword))) {
              contactUrls.push(url);
            }
          });
          
          if (contactUrls.length > 0) {
            console.log(`[EmailExtractor] Found ${contactUrls.length} contact-related URLs in sitemap`);
            break;
          }
        }
      } catch {}
    }
  } catch (error: any) {
    console.log(`[EmailExtractor] Sitemap fetch failed: ${error.message}`);
  }
  
  return contactUrls.slice(0, 20);
}

function extractEmailsFromHtml(html: string): Set<string> {
  const emails = new Set<string>();
  const $ = cheerio.load(html);
  
  $('script, style, noscript, iframe').remove();
  
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      const email = decodeURIComponent(href.replace('mailto:', '').split('?')[0].split('&')[0]).trim().toLowerCase();
      if (isValidEmail(email)) {
        emails.add(email);
      }
    }
  });
  
  const fullHtml = $.html();
  const htmlEmails = fullHtml.match(EMAIL_REGEX) || [];
  htmlEmails.forEach(email => {
    const cleaned = email.toLowerCase().trim();
    if (isValidEmail(cleaned)) {
      emails.add(cleaned);
    }
  });
  
  const textContent = $('body').text();
  const textEmails = textContent.match(EMAIL_REGEX) || [];
  textEmails.forEach(email => {
    const cleaned = email.toLowerCase().trim();
    if (isValidEmail(cleaned)) {
      emails.add(cleaned);
    }
  });
  
  OBFUSCATED_PATTERNS.forEach(pattern => {
    let match;
    const testText = textContent + ' ' + fullHtml;
    const patternCopy = new RegExp(pattern.source, pattern.flags);
    while ((match = patternCopy.exec(testText)) !== null) {
      const email = `${match[1]}@${match[2]}.${match[3]}`.toLowerCase().trim();
      if (isValidEmail(email)) {
        emails.add(email);
      }
    }
  });
  
  $('*').each((_, el) => {
    const element = $(el);
    ['data-email', 'data-mail', 'data-contact', 'data-href', 'data-cfemail', 'data-encoded-email'].forEach(attr => {
      const value = element.attr(attr);
      if (value) {
        const decoded = decodeCloudflareEmail(value);
        if (decoded && isValidEmail(decoded.toLowerCase())) {
          emails.add(decoded.toLowerCase());
        }
        const found = value.match(EMAIL_REGEX);
        if (found) {
          found.forEach(email => {
            if (isValidEmail(email.toLowerCase())) {
              emails.add(email.toLowerCase());
            }
          });
        }
      }
    });
  });
  
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const jsonText = $(el).html();
      if (jsonText) {
        const found = jsonText.match(EMAIL_REGEX);
        if (found) {
          found.forEach(email => {
            if (isValidEmail(email.toLowerCase())) {
              emails.add(email.toLowerCase());
            }
          });
        }
      }
    } catch {}
  });
  
  $('meta').each((_, el) => {
    const content = $(el).attr('content') || '';
    const found = content.match(EMAIL_REGEX);
    if (found) {
      found.forEach(email => {
        if (isValidEmail(email.toLowerCase())) {
          emails.add(email.toLowerCase());
        }
      });
    }
  });
  
  $('footer, [class*="footer"], [id*="footer"], [class*="contact"], [id*="contact"], [class*="email"], [id*="email"], [class*="header"], [class*="nav"], [class*="support"], [id*="support"], [class*="help"], [id*="help"]').each((_, el) => {
    const text = $(el).text();
    const found = text.match(EMAIL_REGEX);
    if (found) {
      found.forEach(email => {
        if (isValidEmail(email.toLowerCase())) {
          emails.add(email.toLowerCase());
        }
      });
    }
  });
  
  $('[onclick], [data-action]').each((_, el) => {
    const onclick = $(el).attr('onclick') || '';
    const dataAction = $(el).attr('data-action') || '';
    const combined = onclick + ' ' + dataAction;
    const found = combined.match(EMAIL_REGEX);
    if (found) {
      found.forEach(email => {
        if (isValidEmail(email.toLowerCase())) {
          emails.add(email.toLowerCase());
        }
      });
    }
  });
  
  $('*').each((_, el) => {
    const element = $(el);
    const allAttrs = element.attr();
    if (allAttrs) {
      Object.values(allAttrs).forEach((value: any) => {
        if (typeof value === 'string') {
          const found = value.match(EMAIL_REGEX);
          if (found) {
            found.forEach(email => {
              if (isValidEmail(email.toLowerCase())) {
                emails.add(email.toLowerCase());
              }
            });
          }
        }
      });
    }
  });
  
  // Extract from HTML comments
  const commentRegex = /<!--[\s\S]*?-->/g;
  const comments = html.match(commentRegex) || [];
  comments.forEach(comment => {
    const found = comment.match(EMAIL_REGEX);
    if (found) {
      found.forEach(email => {
        if (isValidEmail(email.toLowerCase())) {
          emails.add(email.toLowerCase());
        }
      });
    }
  });
  
  // Extract from inline scripts (not removed)
  const fullHtmlWithScripts = cheerio.load(html).html();
  const scriptContentRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  while ((scriptMatch = scriptContentRegex.exec(fullHtmlWithScripts)) !== null) {
    const scriptContent = scriptMatch[1];
    const found = scriptContent.match(EMAIL_REGEX);
    if (found) {
      found.forEach(email => {
        if (isValidEmail(email.toLowerCase())) {
          emails.add(email.toLowerCase());
        }
      });
    }
  }
  
  // Shopify-specific extraction
  $('[data-shop-id], [data-shop-name], [data-shop-email]').each((_, el) => {
    const shopEmail = $(el).attr('data-shop-email') || '';
    if (shopEmail && isValidEmail(shopEmail.toLowerCase())) {
      emails.add(shopEmail.toLowerCase());
    }
  });
  
  // Shopify checkout form fields
  $('input[name*="email"], input[type="email"], input[id*="email"], input[placeholder*="email"], input[autocomplete*="email"]').each((_, el) => {
    const placeholder = $(el).attr('placeholder') || '';
    const value = $(el).attr('value') || '';
    [placeholder, value].forEach(v => {
      const found = v.match(EMAIL_REGEX);
      if (found) {
        found.forEach(email => {
          if (isValidEmail(email.toLowerCase())) {
            emails.add(email.toLowerCase());
          }
        });
      }
    });
  });
  
  // E-commerce store info sections
  $('[class*="store-info"], [class*="shop-info"], [class*="merchant"], [class*="seller"], [class*="vendor"], [id*="store-info"], [id*="shop-info"]').each((_, el) => {
    const text = $(el).text();
    const found = text.match(EMAIL_REGEX);
    if (found) {
      found.forEach(email => {
        if (isValidEmail(email.toLowerCase())) {
          emails.add(email.toLowerCase());
        }
      });
    }
  });
  
  // WordPress author meta
  $('.author-info, .author-box, [class*="author"], .entry-author, .post-author, .vcard').each((_, el) => {
    const text = $(el).text();
    const found = text.match(EMAIL_REGEX);
    if (found) {
      found.forEach(email => {
        if (isValidEmail(email.toLowerCase())) {
          emails.add(email.toLowerCase());
        }
      });
    }
  });
  
  // WooCommerce store details
  $('.woocommerce-store-info, .woocommerce-info, [class*="woo"], .store-email, .shop-email').each((_, el) => {
    const text = $(el).text();
    const found = text.match(EMAIL_REGEX);
    if (found) {
      found.forEach(email => {
        if (isValidEmail(email.toLowerCase())) {
          emails.add(email.toLowerCase());
        }
      });
    }
  });
  
  // CRM and helpdesk widgets
  $('[class*="zendesk"], [class*="freshdesk"], [class*="intercom"], [class*="hubspot"], [class*="drift"], [class*="crisp"], [class*="tawk"], [class*="livechat"]').each((_, el) => {
    const text = $(el).text();
    const found = text.match(EMAIL_REGEX);
    if (found) {
      found.forEach(email => {
        if (isValidEmail(email.toLowerCase())) {
          emails.add(email.toLowerCase());
        }
      });
    }
  });
  
  // Hidden elements that might contain emails
  $('input[type="hidden"], [style*="display:none"], [style*="display: none"], [hidden], .hidden, .visually-hidden, .sr-only').each((_, el) => {
    const element = $(el);
    const value = element.attr('value') || '';
    const text = element.text();
    [value, text].forEach(v => {
      const found = v.match(EMAIL_REGEX);
      if (found) {
        found.forEach(email => {
          if (isValidEmail(email.toLowerCase())) {
            emails.add(email.toLowerCase());
          }
        });
      }
    });
  });
  
  // Data attributes that might contain email info
  $('*').each((_, el) => {
    const element = $(el);
    const attrs = element.attr();
    if (attrs) {
      ['data-customer-email', 'data-user-email', 'data-merchant-email', 'data-seller-email', 
       'data-vendor-email', 'data-store-email', 'data-shop-email', 'data-support-email',
       'data-contact-email', 'data-billing-email', 'data-receipt-email', 'data-order-email',
       'data-notify-email', 'data-admin-email', 'data-owner-email'].forEach(attr => {
        const value = element.attr(attr);
        if (value && isValidEmail(value.toLowerCase())) {
          emails.add(value.toLowerCase());
        }
      });
    }
  });
  
  // VCard/hCard microformat extraction
  $('.vcard .email, .h-card .p-email, [itemprop="email"]').each((_, el) => {
    const email = $(el).text() || $(el).attr('href')?.replace('mailto:', '') || '';
    if (email && isValidEmail(email.toLowerCase())) {
      emails.add(email.toLowerCase());
    }
  });
  
  // Schema.org extraction from any element
  $('[itemtype*="Organization"], [itemtype*="LocalBusiness"], [itemtype*="Person"], [itemtype*="ContactPoint"]').each((_, el) => {
    const text = $(el).text();
    const found = text.match(EMAIL_REGEX);
    if (found) {
      found.forEach(email => {
        if (isValidEmail(email.toLowerCase())) {
          emails.add(email.toLowerCase());
        }
      });
    }
  });
  
  return emails;
}

// Platform detection function
function detectPlatform(html: string): string[] {
  const detectedPlatforms: string[] = [];
  const lowerHtml = html.toLowerCase();
  
  for (const [platform, signatures] of Object.entries(PLATFORM_SIGNATURES)) {
    for (const sig of signatures) {
      if (lowerHtml.includes(sig.toLowerCase())) {
        if (!detectedPlatforms.includes(platform)) {
          detectedPlatforms.push(platform);
        }
        break;
      }
    }
  }
  
  return detectedPlatforms;
}

// Get platform-specific paths based on detected platform
function getPlatformSpecificPaths(platforms: string[]): string[] {
  const paths: string[] = [];
  
  if (platforms.includes('shopify')) {
    paths.push(
      '/checkout', '/cart', '/checkouts', '/account', '/account/login',
      '/account/register', '/account/addresses', '/account/orders',
      '/orders/customer_lookup', '/tools/recurring', '/a/account', '/a/orders',
      '/policies/terms-of-service', '/policies/privacy-policy', '/policies/refund-policy',
      '/policies/shipping-policy', '/policies/contact-information',
      '/pages/contact-us', '/pages/about-us', '/pages/faq', '/pages/shipping',
      '/pages/returns', '/apps/helpdesk', '/apps/help-center',
      '/collections/all', '/products.json', '/admin/shop.json'
    );
  }
  
  if (platforms.includes('wordpress') || platforms.includes('woocommerce')) {
    paths.push(
      '/wp-admin', '/wp-login.php', '/author', '/feed',
      '/my-account', '/my-account/edit-account', '/my-account/orders',
      '/shop', '/product-category', '/checkout', '/cart',
      '/contact', '/about', '/about-us', '/contact-us'
    );
  }
  
  if (platforms.includes('magento')) {
    paths.push(
      '/customer/account', '/customer/account/login', '/customer/account/create',
      '/checkout/cart', '/checkout/onepage', '/sales/order/history',
      '/contacts', '/catalogsearch', '/cms/page'
    );
  }
  
  if (platforms.includes('hubspot') || platforms.includes('zendesk') || platforms.includes('freshdesk') || platforms.includes('salesforce')) {
    paths.push(
      '/contact', '/support', '/help', '/helpdesk', '/ticket', '/tickets',
      '/submit-request', '/knowledge-base', '/kb', '/hc/en-us/requests/new'
    );
  }
  
  return [...new Set(paths)];
}

function decodeCloudflareEmail(encodedString: string): string | null {
  try {
    if (!/^[0-9a-fA-F]+$/.test(encodedString)) return null;
    
    const r = parseInt(encodedString.substr(0, 2), 16);
    let email = '';
    for (let i = 2; i < encodedString.length; i += 2) {
      const c = parseInt(encodedString.substr(i, 2), 16) ^ r;
      email += String.fromCharCode(c);
    }
    return email;
  } catch {
    return null;
  }
}

function isValidEmail(email: string): boolean {
  if (!email || email.length < 5 || email.length > 254) return false;
  
  const lower = email.toLowerCase();
  
  const invalidExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.css', '.js', '.woff', '.woff2', '.ttf', '.eot', '.map', '.ts', '.tsx', '.jsx'];
  if (invalidExtensions.some(ext => lower.endsWith(ext))) return false;
  
  const invalidPatterns = ['example.com', 'example.org', 'test.com', 'domain.com', 'yoursite.com', 'yourdomain.com', 'company.com', 'website.com', 'sentry.io', 'wixpress.com', 'w3.org', 'schema.org', 'placeholder', 'no-reply', 'noreply@', 'donotreply', 'localhost', '127.0.0.1', 'email@email', 'user@example', 'name@domain', 'sample@', 'test@test', 'abc@abc', 'yourcompany', 'youremail', 'email.com'];
  if (invalidPatterns.some(pattern => lower.includes(pattern))) return false;
  
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  
  const [localPart, domain] = parts;
  if (!localPart || !domain) return false;
  if (localPart.length > 64) return false;
  if (localPart.length < 1) return false;
  
  if (!domain.includes('.')) return false;
  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2 || tld.length > 10) return false;
  
  if (!/^[a-z]+$/i.test(tld)) return false;
  
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  
  const commonEmailDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'mail.com', 'protonmail.com', 'live.com', 'msn.com', 'ymail.com'];
  for (const commonDomain of commonEmailDomains) {
    if (domain.includes(commonDomain) && domain !== commonDomain) {
      return false;
    }
  }
  
  return true;
}

function extractFooterLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const footerLinks = new Set<string>();
  const baseUrlObj = new URL(baseUrl);
  
  const footerSelectors = [
    'footer',
    '[class*="footer"]',
    '[id*="footer"]',
    '[class*="bottom"]',
    '[id*="bottom"]',
    '[class*="legal"]',
    '[id*="legal"]',
    '[class*="site-info"]',
    '[role="contentinfo"]',
  ];
  
  footerSelectors.forEach(selector => {
    $(selector).find('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      
      try {
        let fullUrl: string;
        if (href.startsWith('http')) {
          fullUrl = href;
        } else if (href.startsWith('/')) {
          fullUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${href}`;
        } else if (!href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('javascript:')) {
          fullUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}/${href}`;
        } else {
          return;
        }
        
        const linkUrl = new URL(fullUrl);
        if (linkUrl.host === baseUrlObj.host) {
          footerLinks.add(linkUrl.href.split('#')[0].split('?')[0]);
        }
      } catch {}
    });
  });
  
  return Array.from(footerLinks);
}

function extractLinksFromHtml(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();
  const baseUrlObj = new URL(baseUrl);
  
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    
    try {
      let fullUrl: string;
      if (href.startsWith('http')) {
        fullUrl = href;
      } else if (href.startsWith('/')) {
        fullUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${href}`;
      } else if (!href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('javascript:')) {
        fullUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}/${href}`;
      } else {
        return;
      }
      
      const linkUrl = new URL(fullUrl);
      if (linkUrl.host === baseUrlObj.host) {
        links.add(linkUrl.href.split('#')[0].split('?')[0]);
      }
    } catch {}
  });
  
  const footerLinks = extractFooterLinks(html, baseUrl);
  footerLinks.forEach(link => links.add(link));
  
  return Array.from(links);
}

function findContactLinks(links: string[], baseUrl: string): string[] {
  const contactLinks: string[] = [];
  const otherLinks: string[] = [];
  const baseUrlObj = new URL(baseUrl);
  const addedPaths = new Set<string>();
  
  const highPriorityKeywords = ['contact', 'about', 'support', 'help', 'customer-service', 'customer-care', 'get-in-touch', 'reach-us', 'sp-contact', 'sp-about', 'email', 'write-to-us', 'policies', 'policy'];
  const mediumPriorityKeywords = ['team', 'company', 'legal', 'privacy', 'terms', 'tos', 'faq', 'info', 'careers', 'footer', 'service', 'imprint', 'impressum', 'disclaimer', 'conditions', 'refund', 'shipping'];
  const lowPriorityKeywords = ['press', 'media', 'partners', 'investors', 'newsroom', 'blog', 'news', 'join'];
  
  const productKeywords = ['product/', 'item/', 'shop/', 'buy/', 'cart', 'checkout', 'category/', 'categories/', 'search?', 'filter?', 'price=', '/sale/', '/deal/', '/offer/', '/store/', '/collections/', 'sku=', 'ref=', 'add-to-', 'wishlist', '/p/', '/pd/'];
  
  for (const link of links) {
    const lowerLink = link.toLowerCase();
    try {
      const path = new URL(link).pathname;
      
      if (productKeywords.some(keyword => lowerLink.includes(keyword))) {
        continue;
      }
      
      if (highPriorityKeywords.some(keyword => lowerLink.includes(keyword))) {
        if (!addedPaths.has(path)) {
          contactLinks.unshift(link);
          addedPaths.add(path);
        }
      } else if (mediumPriorityKeywords.some(keyword => lowerLink.includes(keyword))) {
        if (!addedPaths.has(path)) {
          contactLinks.push(link);
          addedPaths.add(path);
        }
      } else if (lowPriorityKeywords.some(keyword => lowerLink.includes(keyword))) {
        if (!addedPaths.has(path)) {
          otherLinks.push(link);
          addedPaths.add(path);
        }
      }
    } catch {}
  }
  
  for (const path of PRIORITY_CONTACT_PATHS) {
    const url = `${baseUrlObj.protocol}//${baseUrlObj.host}${path}`;
    if (!addedPaths.has(path)) {
      contactLinks.push(url);
      addedPaths.add(path);
    }
  }
  
  return [...contactLinks, ...otherLinks].slice(0, 35);
}

function generateCommonEmails(domain: string): string[] {
  const cleanDomain = domain.replace('www.', '');
  const emails: string[] = [];
  
  for (const prefix of COMMON_EMAIL_PREFIXES) {
    emails.push(`${prefix}@${cleanDomain}`);
  }
  
  return emails;
}

async function verifyEmailExists(email: string): Promise<boolean> {
  return true;
}

async function scanRelatedDomain(relatedDomain: string, allEmails: Set<string>): Promise<{ found: boolean; pagesScanned: number }> {
  let pagesScanned = 0;
  
  try {
    const relatedUrl = `https://${relatedDomain}/`;
    console.log(`[EmailExtractor] Checking related domain: ${relatedDomain}`);
    
    let html = await fetchPageSimple(relatedUrl);
    if (!html) {
      html = await fetchPageWithBrowser(relatedUrl, 3000);
    }
    
    if (html) {
      const emails = extractEmailsFromHtml(html);
      emails.forEach((e: string) => allEmails.add(e));
      pagesScanned++;
      
      if (emails.size > 0) {
        console.log(`[EmailExtractor] Found ${emails.size} emails on ${relatedDomain}`);
        return { found: true, pagesScanned };
      }
      
      // Try contact pages on related domain
      const contactPaths = ['/contact', '/about', '/contact-us', '/about-us', '/company', '/team'];
      for (const path of contactPaths) {
        try {
          let contactHtml = await fetchPageSimple(`https://${relatedDomain}${path}`);
          if (!contactHtml) {
            contactHtml = await fetchPageWithBrowser(`https://${relatedDomain}${path}`, 2000);
          }
          
          if (contactHtml) {
            const contactEmails = extractEmailsFromHtml(contactHtml);
            contactEmails.forEach((e: string) => allEmails.add(e));
            pagesScanned++;
            
            if (contactEmails.size > 0) {
              console.log(`[EmailExtractor] Found ${contactEmails.size} emails on ${relatedDomain}${path}`);
              return { found: true, pagesScanned };
            }
          }
        } catch {}
      }
    }
  } catch (err: any) {
    console.log(`[EmailExtractor] Related domain ${relatedDomain} failed: ${err.message}`);
  }
  
  return { found: false, pagesScanned };
}

export async function extractEmailsFromUrl(url: string): Promise<ExtractionResult> {
  try {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    const baseUrlObj = new URL(fullUrl);
    const baseUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}`;
    const rootUrl = `${baseUrl}/`;
    const domain = baseUrlObj.host.replace('www.', '');
    const brandName = getBrandName(domain);
    const providedPath = baseUrlObj.pathname;
    const userProvidedUrl = fullUrl.split('?')[0].split('#')[0];
    const isUserUrlDifferentFromRoot = userProvidedUrl !== rootUrl && userProvidedUrl !== baseUrl && providedPath !== '/';
    
    const allEmails = new Set<string>();
    const methodsUsed: string[] = [];
    let pagesScanned = 0;
    let usedBrowser = false;
    let usedMobileFallback = false;
    let combinedTextForAI = '';
    
    console.log(`[EmailExtractor] Starting enhanced extraction for: ${fullUrl}`);
    console.log(`[EmailExtractor] Base URL: ${baseUrl}, Domain: ${domain}, Brand: ${brandName}`);
    console.log(`[EmailExtractor] User provided path: ${providedPath}, different from root: ${isUserUrlDifferentFromRoot}`);
    
    // Step 1: ALWAYS scan the user's exact URL first (if different from root)
    if (isUserUrlDifferentFromRoot) {
      console.log(`[EmailExtractor] Step 1a: Scanning user's exact URL first: ${userProvidedUrl}`);
      let userUrlHtml = await fetchPageSimple(userProvidedUrl);
      
      if (userUrlHtml) {
        const initialEmails = extractEmailsFromHtml(userUrlHtml);
        
        const isJsRendered = userUrlHtml.includes('id="root"') || 
                             userUrlHtml.includes('id="app"') || 
                             userUrlHtml.includes('id="__next"') ||
                             userUrlHtml.includes('id="__nuxt"') ||
                             userUrlHtml.includes('ng-version') ||
                             (userUrlHtml.length < 5000 && initialEmails.size === 0);
        
        if (isJsRendered || initialEmails.size === 0) {
          console.log(`[EmailExtractor] User URL appears JS-rendered, using browser with mobile fallback...`);
          const browserResult = await fetchWithMobileFallback(userProvidedUrl, 4000);
          if (browserResult.html) {
            userUrlHtml = browserResult.html;
            browserResult.emails.forEach(e => allEmails.add(e));
            usedBrowser = true;
            usedMobileFallback = browserResult.usedMobile;
            combinedTextForAI += cheerio.load(browserResult.html)('body').text() + '\n\n';
            if (browserResult.mobileHtml && browserResult.usedMobile) {
              combinedTextForAI += cheerio.load(browserResult.mobileHtml)('body').text() + '\n\n';
            }
          }
        } else {
          initialEmails.forEach(e => allEmails.add(e));
          combinedTextForAI += cheerio.load(userUrlHtml)('body').text() + '\n\n';
        }
        pagesScanned++;
        console.log(`[EmailExtractor] User's URL: found ${allEmails.size} emails so far`);
      } else {
        console.log(`[EmailExtractor] Simple fetch failed for user URL, trying browser...`);
        const browserResult = await fetchWithMobileFallback(userProvidedUrl, 4000);
        if (browserResult.html) {
          userUrlHtml = browserResult.html;
          browserResult.emails.forEach(e => allEmails.add(e));
          usedBrowser = true;
          usedMobileFallback = browserResult.usedMobile;
          pagesScanned++;
          combinedTextForAI += cheerio.load(browserResult.html)('body').text() + '\n\n';
          if (browserResult.mobileHtml && browserResult.usedMobile) {
            combinedTextForAI += cheerio.load(browserResult.mobileHtml)('body').text() + '\n\n';
          }
        }
      }
    }
    
    // Step 1b: Scan root page
    console.log(`[EmailExtractor] Step 1b: Scanning root page (/)...`);
    let rootHtml = await fetchPageSimple(rootUrl);
    let rootMobileHtml: string | null = null;
    
    if (rootHtml) {
      const initialEmails = extractEmailsFromHtml(rootHtml);
      
      const isJsRendered = rootHtml.includes('id="root"') || 
                           rootHtml.includes('id="app"') || 
                           rootHtml.includes('id="__next"') ||
                           rootHtml.includes('id="__nuxt"') ||
                           rootHtml.includes('ng-version') ||
                           (rootHtml.length < 5000 && initialEmails.size === 0);
      
      if (isJsRendered || initialEmails.size === 0) {
        console.log(`[EmailExtractor] Detected JavaScript-rendered page or no initial emails, using browser with mobile fallback...`);
        const browserResult = await fetchWithMobileFallback(rootUrl, 4000);
        if (browserResult.html) {
          rootHtml = browserResult.html;
          rootMobileHtml = browserResult.mobileHtml;
          browserResult.emails.forEach(e => allEmails.add(e));
          usedBrowser = true;
          usedMobileFallback = browserResult.usedMobile;
        }
      } else {
        initialEmails.forEach(e => allEmails.add(e));
      }
    } else {
      console.log(`[EmailExtractor] Simple fetch failed, trying browser with mobile fallback...`);
      const browserResult = await fetchWithMobileFallback(rootUrl, 4000);
      rootHtml = browserResult.html;
      rootMobileHtml = browserResult.mobileHtml;
      browserResult.emails.forEach(e => allEmails.add(e));
      usedBrowser = true;
      usedMobileFallback = browserResult.usedMobile;
    }
    
    if (!rootHtml) {
      console.log(`[EmailExtractor] All fetch methods failed for root`);
      return {
        emails: [],
        pagesScanned: 0,
        error: 'Failed to fetch the page. The website may be blocking automated requests or is unavailable.',
        methods: [],
      };
    }
    
    pagesScanned++;
    console.log(`[EmailExtractor] Root page: found ${allEmails.size} emails so far`);
    methodsUsed.push('html_scraping');
    if (usedMobileFallback) {
      methodsUsed.push('mobile_fallback');
    }
    
    // Build combined text for AI analysis (include both desktop and mobile if available)
    combinedTextForAI += cheerio.load(rootHtml)('body').text() + '\n\n';
    if (rootMobileHtml && usedMobileFallback) {
      combinedTextForAI += cheerio.load(rootMobileHtml)('body').text() + '\n\n';
    }
    
    // Run AI analysis on combined text (desktop + mobile content)
    const aiEmails = await analyzeWithAI(combinedTextForAI, domain);
    aiEmails.forEach(email => allEmails.add(email));
    if (aiEmails.size > 0) {
      methodsUsed.push('ai_analysis');
    }
    
    const isEcommerceSite = isShopifyOrEcommerce(rootHtml);
    if (isEcommerceSite) {
      console.log(`[EmailExtractor] Detected e-commerce/Shopify site - will use aggressive scanning`);
      methodsUsed.push('ecommerce_detection');
      
      // Extract from Shopify API endpoints
      const shopifyEmails = await extractFromShopifyEndpoints(baseUrl);
      shopifyEmails.forEach(e => allEmails.add(e));
      if (shopifyEmails.size > 0) {
        methodsUsed.push('shopify_api');
      }
      
      // Extract from JavaScript variables in the HTML
      const jsEmails = extractFromJavaScriptVariables(rootHtml);
      jsEmails.forEach(e => allEmails.add(e));
      if (jsEmails.size > 0) {
        methodsUsed.push('js_variables');
      }
    }
    
    // Platform detection for targeted scanning
    const detectedPlatforms = detectPlatform(rootHtml);
    if (detectedPlatforms.length > 0) {
      console.log(`[EmailExtractor] Detected platforms: ${detectedPlatforms.join(', ')}`);
      methodsUsed.push(`platforms:${detectedPlatforms.join(',')}`);
    }
    
    // Get platform-specific paths to scan
    const platformPaths = getPlatformSpecificPaths(detectedPlatforms);
    console.log(`[EmailExtractor] Adding ${platformPaths.length} platform-specific paths to scan`);
    
    console.log(`[EmailExtractor] Step 2: Scanning critical policy pages first (Terms of Service, Privacy Policy, etc.)...`);
    const criticalPolicyUrls: string[] = [];
    const addedPolicyPaths = new Set<string>();
    
    // Add Shopify-specific policy pages first for e-commerce sites
    if (isEcommerceSite) {
      for (const path of SHOPIFY_POLICY_PAGES) {
        if (!addedPolicyPaths.has(path)) {
          criticalPolicyUrls.push(`${baseUrl}${path}`);
          addedPolicyPaths.add(path);
        }
      }
    }
    
    // Add platform-specific paths first (higher priority for detected platforms)
    for (const path of platformPaths) {
      if (!addedPolicyPaths.has(path)) {
        criticalPolicyUrls.push(`${baseUrl}${path}`);
        addedPolicyPaths.add(path);
      }
    }
    
    // Add general critical policy paths
    for (const path of CRITICAL_POLICY_PATHS) {
      if (!addedPolicyPaths.has(path)) {
        criticalPolicyUrls.push(`${baseUrl}${path}`);
        addedPolicyPaths.add(path);
      }
    }
    
    const policyScannedUrls = new Set<string>();
    for (const policyUrl of criticalPolicyUrls.slice(0, 20)) {
      if (policyScannedUrls.has(policyUrl)) continue;
      policyScannedUrls.add(policyUrl);
      
      try {
        console.log(`[EmailExtractor] Scanning critical policy page: ${policyUrl}`);
        const html = await fetchPageWithBrowser(policyUrl, 4000, 'desktop', true);
        
        if (html) {
          const emails = extractEmailsFromHtml(html);
          if (emails.size > 0) {
            console.log(`[EmailExtractor] Found ${emails.size} emails in policy page: ${policyUrl}`);
            emails.forEach(e => allEmails.add(e));
          } else {
            const pageText = cheerio.load(html)('body').text();
            combinedTextForAI += '\n\n--- Policy Page: ' + policyUrl + ' ---\n' + pageText;
            const aiEmails = await analyzeWithAI(pageText, domain);
            aiEmails.forEach(e => allEmails.add(e));
            if (aiEmails.size > 0) {
              console.log(`[EmailExtractor] AI found ${aiEmails.size} emails in policy page: ${policyUrl}`);
            }
          }
          pagesScanned++;
        }
      } catch (err: any) {
        console.log(`[EmailExtractor] Failed to scan policy page ${policyUrl}: ${err.message}`);
      }
    }
    
    console.log(`[EmailExtractor] After policy pages: found ${allEmails.size} emails so far`);
    
    console.log(`[EmailExtractor] Step 3: Scanning other priority contact paths...`);
    const allPriorityUrls: string[] = [];
    for (const path of PRIORITY_CONTACT_PATHS) {
      allPriorityUrls.push(`${baseUrl}${path}`);
    }
    
    const pageLinks = extractLinksFromHtml(rootHtml, baseUrl);
    const sitemapUrls = await fetchSitemap(baseUrl);
    const contactLinks = findContactLinks([...pageLinks, ...sitemapUrls], baseUrl);
    
    const uniqueContactUrls = new Set<string>();
    for (const url of allPriorityUrls) {
      if (!policyScannedUrls.has(url)) {
        uniqueContactUrls.add(url);
      }
    }
    for (const url of contactLinks) {
      if (!policyScannedUrls.has(url)) {
        uniqueContactUrls.add(url);
      }
    }
    uniqueContactUrls.delete(rootUrl);
    uniqueContactUrls.delete(baseUrl);
    if (isUserUrlDifferentFromRoot) {
      uniqueContactUrls.delete(userProvidedUrl);
    }
    
    console.log(`[EmailExtractor] Found ${uniqueContactUrls.size} additional contact/priority pages to scan`);
    
    const urlsToScan = Array.from(uniqueContactUrls).slice(0, 25);
    
    const scanPromises = urlsToScan.map(async (link) => {
      try {
        let html: string | null;
        let mobileHtml: string | null = null;
        let emails = new Set<string>();
        
        const shouldUseBrowser = usedBrowser || isEcommerceSite || isPolicyPage(link);
        
        if (shouldUseBrowser) {
          const result = await fetchWithMobileFallback(link, 3000);
          html = result.html;
          mobileHtml = result.mobileHtml;
          result.emails.forEach(e => emails.add(e));
        } else {
          html = await fetchPageSimple(link);
          if (html) {
            emails = extractEmailsFromHtml(html);
          }
          if (!html || emails.size === 0) {
            const browserResult = await fetchWithMobileFallback(link, 3000);
            html = browserResult.html;
            mobileHtml = browserResult.mobileHtml;
            browserResult.emails.forEach(e => emails.add(e));
          }
        }
        
        if (html && emails.size === 0) {
          let pageText = cheerio.load(html)('body').text();
          if (mobileHtml) {
            pageText += '\n\n' + cheerio.load(mobileHtml)('body').text();
          }
          const aiPageEmails = await analyzeWithAI(pageText, domain);
          aiPageEmails.forEach(e => emails.add(e));
        }
        
        if (emails.size > 0) {
          console.log(`[EmailExtractor] ${link}: found ${emails.size} emails`);
        }
        return { link, emails: Array.from(emails), success: html !== null };
      } catch (err: any) {
        console.log(`[EmailExtractor] Failed to fetch ${link}: ${err.message}`);
        return { link, emails: [], success: false };
      }
    });
    
    const results = await Promise.all(scanPromises);
    results.forEach(result => {
      if (result.success) pagesScanned++;
      result.emails.forEach(email => allEmails.add(email));
    });
    
    // If no emails found, try related domains (improved logic for country-code TLDs)
    if (allEmails.size === 0) {
      console.log(`[EmailExtractor] No emails found, trying related domains...`);
      const relatedDomains = getRelatedDomains(domain);
      
      // Try up to 10 related domains
      for (const relatedDomain of relatedDomains.slice(0, 10)) {
        const result = await scanRelatedDomain(relatedDomain, allEmails);
        pagesScanned += result.pagesScanned;
        
        if (result.found) {
          methodsUsed.push('related_domains');
          break;
        }
      }
    }
    
    // If still no emails, try comprehensive web search
    if (allEmails.size === 0) {
      console.log(`[EmailExtractor] Trying comprehensive web search...`);
      const searchEmails = await searchForEmails(domain);
      searchEmails.forEach((email: string) => allEmails.add(email));
      if (searchEmails.size > 0) {
        methodsUsed.push('web_search');
      }
    }
    
    // Last resort: generate common patterns
    if (allEmails.size === 0) {
      console.log(`[EmailExtractor] Still no emails, generating common patterns...`);
      const commonEmails = generateCommonEmails(domain);
      console.log(`[EmailExtractor] Generated ${commonEmails.length} common email patterns (unverified)`);
      methodsUsed.push('pattern_generation');
    }
    
    const emailArray = Array.from(allEmails);
    console.log(`[EmailExtractor] Total: ${emailArray.length} unique emails from ${pagesScanned} pages`);
    console.log(`[EmailExtractor] Methods used: ${methodsUsed.join(', ')}`);
    
    return {
      emails: emailArray,
      pagesScanned,
      methods: methodsUsed,
    };
  } catch (error: any) {
    console.error('[EmailExtractor] Error:', error.message);
    return {
      emails: [],
      error: error.message || 'Failed to extract emails',
      pagesScanned: 0,
      methods: [],
    };
  }
}

process.on('exit', async () => {
  if (browserInstance) {
    await browserInstance.close();
  }
});
