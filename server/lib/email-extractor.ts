import * as cheerio from "cheerio";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import dns from "dns";
import { promisify } from "util";
import { batchVerifyEmails, EmailVerificationResult } from "./email-verifier";

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
  // Original patterns
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
  // New patterns: "email AT domain DOT com" (uppercase words)
  // Sample: "info AT company DOT com" -> info@company.com
  /([a-zA-Z0-9._%+-]+)\s+AT\s+([a-zA-Z0-9.-]+)\s+DOT\s+([a-zA-Z]{2,})/g,
  // New patterns: "email/at/domain/dot/com" (slash separated)
  // Sample: "info/at/company/dot/com" -> info@company.com
  /([a-zA-Z0-9._%+-]+)\/at\/([a-zA-Z0-9.-]+)\/dot\/([a-zA-Z]{2,})/gi,
  // New patterns: Space separated AT and DOT (mixed case)
  // Sample: "info At company Dot com" -> info@company.com
  /([a-zA-Z0-9._%+-]+)\s+[Aa][Tt]\s+([a-zA-Z0-9.-]+)\s+[Dd][Oo][Tt]\s+([a-zA-Z]{2,})/g,
  // New patterns: Parenthesized @ symbol
  // Sample: "info(@)company(.)com" -> info@company.com
  /([a-zA-Z0-9._%+-]+)\s*\(@\)\s*([a-zA-Z0-9.-]+)\s*\(\.\)\s*([a-zA-Z]{2,})/g,
  // New patterns: Bracket @ symbol
  // Sample: "info[@]company[.]com" -> info@company.com
  /([a-zA-Z0-9._%+-]+)\s*\[@\]\s*([a-zA-Z0-9.-]+)\s*\[\.\]\s*([a-zA-Z]{2,})/g,
  // New patterns: Unicode obfuscation with full-width characters
  // Sample: "info＠company．com" (using full-width @ and .)
  /([a-zA-Z0-9._%+-]+)\s*[＠@]\s*([a-zA-Z0-9.-]+)\s*[．.]\s*([a-zA-Z]{2,})/g,
  // New patterns: Multiple dots in obfuscation
  // Sample: "info [at] company [dot] co [dot] ng" -> info@company.co.ng
  /([a-zA-Z0-9._%+-]+)\s*\[at\]\s*([a-zA-Z0-9.-]+)\s*\[dot\]\s*([a-zA-Z0-9]+)\s*\[dot\]\s*([a-zA-Z]{2,})/gi,
];

// Nigerian/African email domain patterns
// Sample domains: .ng (Nigeria), .com.ng, .co.ng, .gh (Ghana), .ke (Kenya), .za (South Africa)
const AFRICAN_EMAIL_DOMAINS = [
  '.ng', '.com.ng', '.co.ng', '.org.ng', '.gov.ng', '.edu.ng', '.net.ng',
  '.gh', '.com.gh', '.co.gh', '.org.gh',
  '.ke', '.co.ke', '.or.ke',
  '.za', '.co.za', '.org.za', '.net.za',
  '.eg', '.com.eg',
  '.et', '.com.et',
  '.tz', '.co.tz',
  '.ug', '.co.ug',
  '.rw', '.co.rw',
  '.sn', '.com.sn',
  '.ci', '.co.ci',
  '.cm', '.com.cm',
  '.ao', '.co.ao',
  '.mz', '.co.mz',
];

// Common Nigerian/African email providers and patterns
const AFRICAN_EMAIL_PROVIDERS = [
  'yahoo.com', 'gmail.com', 'hotmail.com', 'outlook.com',
  'ymail.com', 'rocketmail.com', 'yahoo.co.uk',
];

// Function to decode HTML entities in text
// Sample: "info&#64;company&#46;com" -> "info@company.com"
function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  
  let decoded = text;
  
  // Decode numeric HTML entities (&#64; for @, &#46; for .)
  decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  
  // Decode hex HTML entities (&#x40; for @)
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  // Decode named HTML entities
  const namedEntities: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&nbsp;': ' ',
    '&commat;': '@',
    '&period;': '.',
  };
  
  for (const [entity, char] of Object.entries(namedEntities)) {
    decoded = decoded.replace(new RegExp(entity, 'gi'), char);
  }
  
  return decoded;
}

// Function to decode reversed/backwards email
// Sample: "moc.ynapmoc@ofni" -> "info@company.com"
function decodeReversedEmail(text: string): string | null {
  if (!text) return null;
  
  // Reverse the text
  const reversed = text.split('').reverse().join('');
  
  // Check if it looks like a valid email
  const emailMatch = reversed.match(EMAIL_REGEX);
  if (emailMatch && emailMatch.length > 0) {
    console.log(`[EmailExtractor] Decoded reversed email: ${text} -> ${emailMatch[0]}`);
    return emailMatch[0].toLowerCase();
  }
  
  return null;
}

// Function to decode Base64 encoded emails
// Sample: "aW5mb0Bjb21wYW55LmNvbQ==" -> "info@company.com"
function decodeBase64Email(encoded: string): string | null {
  if (!encoded) return null;
  
  try {
    // Check if it looks like Base64
    if (!/^[A-Za-z0-9+/]+=*$/.test(encoded)) return null;
    
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const emailMatch = decoded.match(EMAIL_REGEX);
    
    if (emailMatch && emailMatch.length > 0) {
      console.log(`[EmailExtractor] Decoded Base64 email: ${encoded} -> ${emailMatch[0]}`);
      return emailMatch[0].toLowerCase();
    }
  } catch {
    // Not valid Base64
  }
  
  return null;
}

// Extract emails that might be reversed in the HTML
// Sample text containing: "moc.ynapmoc@ofni" or data-email-reversed="moc.ynapmoc@ofni"
function extractReversedEmails(text: string): Set<string> {
  const emails = new Set<string>();
  
  // Look for patterns that look like reversed emails (ending with common TLDs reversed)
  const reversedTldPatterns = [
    /moc\.[a-zA-Z0-9.-]+@[a-zA-Z0-9._%+-]+/g,  // .com reversed
    /gro\.[a-zA-Z0-9.-]+@[a-zA-Z0-9._%+-]+/g,  // .org reversed
    /ten\.[a-zA-Z0-9.-]+@[a-zA-Z0-9._%+-]+/g,  // .net reversed
    /gn\.[a-zA-Z0-9.-]+@[a-zA-Z0-9._%+-]+/g,   // .ng reversed
    /az\.[a-zA-Z0-9.-]+@[a-zA-Z0-9._%+-]+/g,   // .za reversed
    /ek\.[a-zA-Z0-9.-]+@[a-zA-Z0-9._%+-]+/g,   // .ke reversed
    /hg\.[a-zA-Z0-9.-]+@[a-zA-Z0-9._%+-]+/g,   // .gh reversed
  ];
  
  for (const pattern of reversedTldPatterns) {
    const matches = text.match(pattern) || [];
    for (const match of matches) {
      const decoded = decodeReversedEmail(match);
      if (decoded && isValidEmail(decoded)) {
        emails.add(decoded);
      }
    }
  }
  
  return emails;
}

// Extract Base64 encoded emails from attributes
// Sample: <span data-email="aW5mb0Bjb21wYW55LmNvbQ==">
function extractBase64Emails(html: string): Set<string> {
  const emails = new Set<string>();
  
  // Look for data attributes with Base64-looking content
  const base64AttrPattern = /data-[a-z-]*(?:email|mail|contact)[a-z-]*\s*=\s*["']([A-Za-z0-9+/]+=*)["']/gi;
  let match;
  
  while ((match = base64AttrPattern.exec(html)) !== null) {
    const decoded = decodeBase64Email(match[1]);
    if (decoded && isValidEmail(decoded)) {
      emails.add(decoded);
    }
  }
  
  // Also check for standalone Base64 strings that decode to emails
  const base64Pattern = /[A-Za-z0-9+/]{20,}={0,2}/g;
  const base64Matches = html.match(base64Pattern) || [];
  
  for (const b64 of base64Matches) {
    const decoded = decodeBase64Email(b64);
    if (decoded && isValidEmail(decoded)) {
      emails.add(decoded);
    }
  }
  
  return emails;
}

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

export interface EmailWithConfidence {
  email: string;
  confidence: number;
  source: string;
  verified?: boolean;
  verificationStatus?: 'valid' | 'invalid' | 'unknown' | 'catch_all' | 'timeout';
}

const PLACEHOLDER_PATTERNS = [
  'example', 'test', 'sample', 'demo', 'placeholder', 'your', 'name@', 
  'email@email', 'user@', 'xxx@', 'abc@', 'someone@', 'person@',
  '@domain', '@company', '@site', '@website', '@yoursite', '@yourdomain'
];

const CONTACT_PAGE_PATTERNS = [
  '/contact', '/about', '/contact-us', '/about-us', '/team', '/support',
  '/help', '/customer-service', '/get-in-touch', '/reach-us'
];

export function calculateEmailConfidence(
  email: string, 
  source: string, 
  websiteDomain: string,
  extractionContext?: {
    foundInMailto?: boolean;
    foundInJavaScript?: boolean;
    pageUrl?: string;
  }
): number {
  let confidence = 50;
  const emailLower = email.toLowerCase();
  const emailDomain = emailLower.split('@')[1] || '';
  const emailPrefix = emailLower.split('@')[0] || '';
  const cleanWebsiteDomain = websiteDomain.replace('www.', '').toLowerCase();
  
  if (emailDomain === cleanWebsiteDomain || emailDomain.endsWith('.' + cleanWebsiteDomain)) {
    confidence += 20;
  }
  
  const pageUrl = extractionContext?.pageUrl?.toLowerCase() || source.toLowerCase();
  if (CONTACT_PAGE_PATTERNS.some(pattern => pageUrl.includes(pattern))) {
    confidence += 15;
  }
  
  if (extractionContext?.foundInMailto) {
    confidence += 10;
  }
  
  if (COMMON_EMAIL_PREFIXES.includes(emailPrefix)) {
    confidence += 10;
  }
  
  if (extractionContext?.foundInJavaScript && !extractionContext?.foundInMailto) {
    confidence -= 20;
  }
  
  if (PLACEHOLDER_PATTERNS.some(pattern => emailLower.includes(pattern))) {
    confidence -= 30;
  }
  
  return Math.max(0, Math.min(100, confidence));
}

export interface ExtractionResult {
  emails: string[];
  error?: string;
  pagesScanned?: number;
  urlsChecked?: string[];
  scanQuality?: 'thorough' | 'partial' | 'blocked';
  methods?: string[];
  validatedEmails?: string[];
  emailsWithConfidence?: EmailWithConfidence[];
  extractionDetails?: {
    blocked?: boolean;
    blockedReason?: string;
    suggestedAction?: string;
  };
}

// Priority levels for page scanning
enum PagePriority {
  CONTACT = 1,    // Highest priority - contact pages
  ABOUT = 2,      // About pages
  LEGAL = 3,      // Legal/policy pages
  FOOTER = 4,     // Footer links
  OTHER = 5       // Other pages
}

interface PriorityPage {
  url: string;
  priority: PagePriority;
  source: string;
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

// Wait for page stability by monitoring DOM mutations and network
async function waitForPageStability(page: any, options: { timeout?: number; mutationWait?: number } = {}): Promise<boolean> {
  const timeout = options.timeout || 8000;
  const mutationWait = options.mutationWait || 2000;
  
  console.log(`[EmailExtractor] Waiting for page stability (timeout: ${timeout}ms, mutation wait: ${mutationWait}ms)`);
  
  try {
    const isStable = await page.evaluate((settings: { timeout: number; mutationWait: number }) => {
      return new Promise<boolean>((resolve) => {
        let lastMutationTime = Date.now();
        let pendingRequests = 0;
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
        
        const checkInterval = setInterval(() => {
          const now = Date.now();
          const timeSinceLastMutation = now - lastMutationTime;
          const elapsedTime = now - startTime;
          
          if (timeSinceLastMutation > settings.mutationWait || elapsedTime > settings.timeout) {
            clearInterval(checkInterval);
            observer.disconnect();
            resolve(timeSinceLastMutation > settings.mutationWait);
          }
        }, 100);
      });
    }, { timeout, mutationWait });
    
    console.log(`[EmailExtractor] Page stability: ${isStable ? 'stable' : 'timeout reached'}`);
    return isStable;
  } catch (error) {
    console.log('[EmailExtractor] Page stability check failed, using fallback wait');
    await new Promise(r => setTimeout(r, 2000));
    return false;
  }
}

// Wait for dynamic content to load with MutationObserver - improved version
async function waitForDynamicContent(page: any, timeout: number = 5000): Promise<void> {
  try {
    await page.evaluate((timeout: number) => {
      return new Promise<void>((resolve) => {
        let lastMutationTime = Date.now();
        const startTime = Date.now();
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        let foundEmailContent = false;
        
        const observer = new MutationObserver((mutations) => {
          lastMutationTime = Date.now();
          
          for (const mutation of mutations) {
            if (mutation.type === 'childList') {
              mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  const text = (node as Element).textContent || '';
                  if (emailRegex.test(text)) {
                    foundEmailContent = true;
                  }
                  const el = node as Element;
                  if (el.querySelector && (
                    el.querySelector('[href^="mailto:"]') ||
                    el.querySelector('.contact, .about, #contact, #about, [class*="contact"], [class*="email"]')
                  )) {
                    foundEmailContent = true;
                  }
                }
              });
            }
          }
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true
        });
        
        const checkInterval = setInterval(() => {
          const now = Date.now();
          const timeSinceLastMutation = now - lastMutationTime;
          const elapsedTime = now - startTime;
          
          if (foundEmailContent && timeSinceLastMutation > 500) {
            clearInterval(checkInterval);
            observer.disconnect();
            resolve();
            return;
          }
          
          if (timeSinceLastMutation > 1000 || elapsedTime > timeout) {
            clearInterval(checkInterval);
            observer.disconnect();
            resolve();
          }
        }, 100);
      });
    }, timeout);
  } catch {
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

// Detect SPA framework type from HTML
function detectSpaFramework(html: string): string | null {
  if (html.includes('id="__next"') || html.includes('__NEXT_DATA__')) return 'nextjs';
  if (html.includes('id="__nuxt"') || html.includes('__NUXT__')) return 'nuxt';
  if (html.includes('ng-version') || html.includes('ng-app')) return 'angular';
  if (html.includes('data-reactroot') || html.includes('id="root"')) return 'react';
  if (html.includes('data-v-') || html.includes('id="app"')) return 'vue';
  if (html.includes('data-svelte') || html.includes('__svelte')) return 'svelte';
  return null;
}

async function fetchPageWithBrowser(url: string, waitTime: number = 3000, mode: DeviceMode = 'desktop', fullScroll: boolean = false, isRetry: boolean = false): Promise<FetchResult> {
  let page: any = null;
  const DEFAULT_TIMEOUT = 45000;
  
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    
    const userAgent = mode === 'mobile' ? MOBILE_USER_AGENT : getRandomUserAgent();
    const viewport = mode === 'mobile' ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT;
    
    await page.setUserAgent(userAgent);
    await page.setViewport(viewport);
    
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
    
    let navigationSucceeded = false;
    
    try {
      console.log(`[EmailExtractor] Navigating to ${url} with networkidle2...`);
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: DEFAULT_TIMEOUT,
      });
      navigationSucceeded = true;
    } catch (navError: any) {
      console.log(`[EmailExtractor] networkidle2 failed, trying networkidle0 fallback...`);
      try {
        await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: DEFAULT_TIMEOUT,
        });
        navigationSucceeded = true;
      } catch (fallbackError: any) {
        console.log(`[EmailExtractor] networkidle0 also failed, trying domcontentloaded...`);
        try {
          await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: DEFAULT_TIMEOUT,
          });
          navigationSucceeded = true;
        } catch (lastError: any) {
          console.error(`[EmailExtractor] All navigation attempts failed for ${url}`);
          return { html: null };
        }
      }
    }
    
    const effectiveWait = isRetry ? waitTime + 3000 : waitTime;
    await new Promise(resolve => setTimeout(resolve, effectiveWait));
    
    const initialHtml = await page.content();
    const spaFramework = detectSpaFramework(initialHtml);
    
    if (spaFramework) {
      console.log(`[EmailExtractor] Detected ${spaFramework} SPA, waiting for hydration...`);
      
      try {
        await page.waitForFunction(() => {
          const w = window as any;
          if (w.__NEXT_DATA__ && document.querySelector('[data-reactroot], #__next')) {
            return document.body.innerHTML.length > 1000;
          }
          if (w.__NUXT__ || document.querySelector('#__nuxt')) {
            return document.body.innerHTML.length > 1000;
          }
          if (document.querySelector('[ng-version]')) {
            return !document.querySelector('.ng-pending');
          }
          if (document.querySelector('[data-reactroot], #root')) {
            return document.body.innerHTML.length > 500;
          }
          if (document.querySelector('[data-v-], #app')) {
            return document.body.innerHTML.length > 500;
          }
          return document.readyState === 'complete';
        }, { timeout: 8000 });
        console.log(`[EmailExtractor] ${spaFramework} hydration complete`);
      } catch {
        console.log(`[EmailExtractor] SPA hydration wait timed out, continuing...`);
      }
    }
    
    try {
      await page.waitForFunction(() => document.readyState === 'complete', { timeout: 8000 });
    } catch {
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
    
    await waitForDynamicContent(page, 5000);
    
    await waitForPageStability(page, { timeout: 8000, mutationWait: 2000 });
    
    const html = await page.content();
    
    const blocked = detectBlockedPage(html);
    
    const iframeEmails = await extractFromIframes(page);
    const shadowEmails = await extractFromShadowDOM(page);
    
    console.log(`[EmailExtractor] Enhanced extraction: ${iframeEmails.size} iframe emails, ${shadowEmails.size} shadow DOM emails`);
    
    return { html, blocked, iframeEmails, shadowEmails };
  } catch (error: any) {
    console.error(`[EmailExtractor] Browser fetch (${mode}) failed for ${url}:`, error.message);
    return { html: null };
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {}
    }
  }
}

async function fetchWithMobileFallback(url: string, waitTime: number = 3000): Promise<{ html: string | null; mobileHtml: string | null; emails: Set<string>; usedMobile: boolean; blocked?: BlockedStatus }> {
  const shouldFullScroll = isPolicyPage(url);
  console.log(`[EmailExtractor] Fetching with desktop viewport: ${url}${shouldFullScroll ? ' (full scroll for policy page)' : ''}`);
  
  // Use longer wait time for e-commerce sites
  const effectiveWaitTime = waitTime + 1000; // Add 1 second for more reliable extraction
  
  let desktopResult = await fetchPageWithBrowser(url, effectiveWaitTime, 'desktop', shouldFullScroll, false);
  let desktopHtml = desktopResult.html;
  let blockedStatus = desktopResult.blocked;
  
  let allEmails = new Set<string>();
  let usedMobile = false;
  let mobileHtmlResult: string | null = null;
  let isEcommerce = false;
  
  // Add iframe and shadow DOM emails from desktop fetch
  desktopResult.iframeEmails?.forEach(e => allEmails.add(e));
  desktopResult.shadowEmails?.forEach(e => allEmails.add(e));
  
  if (desktopHtml) {
    isEcommerce = isShopifyOrEcommerce(desktopHtml);
    const desktopEmails = extractEmailsFromHtml(desktopHtml);
    desktopEmails.forEach(e => allEmails.add(e));
    console.log(`[EmailExtractor] Desktop extraction found ${desktopEmails.size} emails${isEcommerce ? ' (e-commerce site detected)' : ''}`);
    
    // Retry with longer wait if e-commerce site and no emails found
    if (desktopEmails.size === 0 && isEcommerce) {
      console.log(`[EmailExtractor] E-commerce site with no emails, retrying with longer wait...`);
      const retryResult = await fetchPageWithBrowser(url, effectiveWaitTime + 2000, 'desktop', true, true);
      if (retryResult.html) {
        const retryEmails = extractEmailsFromHtml(retryResult.html);
        retryEmails.forEach(e => allEmails.add(e));
        retryResult.iframeEmails?.forEach(e => allEmails.add(e));
        retryResult.shadowEmails?.forEach(e => allEmails.add(e));
        if (retryEmails.size > 0) {
          console.log(`[EmailExtractor] Retry found ${retryEmails.size} emails`);
          desktopHtml = retryResult.html;
        }
        if (retryResult.blocked?.isBlocked) {
          blockedStatus = retryResult.blocked;
        }
      }
    }
    
    if (allEmails.size < 2) {
      console.log(`[EmailExtractor] Few emails found on desktop, trying mobile viewport...`);
      const mobileResult = await fetchPageWithBrowser(url, effectiveWaitTime, 'mobile', shouldFullScroll, false);
      
      if (mobileResult.html) {
        mobileHtmlResult = mobileResult.html;
        const mobileEmails = extractEmailsFromHtml(mobileResult.html);
        const beforeCount = allEmails.size;
        mobileEmails.forEach(e => allEmails.add(e));
        mobileResult.iframeEmails?.forEach(e => allEmails.add(e));
        mobileResult.shadowEmails?.forEach(e => allEmails.add(e));
        const newFromMobile = allEmails.size - beforeCount;
        
        if (newFromMobile > 0) {
          console.log(`[EmailExtractor] Mobile extraction found ${newFromMobile} additional emails`);
          usedMobile = true;
        }
        
        if (mobileResult.blocked?.isBlocked && !blockedStatus?.isBlocked) {
          blockedStatus = mobileResult.blocked;
        }
        
        return { html: desktopHtml, mobileHtml: mobileHtmlResult, emails: allEmails, usedMobile, blocked: blockedStatus };
      }
    }
  } else {
    console.log(`[EmailExtractor] Desktop fetch failed, trying mobile as fallback...`);
    const mobileResult = await fetchPageWithBrowser(url, effectiveWaitTime, 'mobile', shouldFullScroll, false);
    
    if (mobileResult.html) {
      mobileHtmlResult = mobileResult.html;
      isEcommerce = isShopifyOrEcommerce(mobileResult.html);
      const mobileEmails = extractEmailsFromHtml(mobileResult.html);
      mobileEmails.forEach(e => allEmails.add(e));
      mobileResult.iframeEmails?.forEach(e => allEmails.add(e));
      mobileResult.shadowEmails?.forEach(e => allEmails.add(e));
      usedMobile = true;
      
      if (mobileResult.blocked?.isBlocked) {
        blockedStatus = mobileResult.blocked;
      }
      
      // Retry mobile if e-commerce and no emails
      if (mobileEmails.size === 0 && isEcommerce) {
        console.log(`[EmailExtractor] E-commerce mobile with no emails, retrying...`);
        const retryMobile = await fetchPageWithBrowser(url, effectiveWaitTime + 2000, 'mobile', true, true);
        if (retryMobile.html) {
          const retryEmails = extractEmailsFromHtml(retryMobile.html);
          retryEmails.forEach(e => allEmails.add(e));
          retryMobile.iframeEmails?.forEach(e => allEmails.add(e));
          retryMobile.shadowEmails?.forEach(e => allEmails.add(e));
          if (retryEmails.size > 0) {
            console.log(`[EmailExtractor] Mobile retry found ${retryEmails.size} emails`);
            mobileHtmlResult = retryMobile.html;
          }
          if (retryMobile.blocked?.isBlocked) {
            blockedStatus = retryMobile.blocked;
          }
        }
      }
      
      return { html: mobileResult.html, mobileHtml: mobileHtmlResult, emails: allEmails, usedMobile, blocked: blockedStatus };
    }
  }
  
  return { html: desktopHtml, mobileHtml: mobileHtmlResult, emails: allEmails, usedMobile, blocked: blockedStatus };
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
  const processedSitemaps = new Set<string>();
  
  const contactKeywords = [
    'contact', 'about', 'support', 'help', 'team', 'legal', 'privacy', 'terms', 
    'faq', 'customer', 'service', 'info', 'company', 'imprint', 'impressum',
    'reach', 'touch', 'email', 'mail', 'feedback', 'inquiry', 'enquiry'
  ];
  
  async function parseSitemap(sitemapUrl: string, depth: number = 0): Promise<void> {
    if (depth > 2 || processedSitemaps.has(sitemapUrl)) {
      return;
    }
    processedSitemaps.add(sitemapUrl);
    
    try {
      console.log(`[EmailExtractor] Fetching sitemap: ${sitemapUrl} (depth: ${depth})`);
      const response = await fetch(sitemapUrl, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'application/xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(15000),
      });
      
      if (!response.ok) {
        console.log(`[EmailExtractor] Sitemap fetch failed with status: ${response.status}`);
        return;
      }
      
      const xml = await response.text();
      const $ = cheerio.load(xml, { xmlMode: true });
      
      const isSitemapIndex = $('sitemapindex').length > 0;
      
      if (isSitemapIndex) {
        console.log(`[EmailExtractor] Found sitemap index file, processing nested sitemaps...`);
        const nestedSitemaps: string[] = [];
        
        $('sitemap loc').each((_, el) => {
          const nestedUrl = $(el).text().trim();
          if (nestedUrl) {
            const lowerUrl = nestedUrl.toLowerCase();
            if (contactKeywords.some(kw => lowerUrl.includes(kw))) {
              nestedSitemaps.unshift(nestedUrl);
            } else if (lowerUrl.includes('page') || lowerUrl.includes('post')) {
              nestedSitemaps.push(nestedUrl);
            } else {
              nestedSitemaps.push(nestedUrl);
            }
          }
        });
        
        console.log(`[EmailExtractor] Found ${nestedSitemaps.length} nested sitemaps`);
        
        const sitemapsToProcess = nestedSitemaps.slice(0, 5);
        for (const nestedUrl of sitemapsToProcess) {
          await parseSitemap(nestedUrl, depth + 1);
          if (contactUrls.length >= 30) break;
        }
      } else {
        $('url loc, loc').each((_, el) => {
          const url = $(el).text().trim();
          if (!url) return;
          
          const lowerUrl = url.toLowerCase();
          
          if (contactKeywords.some(keyword => lowerUrl.includes(keyword))) {
            if (!contactUrls.includes(url)) {
              contactUrls.push(url);
            }
          }
        });
      }
    } catch (error: any) {
      console.log(`[EmailExtractor] Error parsing sitemap ${sitemapUrl}: ${error.message}`);
    }
  }
  
  try {
    const sitemapUrls = [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap_index.xml`,
      `${baseUrl}/sitemap/sitemap.xml`,
      `${baseUrl}/wp-sitemap.xml`,
      `${baseUrl}/page-sitemap.xml`,
      `${baseUrl}/sitemap-pages.xml`,
    ];
    
    for (const sitemapUrl of sitemapUrls) {
      await parseSitemap(sitemapUrl);
      if (contactUrls.length > 0) {
        console.log(`[EmailExtractor] Successfully found ${contactUrls.length} contact URLs from sitemaps`);
        break;
      }
    }
  } catch (error: any) {
    console.log(`[EmailExtractor] Sitemap fetch failed: ${error.message}`);
  }
  
  return contactUrls.slice(0, 30);
}

function extractContactLinksFromPage(html: string, baseUrl: string): PriorityPage[] {
  const priorityPages: PriorityPage[] = [];
  const seenUrls = new Set<string>();
  
  try {
    const $ = cheerio.load(html);
    const baseUrlObj = new URL(baseUrl);
    
    const contactPatterns = [
      /\bcontact\b/i, /\bcontact[-_]?us\b/i, /\bget[-_]?in[-_]?touch\b/i,
      /\breach[-_]?us\b/i, /\bwrite[-_]?us\b/i, /\bemail[-_]?us\b/i
    ];
    const aboutPatterns = [
      /\babout\b/i, /\babout[-_]?us\b/i, /\bour[-_]?team\b/i, /\bteam\b/i,
      /\bcompany\b/i, /\bwho[-_]?we[-_]?are\b/i, /\bour[-_]?story\b/i
    ];
    const legalPatterns = [
      /\blegal\b/i, /\bprivacy\b/i, /\bterms\b/i, /\bpolicy\b/i,
      /\bimprint\b/i, /\bimpressum\b/i, /\bdisclaimer\b/i
    ];
    const supportPatterns = [
      /\bsupport\b/i, /\bhelp\b/i, /\bfaq\b/i, /\bcustomer[-_]?service\b/i,
      /\bcustomer[-_]?care\b/i, /\bhelp[-_]?center\b/i
    ];
    
    function classifyUrl(url: string, linkText: string): { priority: PagePriority; source: string } | null {
      const combined = `${url} ${linkText}`.toLowerCase();
      
      if (contactPatterns.some(p => p.test(combined))) {
        return { priority: PagePriority.CONTACT, source: 'link' };
      }
      if (aboutPatterns.some(p => p.test(combined))) {
        return { priority: PagePriority.ABOUT, source: 'link' };
      }
      if (legalPatterns.some(p => p.test(combined))) {
        return { priority: PagePriority.LEGAL, source: 'link' };
      }
      if (supportPatterns.some(p => p.test(combined))) {
        return { priority: PagePriority.CONTACT, source: 'link' };
      }
      
      return null;
    }
    
    function processLink(href: string, linkText: string, source: string): void {
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || 
          href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }
      
      try {
        let fullUrl: string;
        if (href.startsWith('http')) {
          fullUrl = href;
        } else if (href.startsWith('//')) {
          fullUrl = `${baseUrlObj.protocol}${href}`;
        } else if (href.startsWith('/')) {
          fullUrl = `${baseUrlObj.origin}${href}`;
        } else {
          fullUrl = new URL(href, baseUrl).href;
        }
        
        const urlObj = new URL(fullUrl);
        if (urlObj.host !== baseUrlObj.host) {
          return;
        }
        
        const cleanUrl = `${urlObj.origin}${urlObj.pathname}`.replace(/\/$/, '');
        
        if (seenUrls.has(cleanUrl)) {
          return;
        }
        seenUrls.add(cleanUrl);
        
        const classification = classifyUrl(urlObj.pathname, linkText);
        if (classification) {
          priorityPages.push({
            url: cleanUrl,
            priority: classification.priority,
            source: source
          });
        }
      } catch {
      }
    }
    
    $('footer a, [class*="footer"] a, [id*="footer"] a').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href) {
        processLink(href, text, 'footer');
      }
    });
    
    $('nav a, header a, [class*="nav"] a, [class*="menu"] a').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href) {
        processLink(href, text, 'navigation');
      }
    });
    
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href) {
        processLink(href, text, 'body');
      }
    });
    
    priorityPages.sort((a, b) => a.priority - b.priority);
    
    console.log(`[EmailExtractor] Extracted ${priorityPages.length} contact-related links from page`);
    
  } catch (error: any) {
    console.log(`[EmailExtractor] Error extracting contact links: ${error.message}`);
  }
  
  return priorityPages;
}

interface CrawlResult {
  emails: Set<string>;
  pagesScanned: number;
  urlsChecked: string[];
  scanQuality: 'thorough' | 'partial' | 'blocked';
  textContent: string;
  blocked?: BlockedStatus;
}

async function crawlPriorityPages(
  baseUrl: string,
  initialHtml: string,
  maxPages: number = 15,
  fetchFunction: (url: string) => Promise<{ html: string | null; emails: Set<string>; blocked?: BlockedStatus }>
): Promise<CrawlResult> {
  const result: CrawlResult = {
    emails: new Set<string>(),
    pagesScanned: 0,
    urlsChecked: [],
    scanQuality: 'thorough',
    textContent: ''
  };
  
  const scannedUrls = new Set<string>();
  const priorityQueue: PriorityPage[] = [];
  
  console.log(`[EmailExtractor] Starting priority crawl with max ${maxPages} pages`);
  
  const linksFromPage = extractContactLinksFromPage(initialHtml, baseUrl);
  priorityQueue.push(...linksFromPage);
  
  try {
    const sitemapUrls = await fetchSitemap(baseUrl);
    for (const url of sitemapUrls) {
      const lowerUrl = url.toLowerCase();
      let priority = PagePriority.OTHER;
      
      if (/contact/i.test(lowerUrl)) priority = PagePriority.CONTACT;
      else if (/about/i.test(lowerUrl)) priority = PagePriority.ABOUT;
      else if (/legal|privacy|terms|policy/i.test(lowerUrl)) priority = PagePriority.LEGAL;
      else if (/support|help|faq/i.test(lowerUrl)) priority = PagePriority.CONTACT;
      
      if (!priorityQueue.some(p => p.url === url)) {
        priorityQueue.push({ url, priority, source: 'sitemap' });
      }
    }
  } catch (error: any) {
    console.log(`[EmailExtractor] Sitemap crawl failed: ${error.message}`);
  }
  
  for (const path of PRIORITY_CONTACT_PATHS.slice(0, 30)) {
    const fullUrl = `${baseUrl}${path}`;
    if (!priorityQueue.some(p => p.url === fullUrl)) {
      let priority = PagePriority.OTHER;
      if (/contact/i.test(path)) priority = PagePriority.CONTACT;
      else if (/about/i.test(path)) priority = PagePriority.ABOUT;
      else if (/legal|privacy|terms|policy/i.test(path)) priority = PagePriority.LEGAL;
      
      priorityQueue.push({ url: fullUrl, priority, source: 'known-paths' });
    }
  }
  
  priorityQueue.sort((a, b) => a.priority - b.priority);
  
  console.log(`[EmailExtractor] Priority queue has ${priorityQueue.length} URLs to check`);
  
  let blockedCount = 0;
  let successCount = 0;
  
  for (const page of priorityQueue) {
    if (result.pagesScanned >= maxPages) {
      console.log(`[EmailExtractor] Reached max pages limit (${maxPages})`);
      result.scanQuality = 'partial';
      break;
    }
    
    if (scannedUrls.has(page.url)) {
      continue;
    }
    scannedUrls.add(page.url);
    
    console.log(`[EmailExtractor] Scanning priority ${page.priority} page: ${page.url} (source: ${page.source})`);
    
    try {
      const fetchResult = await fetchFunction(page.url);
      result.pagesScanned++;
      result.urlsChecked.push(page.url);
      
      if (fetchResult.blocked?.isBlocked) {
        blockedCount++;
        if (!result.blocked) {
          result.blocked = fetchResult.blocked;
        }
        console.log(`[EmailExtractor] Page blocked: ${page.url} - ${fetchResult.blocked.reason}`);
        continue;
      }
      
      if (fetchResult.html) {
        successCount++;
        fetchResult.emails.forEach(e => result.emails.add(e));
        
        const $ = cheerio.load(fetchResult.html);
        result.textContent += $('body').text() + '\n\n';
        
        const pageEmails = extractEmailsFromHtml(fetchResult.html);
        pageEmails.forEach(e => result.emails.add(e));
        
        console.log(`[EmailExtractor] Page ${page.url}: found ${pageEmails.size} emails, total: ${result.emails.size}`);
        
        if (result.emails.size >= 5) {
          console.log(`[EmailExtractor] Found enough emails (${result.emails.size}), stopping crawl`);
          break;
        }
      }
    } catch (error: any) {
      console.log(`[EmailExtractor] Error scanning ${page.url}: ${error.message}`);
    }
  }
  
  if (blockedCount > successCount && result.pagesScanned > 3) {
    result.scanQuality = 'blocked';
  } else if (result.pagesScanned < maxPages / 2) {
    result.scanQuality = 'partial';
  }
  
  console.log(`[EmailExtractor] Crawl complete: ${result.pagesScanned} pages, ${result.emails.size} emails, quality: ${result.scanQuality}`);
  
  return result;
}

// Extract emails from contact forms
// Sample: <form action="mailto:info@company.com"> or <input type="hidden" name="recipient" value="sales@company.com">
function extractFromContactForms(html: string): Set<string> {
  const emails = new Set<string>();
  const $ = cheerio.load(html);
  
  console.log('[EmailExtractor] Starting contact form extraction...');
  
  // Find form elements
  $('form').each((_, form) => {
    const action = $(form).attr('action') || '';
    
    // Check action URL for mailto or email patterns
    if (action.includes('mailto:')) {
      const email = action.replace('mailto:', '').split('?')[0];
      if (isValidEmail(email.toLowerCase())) {
        console.log(`[EmailExtractor] Found email in form action: ${email}`);
        emails.add(email.toLowerCase());
      }
    }
    
    // Check hidden inputs for email values
    // Sample: <input type="hidden" name="recipient" value="contact@company.com">
    $(form).find('input[type="hidden"]').each((_, input) => {
      const value = $(input).attr('value') || '';
      const name = $(input).attr('name') || '';
      if (name.toLowerCase().includes('email') || 
          name.toLowerCase().includes('recipient') || 
          name.toLowerCase().includes('to') ||
          name.toLowerCase().includes('mailto')) {
        const found = value.match(EMAIL_REGEX);
        if (found) {
          found.forEach(e => {
            if (isValidEmail(e.toLowerCase())) {
              console.log(`[EmailExtractor] Found email in hidden input: ${e}`);
              emails.add(e.toLowerCase());
            }
          });
        }
      }
    });
    
    // Check form labels for email addresses
    $(form).find('label').each((_, label) => {
      const text = $(label).text();
      const found = text.match(EMAIL_REGEX);
      if (found) {
        found.forEach(e => {
          if (isValidEmail(e.toLowerCase())) {
            console.log(`[EmailExtractor] Found email in form label: ${e}`);
            emails.add(e.toLowerCase());
          }
        });
      }
    });
    
    // Check for data attributes on form that might contain encoded emails
    const formDataEmail = $(form).attr('data-email') || $(form).attr('data-recipient') || '';
    if (formDataEmail) {
      const found = formDataEmail.match(EMAIL_REGEX);
      if (found) {
        found.forEach(e => {
          if (isValidEmail(e.toLowerCase())) {
            emails.add(e.toLowerCase());
          }
        });
      }
    }
  });
  
  // Check for common contact form plugin patterns
  // Sample: <div class="wpcf7-form" data-recipient="info@company.com">
  $('[class*="contact-form"], [class*="wpcf7"], [id*="contact-form"], [class*="form-container"]').each((_, el) => {
    const dataAttrs = $(el).attr();
    if (dataAttrs) {
      Object.values(dataAttrs).forEach((value: any) => {
        if (typeof value === 'string') {
          const found = value.match(EMAIL_REGEX);
          if (found) {
            found.forEach(e => {
              if (isValidEmail(e.toLowerCase())) {
                console.log(`[EmailExtractor] Found email in contact form data attr: ${e}`);
                emails.add(e.toLowerCase());
              }
            });
          }
        }
      });
    }
  });
  
  console.log(`[EmailExtractor] Contact forms extraction found ${emails.size} emails`);
  return emails;
}

// Extract emails from near social media links
// Sample: Find email near Facebook/LinkedIn/Twitter links
function extractFromSocialLinks(html: string, domain: string): Set<string> {
  const emails = new Set<string>();
  const $ = cheerio.load(html);
  
  console.log('[EmailExtractor] Starting social links extraction...');
  
  const socialSelectors = [
    'a[href*="facebook.com"]',
    'a[href*="linkedin.com"]',
    'a[href*="twitter.com"]',
    'a[href*="instagram.com"]',
    'a[href*="youtube.com"]',
    'a[href*="tiktok.com"]',
    'a[href*="pinterest.com"]',
    'a[href*="whatsapp.com"]',
    '[class*="social"]',
    '[id*="social"]',
    '[class*="follow-us"]',
    '[class*="connect"]',
  ];
  
  socialSelectors.forEach(selector => {
    $(selector).each((_, el) => {
      // Check parent and nearby elements for email references
      const parent = $(el).parent();
      const grandparent = parent.parent();
      const nearbyText = parent.text() + ' ' + parent.next().text() + ' ' + parent.prev().text() + ' ' + grandparent.text();
      
      const found = nearbyText.match(EMAIL_REGEX);
      if (found) {
        found.forEach(email => {
          if (isValidEmail(email.toLowerCase())) {
            console.log(`[EmailExtractor] Found email near social link: ${email}`);
            emails.add(email.toLowerCase());
          }
        });
      }
    });
  });
  
  // Check for "contact us via email" patterns near social links
  // Sample: "Connect with us on social media or email us at info@company.com"
  $('[class*="contact"], [class*="footer"], [class*="connect"], [id*="contact"], [id*="footer"]').each((_, el) => {
    const text = $(el).text();
    if (/contact.*email|email.*us|reach.*email|write.*email|send.*email|enquir.*email/i.test(text)) {
      const found = text.match(EMAIL_REGEX);
      if (found) {
        found.forEach(email => {
          if (isValidEmail(email.toLowerCase())) {
            console.log(`[EmailExtractor] Found email near contact text: ${email}`);
            emails.add(email.toLowerCase());
          }
        });
      }
    }
  });
  
  // Check for email icons (envelope/mail icons often indicate email)
  $('[class*="mail"], [class*="envelope"], [class*="email-icon"], .fa-envelope, .icon-mail').each((_, el) => {
    const parent = $(el).parent();
    const nearby = parent.text() + ' ' + parent.next().text();
    const found = nearby.match(EMAIL_REGEX);
    if (found) {
      found.forEach(email => {
        if (isValidEmail(email.toLowerCase())) {
          console.log(`[EmailExtractor] Found email near mail icon: ${email}`);
          emails.add(email.toLowerCase());
        }
      });
    }
  });
  
  console.log(`[EmailExtractor] Social links extraction found ${emails.size} emails`);
  return emails;
}

function extractEmailsFromHtml(html: string): Set<string> {
  const emails = new Set<string>();
  
  // First, decode HTML entities in the raw HTML before parsing
  // This helps catch emails obfuscated with &#64; (for @) and &#46; (for .)
  const decodedHtml = decodeHtmlEntities(html);
  
  const $ = cheerio.load(decodedHtml);
  
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
  
  // Call new extraction functions with the original HTML
  // Extract from contact forms
  const contactFormEmails = extractFromContactForms(html);
  contactFormEmails.forEach(e => emails.add(e));
  
  // Extract from near social links (use empty domain string as we don't have it here)
  const socialLinkEmails = extractFromSocialLinks(html, '');
  socialLinkEmails.forEach(e => emails.add(e));
  
  // Extract reversed emails (emails written backwards like moc.ynapmoc@ofni)
  const reversedEmails = extractReversedEmails(html);
  reversedEmails.forEach(e => emails.add(e));
  
  // Extract Base64 encoded emails from data attributes
  const base64Emails = extractBase64Emails(html);
  base64Emails.forEach(e => emails.add(e));
  
  // Extract emails from noscript tags (often contain fallback content with emails)
  // Sample: <noscript>Contact us at info@company.com</noscript>
  const noscriptRegex = /<noscript[^>]*>([\s\S]*?)<\/noscript>/gi;
  let noscriptMatch;
  while ((noscriptMatch = noscriptRegex.exec(html)) !== null) {
    const noscriptContent = noscriptMatch[1];
    const decodedNoscript = decodeHtmlEntities(noscriptContent);
    const found = decodedNoscript.match(EMAIL_REGEX);
    if (found) {
      found.forEach(email => {
        if (isValidEmail(email.toLowerCase())) {
          console.log(`[EmailExtractor] Found email in noscript tag: ${email}`);
          emails.add(email.toLowerCase());
        }
      });
    }
  }
  
  // Extract emails from HTML comments
  // Sample: <!-- Contact: info@company.com -->
  const commentRegex = /<!--([\s\S]*?)-->/g;
  let commentMatch;
  while ((commentMatch = commentRegex.exec(html)) !== null) {
    const commentContent = commentMatch[1];
    const decodedComment = decodeHtmlEntities(commentContent);
    const found = decodedComment.match(EMAIL_REGEX);
    if (found) {
      found.forEach(email => {
        if (isValidEmail(email.toLowerCase())) {
          console.log(`[EmailExtractor] Found email in HTML comment: ${email}`);
          emails.add(email.toLowerCase());
        }
      });
    }
  }
  
  // Check for Cloudflare email protection patterns
  // Sample: <a href="/cdn-cgi/l/email-protection#..." data-cfemail="...">
  const cfeMailPattern = /data-cfemail\s*=\s*["']([^"']+)["']/gi;
  let cfMatch;
  while ((cfMatch = cfeMailPattern.exec(html)) !== null) {
    const decoded = decodeCloudflareEmail(cfMatch[1]);
    if (decoded && isValidEmail(decoded.toLowerCase())) {
      console.log(`[EmailExtractor] Found Cloudflare protected email: ${decoded}`);
      emails.add(decoded.toLowerCase());
    }
  }
  
  console.log(`[EmailExtractor] Total emails extracted from HTML: ${emails.size}`);
  
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
    let overallBlockedStatus: BlockedStatus | undefined;
    
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
            if (browserResult.blocked?.isBlocked && !overallBlockedStatus?.isBlocked) {
              overallBlockedStatus = browserResult.blocked;
            }
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
          if (browserResult.blocked?.isBlocked && !overallBlockedStatus?.isBlocked) {
            overallBlockedStatus = browserResult.blocked;
          }
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
          if (browserResult.blocked?.isBlocked && !overallBlockedStatus?.isBlocked) {
            overallBlockedStatus = browserResult.blocked;
          }
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
      if (browserResult.blocked?.isBlocked && !overallBlockedStatus?.isBlocked) {
        overallBlockedStatus = browserResult.blocked;
      }
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
    
    // Track all URLs that were checked for the new reporting fields
    const urlsChecked: string[] = [rootUrl];
    if (isUserUrlDifferentFromRoot) {
      urlsChecked.push(userProvidedUrl);
    }
    let scanQuality: 'thorough' | 'partial' | 'blocked' = 'thorough';
    
    // Step 2: Use new priority crawl system for efficient page scanning
    console.log(`[EmailExtractor] Step 2: Starting priority-based crawl...`);
    
    // Create fetch wrapper function for crawlPriorityPages
    const fetchForCrawl = async (url: string): Promise<{ html: string | null; emails: Set<string>; blocked?: BlockedStatus }> => {
      const emails = new Set<string>();
      let blocked: BlockedStatus | undefined;
      
      try {
        const shouldUseBrowser = usedBrowser || isEcommerceSite || isPolicyPage(url);
        let html: string | null = null;
        
        if (shouldUseBrowser) {
          const result = await fetchWithMobileFallback(url, 4000);
          html = result.html;
          result.emails.forEach(e => emails.add(e));
          if (result.blocked?.isBlocked) {
            blocked = result.blocked;
          }
        } else {
          html = await fetchPageSimple(url);
          if (html) {
            const foundEmails = extractEmailsFromHtml(html);
            foundEmails.forEach(e => emails.add(e));
          }
          if (!html || emails.size === 0) {
            const browserResult = await fetchWithMobileFallback(url, 3000);
            html = browserResult.html;
            browserResult.emails.forEach(e => emails.add(e));
            if (browserResult.blocked?.isBlocked) {
              blocked = browserResult.blocked;
            }
          }
        }
        
        // Also run AI analysis on pages with no emails
        if (html && emails.size === 0) {
          const pageText = cheerio.load(html)('body').text();
          const aiPageEmails = await analyzeWithAI(pageText, domain);
          aiPageEmails.forEach(e => emails.add(e));
        }
        
        return { html, emails, blocked };
      } catch (error: any) {
        console.log(`[EmailExtractor] Fetch error for ${url}: ${error.message}`);
        return { html: null, emails, blocked };
      }
    };
    
    // Perform priority-based crawl with max 15 pages
    const crawlResult = await crawlPriorityPages(baseUrl, rootHtml, 15, fetchForCrawl);
    
    // Merge results from priority crawl
    crawlResult.emails.forEach(e => allEmails.add(e));
    pagesScanned += crawlResult.pagesScanned;
    urlsChecked.push(...crawlResult.urlsChecked);
    scanQuality = crawlResult.scanQuality;
    combinedTextForAI += crawlResult.textContent;
    
    if (crawlResult.blocked?.isBlocked && !overallBlockedStatus?.isBlocked) {
      overallBlockedStatus = crawlResult.blocked;
    }
    
    console.log(`[EmailExtractor] After priority crawl: found ${allEmails.size} emails, scanned ${pagesScanned} pages, quality: ${scanQuality}`);
    methodsUsed.push('priority_crawl');
    
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
    
    // Validate emails with DNS MX record verification
    let validatedEmails: string[] = [];
    if (emailArray.length > 0) {
      console.log(`[EmailExtractor] Validating ${emailArray.length} emails with MX record check...`);
      validatedEmails = await validateEmails(emailArray);
      console.log(`[EmailExtractor] ${validatedEmails.length} emails passed MX validation`);
      methodsUsed.push('mx_validation');
    }
    
    // Calculate confidence scores and run SMTP verification
    let emailsWithConfidence: EmailWithConfidence[] = [];
    const emailsToVerify = validatedEmails.length > 0 ? validatedEmails : emailArray;
    
    if (emailsToVerify.length > 0) {
      console.log(`[EmailExtractor] Calculating confidence scores for ${emailsToVerify.length} emails...`);
      
      // Calculate initial confidence scores
      emailsWithConfidence = emailsToVerify.map(email => ({
        email,
        confidence: calculateEmailConfidence(email, rootUrl, domain),
        source: rootUrl,
        verified: undefined,
        verificationStatus: undefined
      }));
      
      // Run SMTP verification (with timeout protection)
      console.log(`[EmailExtractor] Running SMTP verification for ${emailsToVerify.length} emails...`);
      try {
        const smtpResults = await Promise.race([
          batchVerifyEmails(emailsToVerify),
          new Promise<EmailVerificationResult[]>((resolve) => 
            setTimeout(() => resolve([]), 30000)
          )
        ]);
        
        if (smtpResults.length > 0) {
          methodsUsed.push('smtp_verification');
          
          // Merge SMTP results with confidence scores
          const smtpResultMap = new Map<string, EmailVerificationResult>();
          smtpResults.forEach(result => smtpResultMap.set(result.email.toLowerCase(), result));
          
          emailsWithConfidence = emailsWithConfidence.map(emailInfo => {
            const smtpResult = smtpResultMap.get(emailInfo.email.toLowerCase());
            if (smtpResult) {
              // Adjust confidence based on SMTP verification
              let adjustedConfidence = emailInfo.confidence;
              if (smtpResult.status === 'valid') {
                adjustedConfidence = Math.min(100, adjustedConfidence + 25);
              } else if (smtpResult.status === 'invalid') {
                adjustedConfidence = Math.max(0, adjustedConfidence - 40);
              } else if (smtpResult.status === 'catch_all') {
                adjustedConfidence = Math.min(100, adjustedConfidence + 10);
              }
              
              return {
                ...emailInfo,
                confidence: adjustedConfidence,
                verified: smtpResult.isValid,
                verificationStatus: smtpResult.status
              };
            }
            return emailInfo;
          });
          
          console.log(`[EmailExtractor] SMTP verification complete: ${smtpResults.filter(r => r.isValid).length}/${smtpResults.length} verified as deliverable`);
        }
      } catch (smtpError: any) {
        console.log(`[EmailExtractor] SMTP verification failed: ${smtpError.message}`);
      }
      
      // Sort by confidence (highest first)
      emailsWithConfidence.sort((a, b) => b.confidence - a.confidence);
      console.log(`[EmailExtractor] Top email confidence: ${emailsWithConfidence[0]?.confidence || 0}`);
    }
    
    // Build extraction details with blocked status
    const extractionDetails: ExtractionResult['extractionDetails'] = {};
    if (overallBlockedStatus?.isBlocked) {
      extractionDetails.blocked = true;
      extractionDetails.blockedReason = overallBlockedStatus.reason;
      extractionDetails.suggestedAction = overallBlockedStatus.suggestion;
      console.log(`[EmailExtractor] Warning: Some pages were blocked - ${overallBlockedStatus.reason}`);
    }
    
    console.log(`[EmailExtractor] Final results: ${emailArray.length} emails, ${pagesScanned} pages scanned, quality: ${scanQuality}`);
    console.log(`[EmailExtractor] URLs checked: ${urlsChecked.length} unique URLs`);
    
    // Get final email list sorted by confidence
    const finalEmails = emailsWithConfidence.length > 0 
      ? emailsWithConfidence.map(e => e.email) 
      : (validatedEmails.length > 0 ? validatedEmails : emailArray);
    
    return {
      emails: finalEmails,
      validatedEmails: validatedEmails,
      emailsWithConfidence: emailsWithConfidence.length > 0 ? emailsWithConfidence : undefined,
      pagesScanned,
      urlsChecked: [...new Set(urlsChecked)], // Deduplicate URLs
      scanQuality,
      methods: methodsUsed,
      extractionDetails: Object.keys(extractionDetails).length > 0 ? extractionDetails : undefined,
    };
  } catch (error: any) {
    console.error('[EmailExtractor] Error:', error.message);
    return {
      emails: [],
      error: error.message || 'Failed to extract emails',
      pagesScanned: 0,
      urlsChecked: [],
      scanQuality: 'blocked',
      methods: [],
    };
  }
}

process.on('exit', async () => {
  if (browserInstance) {
    await browserInstance.close();
  }
});
