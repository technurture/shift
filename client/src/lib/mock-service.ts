// Simple mock function to simulate extraction
// In a real app, this would call a backend API that crawls the URL
export function mockExtractEmail(url: string): string[] {
  const domain = url.replace(/(^\w+:|^)\/\//, '').split('/')[0].replace('www.', '');
  
  // Deterministic mock results based on URL length/content
  if (url.includes("error") || url.includes("empty")) {
    return [];
  }

  const commonEmails = [
    `contact@${domain}`,
    `support@${domain}`,
    `info@${domain}`,
    `sales@${domain}`,
    `jobs@${domain}`
  ];

  // Randomly return 1-3 emails
  const count = Math.floor(Math.random() * 3) + 1;
  return commonEmails.slice(0, count);
}
