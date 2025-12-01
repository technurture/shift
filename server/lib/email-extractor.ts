import * as cheerio from "cheerio";

// Email regex pattern (matches most valid email formats)
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export interface ExtractionResult {
  emails: string[];
  error?: string;
}

export async function extractEmailsFromUrl(url: string): Promise<ExtractionResult> {
  try {
    // Ensure URL has protocol
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    
    // Fetch the HTML
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      return {
        emails: [],
        error: `Failed to fetch URL: ${response.status} ${response.statusText}`
      };
    }

    const html = await response.text();
    
    // Parse HTML with cheerio
    const $ = cheerio.load(html);
    
    // Remove script and style tags to avoid false positives
    $('script').remove();
    $('style').remove();
    
    // Get all text content
    const textContent = $('body').text();
    
    // Also check common email locations
    const emailElements = $('a[href^="mailto:"]').map((_, el) => {
      const href = $(el).attr('href');
      return href?.replace('mailto:', '').split('?')[0] || '';
    }).get();
    
    // Extract emails from text content
    const emailsFromText = textContent.match(EMAIL_REGEX) || [];
    
    // Combine and deduplicate
    const allEmails = [...new Set([...emailElements, ...emailsFromText])];
    
    // Filter out common false positives and validate
    const validEmails = allEmails.filter(email => {
      const lower = email.toLowerCase();
      // Filter out common image extensions and invalid patterns
      if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.gif') || 
          lower.endsWith('.svg') || lower.endsWith('.webp')) {
        return false;
      }
      // Basic validation: must have @ and valid TLD
      const parts = email.split('@');
      if (parts.length !== 2) return false;
      const domain = parts[1];
      return domain.includes('.') && domain.split('.').pop()!.length >= 2;
    });
    
    return {
      emails: validEmails,
    };
  } catch (error: any) {
    return {
      emails: [],
      error: error.message || 'Failed to extract emails'
    };
  }
}
