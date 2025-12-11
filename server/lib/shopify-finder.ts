import { ApifyClient } from 'apify-client';

const APIFY_TOKEN = process.env.APIFY_TOKEN;

interface ShopifyStore {
  id: string;
  title: string;
  description: string;
  url: string;
  emails: string[];
  country?: string;
  currency?: string;
  language?: string;
  productCount?: { min: number; max: number };
  createdDate?: string;
}

interface ShopifyFinderOptions {
  language?: string;
  currency?: string;
  publishedDate?: string;
  hasEmail?: boolean;
  hasPhone?: boolean;
  maxResults: number;
}

interface ShopifyFinderResult {
  success: boolean;
  stores: ShopifyStore[];
  error?: string;
  totalFound: number;
}

export async function findShopifyStores(options: ShopifyFinderOptions): Promise<ShopifyFinderResult> {
  if (!APIFY_TOKEN) {
    return {
      success: false,
      stores: [],
      error: 'Apify API token not configured',
      totalFound: 0,
    };
  }

  try {
    const client = new ApifyClient({
      token: APIFY_TOKEN,
    });

    const input: Record<string, any> = {
      max_results: options.maxResults,
      has_email: options.hasEmail ?? true,
    };

    if (options.language) {
      input.language = options.language;
    }
    if (options.currency) {
      input.currency = options.currency;
    }
    if (options.publishedDate) {
      input.published_date = options.publishedDate;
    }
    if (options.hasPhone !== undefined) {
      input.has_phone = options.hasPhone;
    }

    console.log('[ShopifyFinder] Starting Apify actor with input:', JSON.stringify(input));

    const run = await client.actor('xmiso_scrapers/shopify-shops-email-leads-scraper').call(input);

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`[ShopifyFinder] Found ${items.length} Shopify stores`);

    const stores: ShopifyStore[] = items.map((item: any) => ({
      id: item.id || item.shop_id || item.domain || '',
      title: item.title || item.name || item.shop_name || '',
      description: item.description || item.info || '',
      url: item.url || item.shop_url || (item.domain ? `https://${item.domain}` : ''),
      emails: Array.isArray(item.emails) ? item.emails : (item.email ? [item.email] : []),
      country: item.country || item.country_code || '',
      currency: item.currency || item.currency_code || '',
      language: item.language || item.locale || '',
      productCount: item.product_count ? { min: item.product_count, max: item.product_count } : undefined,
      createdDate: item.created_at || item.published_date || item.minPageDate || '',
    }));

    return {
      success: true,
      stores,
      totalFound: stores.length,
    };
  } catch (error: any) {
    console.error('[ShopifyFinder] Error:', error.message);
    return {
      success: false,
      stores: [],
      error: error.message || 'Failed to fetch Shopify stores',
      totalFound: 0,
    };
  }
}

export const SHOPIFY_PLAN_LIMITS = {
  free: 0,
  basic: 100,
  premium: 1000,
};
