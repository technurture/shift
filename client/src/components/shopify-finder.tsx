import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Store,
  Search,
  Copy,
  Download,
  Loader2,
  Crown,
  Mail,
  Globe,
  ExternalLink,
  AlertCircle,
  Trash2,
  History,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { api, type ShopifyStore, type ShopifyUsage, type ShopifySearch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const LANGUAGES = [
  { value: "", label: "Any Language" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "nl", label: "Dutch" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
  { value: "ko", label: "Korean" },
  { value: "ar", label: "Arabic" },
  { value: "ru", label: "Russian" },
];

const CURRENCIES = [
  { value: "", label: "Any Currency" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "CAD", label: "CAD - Canadian Dollar" },
  { value: "AUD", label: "AUD - Australian Dollar" },
  { value: "JPY", label: "JPY - Japanese Yen" },
  { value: "CNY", label: "CNY - Chinese Yuan" },
  { value: "INR", label: "INR - Indian Rupee" },
  { value: "BRL", label: "BRL - Brazilian Real" },
  { value: "MXN", label: "MXN - Mexican Peso" },
  { value: "NGN", label: "NGN - Nigerian Naira" },
];

const ITEMS_PER_PAGE = 10;

interface ShopifyFinderProps {
  onUpgrade: () => void;
}

export function ShopifyFinder({ onUpgrade }: ShopifyFinderProps) {
  const [language, setLanguage] = useState("");
  const [currency, setCurrency] = useState("");
  const [maxResults, setMaxResults] = useState("10");
  const [stores, setStores] = useState<ShopifyStore[]>([]);
  const [activeTab, setActiveTab] = useState<"search" | "history">("search");
  const [historyPage, setHistoryPage] = useState(1);
  const [resultsPage, setResultsPage] = useState(1);
  const [expandedSearchId, setExpandedSearchId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: usage, isLoading: usageLoading } = useQuery<ShopifyUsage>({
    queryKey: ["shopify-usage"],
    queryFn: () => api.getShopifyUsage(),
    retry: false,
  });

  const { data: searchHistory = [], isLoading: historyLoading } = useQuery<ShopifySearch[]>({
    queryKey: ["shopify-searches"],
    queryFn: () => api.getShopifySearches(),
    retry: false,
  });

  const findMutation = useMutation({
    mutationFn: (params: { language?: string; currency?: string; maxResults: number }) =>
      api.findShopifyStores(params),
    onSuccess: (data) => {
      setStores(data.stores);
      setResultsPage(1);
      queryClient.invalidateQueries({ queryKey: ["shopify-usage"] });
      queryClient.invalidateQueries({ queryKey: ["shopify-searches"] });
      toast({
        title: "Success!",
        description: `Found ${data.totalFound} Shopify store(s).`,
      });
    },
    onError: (error: any) => {
      if (error.message?.includes("upgrade") || error.message?.includes("Basic")) {
        toast({
          title: "Upgrade Required",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Search failed",
          description: error.message || "Something went wrong.",
          variant: "destructive",
        });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteShopifySearch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopify-searches"] });
      toast({ description: "Search deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete", variant: "destructive" });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const results = parseInt(maxResults) || 10;
    findMutation.mutate({
      language: language || undefined,
      currency: currency || undefined,
      maxResults: Math.min(Math.max(1, results), 100),
    });
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: `${label} copied to clipboard` });
  };

  const handleCopyAllEmails = () => {
    const allEmails = stores.flatMap((s) => s.emails).filter(Boolean);
    if (allEmails.length === 0) {
      toast({ description: "No emails to copy", variant: "destructive" });
      return;
    }
    navigator.clipboard.writeText(allEmails.join("\n"));
    toast({ description: `Copied ${allEmails.length} email(s) to clipboard` });
  };

  const handleExportCSV = () => {
    if (stores.length === 0) {
      toast({ description: "No data to export", variant: "destructive" });
      return;
    }

    const csvContent = [
      ["Store Name", "URL", "Emails", "Country", "Currency"].join(","),
      ...stores.map((s) =>
        [
          `"${s.title || ""}"`,
          `"${s.url || ""}"`,
          `"${s.emails.join("; ")}"`,
          `"${s.country || ""}"`,
          `"${s.currency || ""}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shopify-stores-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast({ description: `Exported ${stores.length} store(s) to CSV` });
  };

  const isFreeUser = usage?.plan === "free";
  const usagePercent = usage ? Math.min((usage.usedToday / usage.dailyLimit) * 100, 100) : 0;

  const paginatedStores = stores.slice((resultsPage - 1) * ITEMS_PER_PAGE, resultsPage * ITEMS_PER_PAGE);
  const totalResultsPages = Math.ceil(stores.length / ITEMS_PER_PAGE) || 1;

  const paginatedHistory = searchHistory.slice((historyPage - 1) * ITEMS_PER_PAGE, historyPage * ITEMS_PER_PAGE);
  const totalHistoryPages = Math.ceil(searchHistory.length / ITEMS_PER_PAGE) || 1;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getFiltersDisplay = (filters: ShopifySearch["filters"]) => {
    const parts: string[] = [];
    if (filters.language) {
      const lang = LANGUAGES.find((l) => l.value === filters.language);
      parts.push(lang?.label || filters.language);
    }
    if (filters.currency) {
      parts.push(filters.currency);
    }
    parts.push(`Max: ${filters.maxResults}`);
    return parts.join(" | ");
  };

  if (isFreeUser) {
    return (
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center gap-4 py-8">
            <div className="p-4 rounded-full bg-amber-100 dark:bg-amber-900/30">
              <Crown className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Premium Feature</h3>
              <p className="text-muted-foreground max-w-md">
                The Shopify Store Finder is available exclusively for Basic and Premium plan users.
                Upgrade your plan to discover Shopify stores with contact information.
              </p>
            </div>
            <Button onClick={onUpgrade} className="mt-2" data-testid="button-upgrade-shopify">
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to Access
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5" />
            Find Shopify Stores
          </CardTitle>
          {usage && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium" data-testid="text-shopify-usage">
                  {usage.usedToday} / {usage.dailyLimit} stores today
                </p>
                <p className="text-xs text-muted-foreground">
                  {usage.remaining} remaining
                </p>
              </div>
              <div className="w-20">
                <Progress value={usagePercent} className="h-2" />
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[150px]">
              <label className="text-sm font-medium mb-1.5 block">Language</label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger data-testid="select-language">
                  <SelectValue placeholder="Any Language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value || "any"}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="text-sm font-medium mb-1.5 block">Currency</label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger data-testid="select-currency">
                  <SelectValue placeholder="Any Currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((cur) => (
                    <SelectItem key={cur.value} value={cur.value || "any"}>
                      {cur.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-32">
              <label className="text-sm font-medium mb-1.5 block">Max Results</label>
              <Input
                type="number"
                min="1"
                max="100"
                value={maxResults}
                onChange={(e) => setMaxResults(e.target.value)}
                placeholder="10"
                data-testid="input-max-results"
              />
            </div>

            <Button
              type="submit"
              disabled={findMutation.isPending || (usage?.remaining ?? 0) <= 0}
              data-testid="button-find-stores"
            >
              {findMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Find Shopify Stores
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeTab === "search" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("search")}
          data-testid="tab-new-search"
        >
          <Search className="w-4 h-4 mr-2" />
          New Search
        </Button>
        <Button
          variant={activeTab === "history" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("history")}
          data-testid="tab-search-history"
        >
          <History className="w-4 h-4 mr-2" />
          Search History
          {searchHistory.length > 0 && (
            <Badge variant="secondary" className="ml-2" data-testid="badge-history-count">
              {searchHistory.length}
            </Badge>
          )}
        </Button>
      </div>

      {activeTab === "search" && (
        <>
          {stores.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
                <CardTitle className="text-base">
                  Results ({stores.length} stores found)
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyAllEmails}
                    data-testid="button-copy-all-emails"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Copy All Emails
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCSV}
                    data-testid="button-export-csv"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="rounded-md border-x-0 border-t overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Store</TableHead>
                        <TableHead className="min-w-[200px]">URL</TableHead>
                        <TableHead className="min-w-[200px]">Emails</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedStores.map((store, idx) => (
                        <TableRow key={store.id || idx} data-testid={`row-store-${idx}`}>
                          <TableCell>
                            <div className="font-medium">{store.title || "Unnamed Store"}</div>
                            {store.currency && (
                              <Badge variant="secondary" className="mt-1 text-xs">
                                {store.currency}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <a
                                href={store.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline truncate max-w-[180px]"
                                data-testid={`link-store-url-${idx}`}
                              >
                                {store.url.replace(/^https?:\/\//, "")}
                              </a>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleCopy(store.url, "URL")}
                                    data-testid={`button-copy-url-${idx}`}
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copy URL</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                          <TableCell>
                            {store.emails.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {store.emails.slice(0, 2).map((email, i) => (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className="cursor-pointer"
                                    onClick={() => handleCopy(email, "Email")}
                                    data-testid={`badge-email-${idx}-${i}`}
                                  >
                                    <Mail className="w-3 h-3 mr-1" />
                                    {email}
                                  </Badge>
                                ))}
                                {store.emails.length > 2 && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="secondary"
                                        className="cursor-pointer"
                                        onClick={() =>
                                          handleCopy(store.emails.join("\n"), "All emails")
                                        }
                                      >
                                        +{store.emails.length - 2} more
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="text-xs">
                                        {store.emails.slice(2).join(", ")}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">No emails</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {store.country ? (
                              <div className="flex items-center gap-1">
                                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                                {store.country}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => window.open(store.url, "_blank")}
                                  data-testid={`button-visit-store-${idx}`}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Visit Store</TooltipContent>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {stores.length > ITEMS_PER_PAGE && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <span className="text-sm text-muted-foreground" data-testid="text-results-pagination">
                      Page {resultsPage} of {totalResultsPages} ({stores.length} items)
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resultsPage === 1}
                        onClick={() => setResultsPage((p) => p - 1)}
                        data-testid="button-results-prev"
                      >
                        <ChevronLeft className="w-4 h-4" /> Prev
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resultsPage === totalResultsPages}
                        onClick={() => setResultsPage((p) => p + 1)}
                        data-testid="button-results-next"
                      >
                        Next <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {stores.length === 0 && !findMutation.isPending && (
            <div className="text-center py-12 text-muted-foreground">
              <Store className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Search for Shopify stores to see results here</p>
            </div>
          )}
        </>
      )}

      {activeTab === "history" && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-5 h-5" />
              Search History ({searchHistory.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : searchHistory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>No search history yet</p>
              </div>
            ) : (
              <>
                <div className="divide-y">
                  {paginatedHistory.map((search) => (
                    <div key={search.id} className="p-4" data-testid={`history-item-${search.id}`}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium" data-testid={`text-history-date-${search.id}`}>
                              {formatDate(search.searchedAt)}
                            </span>
                            <Badge variant="secondary" data-testid={`badge-stores-count-${search.id}`}>
                              {search.totalFound} stores
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1" data-testid={`text-history-filters-${search.id}`}>
                            {getFiltersDisplay(search.filters)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setExpandedSearchId(expandedSearchId === search.id ? null : search.id)
                            }
                            data-testid={`button-expand-${search.id}`}
                          >
                            {expandedSearchId === search.id ? (
                              <>
                                <ChevronUp className="w-4 h-4 mr-1" />
                                Hide
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4 mr-1" />
                                View Stores
                              </>
                            )}
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteMutation.mutate(search.id)}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-search-${search.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete Search</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>

                      {expandedSearchId === search.id && search.stores.length > 0 && (
                        <div className="mt-4 rounded-md border overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="min-w-[200px]">Store</TableHead>
                                <TableHead className="min-w-[200px]">URL</TableHead>
                                <TableHead className="min-w-[200px]">Emails</TableHead>
                                <TableHead>Country</TableHead>
                                <TableHead className="w-[100px]">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {search.stores.map((store, idx) => (
                                <TableRow key={store.id || idx} data-testid={`row-history-store-${search.id}-${idx}`}>
                                  <TableCell>
                                    <div className="font-medium">{store.title || "Unnamed Store"}</div>
                                    {store.currency && (
                                      <Badge variant="secondary" className="mt-1 text-xs">
                                        {store.currency}
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <a
                                        href={store.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline truncate max-w-[180px]"
                                        data-testid={`link-history-store-url-${search.id}-${idx}`}
                                      >
                                        {store.url.replace(/^https?:\/\//, "")}
                                      </a>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => handleCopy(store.url, "URL")}
                                            data-testid={`button-history-copy-url-${search.id}-${idx}`}
                                          >
                                            <Copy className="w-3.5 h-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Copy URL</TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {store.emails.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {store.emails.slice(0, 2).map((email, i) => (
                                          <Badge
                                            key={i}
                                            variant="outline"
                                            className="cursor-pointer"
                                            onClick={() => handleCopy(email, "Email")}
                                            data-testid={`badge-history-email-${search.id}-${idx}-${i}`}
                                          >
                                            <Mail className="w-3 h-3 mr-1" />
                                            {email}
                                          </Badge>
                                        ))}
                                        {store.emails.length > 2 && (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Badge
                                                variant="secondary"
                                                className="cursor-pointer"
                                                onClick={() =>
                                                  handleCopy(store.emails.join("\n"), "All emails")
                                                }
                                              >
                                                +{store.emails.length - 2} more
                                              </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <div className="text-xs">
                                                {store.emails.slice(2).join(", ")}
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground text-sm">No emails</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {store.country ? (
                                      <div className="flex items-center gap-1">
                                        <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                                        {store.country}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => window.open(store.url, "_blank")}
                                          data-testid={`button-history-visit-store-${search.id}-${idx}`}
                                        >
                                          <ExternalLink className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Visit Store</TooltipContent>
                                    </Tooltip>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {searchHistory.length > ITEMS_PER_PAGE && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <span className="text-sm text-muted-foreground" data-testid="text-history-pagination">
                      Page {historyPage} of {totalHistoryPages} ({searchHistory.length} items)
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={historyPage === 1}
                        onClick={() => setHistoryPage((p) => p - 1)}
                        data-testid="button-history-prev"
                      >
                        <ChevronLeft className="w-4 h-4" /> Prev
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={historyPage === totalHistoryPages}
                        onClick={() => setHistoryPage((p) => p + 1)}
                        data-testid="button-history-next"
                      >
                        Next <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
