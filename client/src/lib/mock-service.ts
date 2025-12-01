// Simple mock function to simulate extraction
// In a real app, this would call a backend API that crawls the URL
export function mockExtractEmail(url: string): string[] {
  // Handle empty or invalid URLs gracefully
  if (!url || url.includes("error") || url.includes("empty")) {
    return [];
  }

  let domain = "example.com";
  try {
    // Try to extract domain, fallback to example.com if it fails
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    domain = urlObj.hostname.replace('www.', '');
  } catch (e) {
    // If URL parsing fails, just use the input string or a fallback
    domain = url.replace(/(^\w+:|^)\/\//, '').split('/')[0].replace('www.', '') || "example.com";
  }

  const commonRoles = ['contact', 'support', 'sales', 'info', 'hello', 'jobs', 'media', 'press'];
  const firstNames = ['john', 'sarah', 'michael', 'emma', 'david', 'lisa', 'james', 'olivia'];
  const lastNames = ['smith', 'doe', 'wilson', 'brown', 'taylor', 'anderson'];

  // Generate a realistic set of emails
  const emails: string[] = [];
  
  // Always add 1-2 role-based emails
  const numRoles = Math.floor(Math.random() * 2) + 1;
  for (let i = 0; i < numRoles; i++) {
    const role = commonRoles[Math.floor(Math.random() * commonRoles.length)];
    emails.push(`${role}@${domain}`);
  }

  // Add 2-5 personal emails to make it look like a "deep scan"
  const numPersonal = Math.floor(Math.random() * 4) + 2;
  for (let i = 0; i < numPersonal; i++) {
    const first = firstNames[Math.floor(Math.random() * firstNames.length)];
    const last = lastNames[Math.floor(Math.random() * lastNames.length)];
    
    // Mix formats: first.last, first_last, first
    const format = Math.random();
    if (format < 0.4) {
      emails.push(`${first}.${last}@${domain}`);
    } else if (format < 0.7) {
      emails.push(`${first}@${domain}`);
    } else {
      emails.push(`${first}_${last}@${domain}`);
    }
  }

  // Remove duplicates and return
  return [...new Set(emails)];
}
