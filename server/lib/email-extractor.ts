import * as cheerio from "cheerio";
import puppeteer from "puppeteer";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const OBFUSCATED_PATTERNS = [
  /([a-zA-Z0-9._%+-]+)\s*\[\s*at\s*\]\s*([a-zA-Z0-9.-]+)\s*\[\s*dot\s*\]\s*([a-zA-Z]{2,})/gi,
  /([a-zA-Z0-9._%+-]+)\s*\(\s*at\s*\)\s*([a-zA-Z0-9.-]+)\s*\(\s*dot\s*\)\s*([a-zA-Z]{2,})/gi,
  /([a-zA-Z0-9._%+-]+)\s*@\s*([a-zA-Z0-9.-]+)\s*\.\s*([a-zA-Z]{2,})/g,
  /([a-zA-Z0-9._%+-]+)\s*\[at\]\s*([a-zA-Z0-9.-]+)\s*\[dot\]\s*([a-zA-Z]{2,})/gi,
  /([a-zA-Z0-9._%+-]+)\s*\(at\)\s*([a-zA-Z0-9.-]+)\s*\(dot\)\s*([a-zA-Z]{2,})/gi,
  /([a-zA-Z0-9._%+-]+)\s+at\s+([a-zA-Z0-9.-]+)\s+dot\s+([a-zA-Z]{2,})/gi,
];

const PRIORITY_CONTACT_PATHS = [
  '/contact',
  '/contact-us',
  '/contactus',
  '/contact.html',
  '/about/contact',
  '/about-us/contact',
  '/support',
  '/support/contact',
  '/help',
  '/help/contact',
  '/help-center',
  '/customer-service',
  '/customer-support',
  '/get-in-touch',
  '/reach-us',
  '/about',
  '/about-us',
  '/aboutus',
  '/company',
  '/company/about',
  '/team',
  '/our-team',
  '/legal',
  '/legal/terms',
  '/legal/privacy',
  '/privacy',
  '/privacy-policy',
  '/terms',
  '/terms-and-conditions',
  '/imprint',
  '/impressum',
  '/info',
  '/information',
  '/faq',
  '/faqs',
  '/careers',
  '/jobs',
  '/press',
  '/media',
  '/newsroom',
  '/sp-help-center',
  '/seller-center',
  '/vendor',
  '/partners',
  '/sp-contact',
  '/sp-about_us',
];

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

async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    console.log('[EmailExtractor] Launching browser...');
    
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
      ],
    });
    console.log('[EmailExtractor] Browser launched successfully');
  }
  return browserInstance;
}

async function fetchPageWithBrowser(url: string, waitTime: number = 3000): Promise<string | null> {
  let page: any = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
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
    
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const html = await page.content();
    return html;
  } catch (error: any) {
    console.error(`[EmailExtractor] Browser fetch failed for ${url}:`, error.message);
    return null;
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {}
    }
  }
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
    
    const prompt = `You are an expert at finding contact information. Analyze the following website content and extract ALL email addresses you can find. Look for:
1. Direct email addresses (e.g., support@company.com)
2. Obfuscated emails (e.g., "support [at] company [dot] com" or "support(at)company(dot)com")
3. Email patterns mentioned in text (e.g., "email us at support at company.com")
4. Any contact email hints or references

Domain being analyzed: ${domain}

Website content:
${truncatedContent}

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
          if (parsed.emails && Array.isArray(parsed.emails)) {
            parsed.emails.forEach((email: string) => {
              const cleaned = email.toLowerCase().trim();
              if (isValidEmail(cleaned)) {
                emails.add(cleaned);
              }
            });
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
  
  return contactUrls.slice(0, 10);
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
  
  return emails;
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
  
  return true;
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
  
  return Array.from(links);
}

function findContactLinks(links: string[], baseUrl: string): string[] {
  const contactLinks: string[] = [];
  const baseUrlObj = new URL(baseUrl);
  const addedPaths = new Set<string>();
  
  const highPriorityKeywords = ['contact', 'about', 'support', 'help', 'customer-service', 'customer-care', 'get-in-touch', 'reach-us', 'sp-contact', 'sp-about'];
  const mediumPriorityKeywords = ['team', 'company', 'legal', 'privacy', 'terms', 'faq', 'info', 'careers'];
  const lowPriorityKeywords = ['press', 'media', 'partners', 'investors', 'newsroom'];
  
  const productKeywords = ['product', 'item', 'shop', 'buy', 'cart', 'checkout', 'category', 'categories', 'search', 'filter', 'price', 'sale', 'deal', 'offer', 'brand', 'store', '.html', 'mpg', 'sku', 'ref'];
  
  for (const link of links) {
    const lowerLink = link.toLowerCase();
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
    }
  }
  
  for (const path of PRIORITY_CONTACT_PATHS) {
    const url = `${baseUrlObj.protocol}//${baseUrlObj.host}${path}`;
    if (!addedPaths.has(path)) {
      contactLinks.push(url);
      addedPaths.add(path);
    }
  }
  
  return contactLinks.slice(0, 15);
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
    const domain = baseUrlObj.host.replace('www.', '');
    const brandName = getBrandName(domain);
    
    const allEmails = new Set<string>();
    const methodsUsed: string[] = [];
    let pagesScanned = 0;
    
    console.log(`[EmailExtractor] Starting enhanced extraction for: ${fullUrl}`);
    console.log(`[EmailExtractor] Domain: ${domain}, Brand: ${brandName}`);
    
    let mainHtml = await fetchPageSimple(fullUrl);
    let usedBrowser = false;
    
    if (mainHtml) {
      const initialEmails = extractEmailsFromHtml(mainHtml);
      
      const isJsRendered = mainHtml.includes('id="root"') || 
                           mainHtml.includes('id="app"') || 
                           mainHtml.includes('id="__next"') ||
                           mainHtml.includes('id="__nuxt"') ||
                           mainHtml.includes('ng-version') ||
                           (mainHtml.length < 5000 && initialEmails.size === 0);
      
      if (isJsRendered || initialEmails.size === 0) {
        console.log(`[EmailExtractor] Detected JavaScript-rendered page or no initial emails, using browser...`);
        const browserHtml = await fetchPageWithBrowser(fullUrl, 4000);
        if (browserHtml) {
          mainHtml = browserHtml;
          usedBrowser = true;
        }
      }
    } else {
      console.log(`[EmailExtractor] Simple fetch failed, trying browser...`);
      mainHtml = await fetchPageWithBrowser(fullUrl, 4000);
      usedBrowser = true;
    }
    
    if (!mainHtml) {
      console.log(`[EmailExtractor] All fetch methods failed`);
      return {
        emails: [],
        pagesScanned: 0,
        error: 'Failed to fetch the page. The website may be blocking automated requests or is unavailable.',
        methods: [],
      };
    }
    
    pagesScanned++;
    const mainEmails = extractEmailsFromHtml(mainHtml);
    mainEmails.forEach(email => allEmails.add(email));
    console.log(`[EmailExtractor] Main page: found ${mainEmails.size} emails`);
    methodsUsed.push('html_scraping');
    
    const textContent = cheerio.load(mainHtml)('body').text();
    const aiEmails = await analyzeWithAI(textContent, domain);
    aiEmails.forEach(email => allEmails.add(email));
    if (aiEmails.size > 0) {
      methodsUsed.push('ai_analysis');
    }
    
    const pageLinks = extractLinksFromHtml(mainHtml, baseUrl);
    const sitemapUrls = await fetchSitemap(baseUrl);
    const contactLinks = findContactLinks([...pageLinks, ...sitemapUrls], baseUrl);
    
    console.log(`[EmailExtractor] Found ${contactLinks.length} priority contact pages to scan`);
    
    const scanPromises = contactLinks.slice(0, 12).map(async (link) => {
      try {
        let html: string | null;
        if (usedBrowser) {
          html = await fetchPageWithBrowser(link, 3000);
        } else {
          html = await fetchPageSimple(link);
          if (!html) {
            html = await fetchPageWithBrowser(link, 3000);
          }
        }
        
        if (html) {
          const emails = extractEmailsFromHtml(html);
          
          if (emails.size === 0) {
            const pageText = cheerio.load(html)('body').text();
            const aiPageEmails = await analyzeWithAI(pageText, domain);
            aiPageEmails.forEach(e => emails.add(e));
          }
          
          console.log(`[EmailExtractor] ${link}: found ${emails.size} emails`);
          return { link, emails: Array.from(emails), success: true };
        }
        return { link, emails: [], success: false };
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
