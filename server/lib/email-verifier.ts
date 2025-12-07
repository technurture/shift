import * as net from "net";
import dns from "dns";
import { promisify } from "util";

const resolveMx = promisify(dns.resolveMx);

export interface EmailVerificationResult {
  email: string;
  isValid: boolean;
  status: 'valid' | 'invalid' | 'unknown' | 'catch_all' | 'timeout';
  confidence: number;
  reason?: string;
}

interface CacheEntry {
  result: EmailVerificationResult;
  timestamp: number;
}

interface CatchAllCacheEntry {
  isCatchAll: boolean;
  timestamp: number;
}

const verificationCache = new Map<string, CacheEntry>();
const catchAllCache = new Map<string, CatchAllCacheEntry>();
const CACHE_TTL = 3600000;

// Increased timeout for more reliable SMTP verification
const SMTP_TIMEOUT = 8000;
const SENDER_EMAIL = "verify@emailchecker.local";

function generateRandomEmail(domain: string): string {
  const randomString = Math.random().toString(36).substring(2, 15) + 
                       Math.random().toString(36).substring(2, 15);
  return `nonexistent_${randomString}_${Date.now()}@${domain}`;
}

async function getMxRecords(domain: string): Promise<string[]> {
  try {
    const records = await resolveMx(domain);
    if (!records || records.length === 0) {
      return [];
    }
    records.sort((a, b) => a.priority - b.priority);
    return records.map(r => r.exchange);
  } catch (error: any) {
    console.log(`[EmailVerifier] MX lookup failed for ${domain}: ${error.message}`);
    return [];
  }
}

function parseSmtpResponse(data: string): { code: number; message: string } {
  const match = data.match(/^(\d{3})\s*(.*)/);
  if (match) {
    return { code: parseInt(match[1], 10), message: match[2] };
  }
  const multiLineMatch = data.match(/^(\d{3})-/);
  if (multiLineMatch) {
    return { code: parseInt(multiLineMatch[1], 10), message: data };
  }
  return { code: 0, message: data };
}

async function smtpCheck(
  mxHost: string, 
  email: string, 
  timeout: number = SMTP_TIMEOUT
): Promise<{ valid: boolean; status: 'valid' | 'invalid' | 'unknown' | 'timeout'; reason: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let step = 0;
    let buffer = '';
    let resolved = false;
    
    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        try {
          socket.destroy();
        } catch {}
      }
    };
    
    const finishWith = (result: { valid: boolean; status: 'valid' | 'invalid' | 'unknown' | 'timeout'; reason: string }) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(result);
      }
    };
    
    const timeoutId = setTimeout(() => {
      finishWith({ valid: false, status: 'timeout', reason: 'SMTP connection timed out' });
    }, timeout);
    
    socket.on('error', (err: any) => {
      clearTimeout(timeoutId);
      finishWith({ valid: false, status: 'unknown', reason: `Connection error: ${err.message}` });
    });
    
    socket.on('close', () => {
      clearTimeout(timeoutId);
      if (!resolved) {
        finishWith({ valid: false, status: 'unknown', reason: 'Connection closed unexpectedly' });
      }
    });
    
    socket.on('data', (data: Buffer) => {
      buffer += data.toString();
      
      if (!buffer.includes('\r\n') && !buffer.includes('\n')) {
        return;
      }
      
      const response = parseSmtpResponse(buffer.trim());
      buffer = '';
      
      try {
        switch (step) {
          case 0:
            if (response.code === 220) {
              step = 1;
              socket.write(`HELO emailchecker.local\r\n`);
            } else {
              finishWith({ valid: false, status: 'unknown', reason: `Server greeting failed: ${response.code}` });
            }
            break;
            
          case 1:
            if (response.code === 250) {
              step = 2;
              socket.write(`MAIL FROM:<${SENDER_EMAIL}>\r\n`);
            } else {
              finishWith({ valid: false, status: 'unknown', reason: `HELO rejected: ${response.code}` });
            }
            break;
            
          case 2:
            if (response.code === 250) {
              step = 3;
              socket.write(`RCPT TO:<${email}>\r\n`);
            } else {
              finishWith({ valid: false, status: 'unknown', reason: `MAIL FROM rejected: ${response.code}` });
            }
            break;
            
          case 3:
            clearTimeout(timeoutId);
            if (response.code === 250 || response.code === 251) {
              socket.write(`QUIT\r\n`);
              finishWith({ valid: true, status: 'valid', reason: 'Email accepted by server' });
            } else if (response.code === 550 || response.code === 551 || response.code === 552 || response.code === 553 || response.code === 554) {
              socket.write(`QUIT\r\n`);
              finishWith({ valid: false, status: 'invalid', reason: `Recipient rejected: ${response.message}` });
            } else if (response.code === 450 || response.code === 451 || response.code === 452) {
              socket.write(`QUIT\r\n`);
              finishWith({ valid: false, status: 'unknown', reason: `Temporary failure: ${response.message}` });
            } else if (response.code === 421) {
              finishWith({ valid: false, status: 'unknown', reason: 'Server busy, try again later' });
            } else {
              socket.write(`QUIT\r\n`);
              finishWith({ valid: false, status: 'unknown', reason: `Unexpected response: ${response.code} ${response.message}` });
            }
            break;
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        finishWith({ valid: false, status: 'unknown', reason: `Protocol error: ${err.message}` });
      }
    });
    
    try {
      socket.connect(25, mxHost);
    } catch (err: any) {
      clearTimeout(timeoutId);
      finishWith({ valid: false, status: 'unknown', reason: `Failed to connect: ${err.message}` });
    }
  });
}

export async function detectCatchAllDomain(domain: string): Promise<boolean> {
  const cached = catchAllCache.get(domain);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[EmailVerifier] Using cached catch-all result for ${domain}: ${cached.isCatchAll}`);
    return cached.isCatchAll;
  }
  
  console.log(`[EmailVerifier] Detecting catch-all for domain: ${domain}`);
  
  try {
    const mxRecords = await getMxRecords(domain);
    if (mxRecords.length === 0) {
      catchAllCache.set(domain, { isCatchAll: false, timestamp: Date.now() });
      return false;
    }
    
    const randomEmail = generateRandomEmail(domain);
    const result = await smtpCheck(mxRecords[0], randomEmail, SMTP_TIMEOUT);
    
    const isCatchAll = result.valid;
    catchAllCache.set(domain, { isCatchAll, timestamp: Date.now() });
    
    if (isCatchAll) {
      console.log(`[EmailVerifier] Domain ${domain} is catch-all (accepts random emails)`);
    }
    
    return isCatchAll;
  } catch (error: any) {
    console.log(`[EmailVerifier] Catch-all detection failed for ${domain}: ${error.message}`);
    catchAllCache.set(domain, { isCatchAll: false, timestamp: Date.now() });
    return false;
  }
}

export async function verifyEmailSMTP(email: string): Promise<EmailVerificationResult> {
  const emailLower = email.toLowerCase().trim();
  
  const cached = verificationCache.get(emailLower);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[EmailVerifier] Using cached result for ${emailLower}`);
    return cached.result;
  }
  
  console.log(`[EmailVerifier] Verifying email: ${emailLower}`);
  
  const parts = emailLower.split('@');
  if (parts.length !== 2) {
    const result: EmailVerificationResult = {
      email: emailLower,
      isValid: false,
      status: 'invalid',
      confidence: 0,
      reason: 'Invalid email format'
    };
    verificationCache.set(emailLower, { result, timestamp: Date.now() });
    return result;
  }
  
  const domain = parts[1];
  
  try {
    const mxRecords = await getMxRecords(domain);
    
    if (mxRecords.length === 0) {
      const result: EmailVerificationResult = {
        email: emailLower,
        isValid: false,
        status: 'invalid',
        confidence: 10,
        reason: 'No MX records found for domain'
      };
      verificationCache.set(emailLower, { result, timestamp: Date.now() });
      return result;
    }
    
    const isCatchAll = await detectCatchAllDomain(domain);
    
    if (isCatchAll) {
      const result: EmailVerificationResult = {
        email: emailLower,
        isValid: true,
        status: 'catch_all',
        confidence: 60,
        reason: 'Domain accepts all emails (catch-all configured)'
      };
      verificationCache.set(emailLower, { result, timestamp: Date.now() });
      return result;
    }
    
    let lastError = '';
    let hadTimeout = false;
    for (const mxHost of mxRecords.slice(0, 2)) {
      try {
        console.log(`[EmailVerifier] Trying MX host: ${mxHost}`);
        const smtpResult = await smtpCheck(mxHost, emailLower, SMTP_TIMEOUT);
        
        if (smtpResult.status === 'valid') {
          const result: EmailVerificationResult = {
            email: emailLower,
            isValid: true,
            status: 'valid',
            confidence: 95,
            reason: smtpResult.reason
          };
          verificationCache.set(emailLower, { result, timestamp: Date.now() });
          return result;
        } else if (smtpResult.status === 'invalid') {
          const result: EmailVerificationResult = {
            email: emailLower,
            isValid: false,
            status: 'invalid',
            confidence: 90,
            reason: smtpResult.reason
          };
          verificationCache.set(emailLower, { result, timestamp: Date.now() });
          return result;
        } else if (smtpResult.status === 'timeout') {
          lastError = smtpResult.reason;
          hadTimeout = true;
          continue; // Try next MX host
        } else {
          lastError = smtpResult.reason;
        }
      } catch (err: any) {
        lastError = err.message;
        console.log(`[EmailVerifier] MX ${mxHost} failed: ${err.message}`);
      }
    }
    
    // If all attempts timed out, keep with 'unknown' status (don't discard)
    // This ensures emails aren't lost just because SMTP verification failed
    const result: EmailVerificationResult = {
      email: emailLower,
      isValid: hadTimeout ? true : false, // Keep timed-out emails as potentially valid
      status: hadTimeout ? 'timeout' : (mxRecords.length > 0 ? 'unknown' : 'invalid'),
      confidence: hadTimeout ? 45 : 40,
      reason: hadTimeout ? 'SMTP verification timed out - email may still be valid' : (lastError || 'Could not verify email')
    };
    verificationCache.set(emailLower, { result, timestamp: Date.now() });
    return result;
    
  } catch (error: any) {
    console.log(`[EmailVerifier] Verification failed for ${emailLower}: ${error.message}`);
    const result: EmailVerificationResult = {
      email: emailLower,
      isValid: false,
      status: 'unknown',
      confidence: 30,
      reason: `Verification error: ${error.message}`
    };
    verificationCache.set(emailLower, { result, timestamp: Date.now() });
    return result;
  }
}

export async function batchVerifyEmails(emails: string[]): Promise<EmailVerificationResult[]> {
  if (emails.length === 0) {
    return [];
  }
  
  console.log(`[EmailVerifier] Batch verifying ${emails.length} emails`);
  
  const byDomain = new Map<string, string[]>();
  for (const email of emails) {
    const domain = email.split('@')[1]?.toLowerCase();
    if (domain) {
      if (!byDomain.has(domain)) {
        byDomain.set(domain, []);
      }
      byDomain.get(domain)!.push(email.toLowerCase());
    }
  }
  
  const results: EmailVerificationResult[] = [];
  const domainVerificationStatus = new Map<string, EmailVerificationResult>();
  
  for (const [domain, domainEmails] of byDomain) {
    const firstEmail = domainEmails[0];
    const firstResult = await verifyEmailSMTP(firstEmail);
    results.push(firstResult);
    domainVerificationStatus.set(domain, firstResult);
    
    for (const email of domainEmails.slice(1)) {
      if (firstResult.status === 'catch_all') {
        results.push({
          email,
          isValid: true,
          status: 'catch_all',
          confidence: 60,
          reason: 'Domain accepts all emails (catch-all configured)'
        });
      } else if (firstResult.status === 'timeout' || firstResult.status === 'unknown') {
        results.push({
          email,
          isValid: false,
          status: firstResult.status,
          confidence: firstResult.confidence,
          reason: `Domain verification inconclusive: ${firstResult.reason}`
        });
      } else {
        const individualResult = await verifyEmailSMTP(email);
        results.push(individualResult);
      }
    }
  }
  
  console.log(`[EmailVerifier] Batch verification complete: ${results.filter(r => r.isValid).length}/${results.length} valid`);
  
  return results;
}

export function clearVerificationCache(): void {
  verificationCache.clear();
  catchAllCache.clear();
  console.log('[EmailVerifier] Cache cleared');
}

export function getCacheStats(): { verificationCacheSize: number; catchAllCacheSize: number } {
  return {
    verificationCacheSize: verificationCache.size,
    catchAllCacheSize: catchAllCache.size
  };
}
