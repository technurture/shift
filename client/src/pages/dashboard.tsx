import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Search, 
  Download, 
  Loader2, 
  Copy,
  Mail,
  Trash2,
  CheckCircle2,
  XCircle,
  Filter,
  Calendar as CalendarIcon,
  Globe,
  ChevronDown,
  ChevronUp,
  FileText,
  Sparkles,
  X,
  ArrowUpDown,
  Info,
  Link2,
  BarChart3,
  Crown,
} from "lucide-react";
import { api, type Extraction, type Stats } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { UpgradeDialog, LimitReachedBanner } from "@/components/upgrade-dialog";

export default function Dashboard() {
  const [inputMode, setInputMode] = useState<"single" | "batch">("batch");
  const [singleUrl, setSingleUrl] = useState("");
  const [batchUrls, setBatchUrls] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "emails-desc" | "emails-asc">("date-desc");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: () => api.getStats(),
    retry: false,
  });

  const { data: extractions = [], isLoading: extractionsLoading } = useQuery<Extraction[]>({
    queryKey: ["extractions"],
    queryFn: () => api.getExtractions(),
    retry: false,
  });

  useEffect(() => {
    api.getCurrentUser().catch(() => {
      setLocation("/auth?mode=login");
    });
  }, [setLocation]);

  const extractMutation = useMutation({
    mutationFn: (url: string) => api.extractEmails(url),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["extractions"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      
      if (data.emailsFound > 0) {
        toast({
          title: "Success!",
          description: `Found ${data.emailsFound} email(s).`,
        });
      } else {
        toast({
          title: "No emails found",
          description: "We couldn't find any valid email addresses on this page.",
          variant: "destructive",
        });
      }
      setSingleUrl("");
    },
    onError: (error: any) => {
      toast({
        title: "Extraction failed",
        description: error.message || "Something went wrong while scanning.",
        variant: "destructive",
      });
    },
  });

  const batchExtractMutation = useMutation({
    mutationFn: (urls: string[]) => api.extractEmailsBatch(urls),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["extractions"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      
      const successCount = data.results.filter(r => r.success).length;
      toast({
        title: "Batch extraction complete",
        description: `Processed ${data.processed} URLs. Found ${data.totalEmailsFound} emails from ${successCount} successful scans.`,
      });
      setBatchUrls("");
    },
    onError: (error: any) => {
      toast({
        title: "Batch extraction failed",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteExtraction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["extractions"] });
      toast({ description: "Extraction deleted" });
    },
    onError: () => {
      toast({ 
        title: "Delete failed",
        description: "Could not delete extraction",
        variant: "destructive" 
      });
    },
  });

  const parsedUrls = useMemo(() => {
    if (!batchUrls.trim()) return { valid: [], invalid: [] };
    
    const lines = batchUrls.split('\n').map(url => url.trim()).filter(url => url.length > 0);
    const valid: string[] = [];
    const invalid: string[] = [];
    
    lines.forEach(line => {
      if (line.startsWith('http://') || line.startsWith('https://') || 
          (line.includes('.') && !line.includes(' '))) {
        valid.push(line);
      } else {
        invalid.push(line);
      }
    });
    
    return { valid, invalid };
  }, [batchUrls]);

  const handleSingleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleUrl) return;
    extractMutation.mutate(singleUrl);
  };

  const handleBatchExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedUrls.valid.length === 0) {
      toast({
        title: "No valid URLs",
        description: "Please enter at least one valid URL.",
        variant: "destructive",
      });
      return;
    }
    
    if (parsedUrls.valid.length > 10) {
      toast({
        title: "Too many URLs",
        description: "Maximum 10 URLs per batch. Processing first 10.",
      });
    }
    
    batchExtractMutation.mutate(parsedUrls.valid.slice(0, 10));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: "Copied to clipboard" });
  };

  const handleCopyAllEmails = (emails: string[]) => {
    navigator.clipboard.writeText(emails.join('\n'));
    toast({ description: `Copied ${emails.length} email(s) to clipboard` });
  };

  const handleExportCSV = () => {
    const dataToExport = selectedRows.size > 0 
      ? filteredExtractions.filter(e => selectedRows.has(e.id))
      : filteredExtractions;
      
    if (dataToExport.length === 0) {
      toast({ description: "No data to export", variant: "destructive" });
      return;
    }
    
    const csvContent = [
      ["URL", "Status", "Emails", "Date"].join(","),
      ...dataToExport.map(e => [
        `"${e.url}"`,
        e.status,
        `"${e.emails.join('; ')}"`,
        new Date(e.scannedAt).toLocaleDateString()
      ].join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mailsift-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast({ description: `Exported ${dataToExport.length} record(s) to CSV` });
  };

  const handleBulkDelete = () => {
    if (selectedRows.size === 0) return;
    
    selectedRows.forEach(id => {
      deleteMutation.mutate(id);
    });
    setSelectedRows(new Set());
    toast({ description: `Deleted ${selectedRows.size} record(s)` });
  };

  const toggleRowExpanded = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const toggleRowSelected = (id: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === filteredExtractions.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredExtractions.map(e => e.id)));
    }
  };

  const filteredExtractions = useMemo(() => {
    let filtered = extractions.filter(extraction => {
      const matchesSearch = searchQuery === "" || 
        extraction.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
        extraction.emails.some(email => email.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = statusFilter === "all" || extraction.status === statusFilter;
      
      const scannedDate = new Date(extraction.scannedAt);
      const matchesDateFrom = !dateRange.from || scannedDate >= dateRange.from;
      const matchesDateTo = !dateRange.to || scannedDate <= new Date(dateRange.to.getTime() + 86400000);
      
      return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime();
        case "date-asc":
          return new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime();
        case "emails-desc":
          return b.emails.length - a.emails.length;
        case "emails-asc":
          return a.emails.length - b.emails.length;
        default:
          return 0;
      }
    });

    return filtered;
  }, [extractions, searchQuery, statusFilter, dateRange, sortBy]);

  const totalEmails = useMemo(() => {
    return filteredExtractions.reduce((sum, e) => sum + e.emails.length, 0);
  }, [filteredExtractions]);

  const successCount = useMemo(() => {
    return filteredExtractions.filter(e => e.status === "success").length;
  }, [filteredExtractions]);

  const hasActiveFilters = searchQuery || statusFilter !== "all" || dateRange.from || dateRange.to;

  const clearAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setDateRange({ from: undefined, to: undefined });
    setSortBy("date-desc");
  };

  const planLimit = stats ? (stats.plan === "free" ? 500 : stats.plan === "basic" ? 1000 : Infinity) : 500;
  const linksLimit = stats ? (stats.plan === "free" ? 500 : stats.plan === "basic" ? 1000 : Infinity) : 500;
  const isProcessing = extractMutation.isPending || batchExtractMutation.isPending;
  const isLimitReached = stats && (
    (planLimit !== Infinity && stats.emailsExtracted >= planLimit) ||
    (linksLimit !== Infinity && stats.linksScanned >= linksLimit)
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 pt-20 sm:pt-24 pb-8 sm:pb-12 max-w-full overflow-x-hidden">
        {stats && (
          <LimitReachedBanner
            onUpgrade={() => setUpgradeDialogOpen(true)}
            emailsUsed={stats.emailsExtracted}
            emailsLimit={planLimit}
            linksUsed={stats.linksScanned}
            linksLimit={linksLimit}
          />
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="lg:col-span-3 border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-lg sm:text-xl font-heading flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Extract Emails
                </CardTitle>
                <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "single" | "batch")} className="w-full sm:w-auto">
                  <TabsList className="grid w-full sm:w-auto grid-cols-2 min-h-[44px]">
                    <TabsTrigger value="single" className="text-xs sm:text-sm min-h-[40px]" data-testid="tab-single">
                      Single URL
                    </TabsTrigger>
                    <TabsTrigger value="batch" className="text-xs sm:text-sm min-h-[40px]" data-testid="tab-batch">
                      Batch (up to 10)
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {inputMode === "single" ? (
                <form onSubmit={handleSingleExtract} className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Enter website URL (e.g., www.company.com)" 
                      className="pl-10 bg-background/50 border-border/50 min-h-[44px] sm:min-h-[48px] text-sm sm:text-base"
                      value={singleUrl}
                      onChange={(e) => setSingleUrl(e.target.value)}
                      disabled={isProcessing}
                      data-testid="input-url"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    size="lg" 
                    className="min-h-[44px] sm:min-h-[48px] px-6 sm:px-8 bg-primary hover:bg-primary/90 text-white font-medium w-full sm:w-auto"
                    disabled={isProcessing || isLimitReached}
                    data-testid="button-extract"
                  >
                    {extractMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scanning...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" /> Extract
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleBatchExtract} className="space-y-4">
                  <div className="relative">
                    <Textarea
                      placeholder="Paste multiple URLs (one per line)&#10;&#10;Example:&#10;https://company1.com&#10;https://company2.com&#10;https://company3.com"
                      className="min-h-[140px] sm:min-h-[160px] bg-background/50 border-border/50 text-sm resize-y pr-10"
                      value={batchUrls}
                      onChange={(e) => setBatchUrls(e.target.value)}
                      disabled={isProcessing}
                      data-testid="input-batch-urls"
                    />
                    {batchUrls && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground"
                        onClick={() => setBatchUrls("")}
                        data-testid="button-clear-urls"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={parsedUrls.valid.length > 0 ? "default" : "secondary"} 
                          className={`${parsedUrls.valid.length > 0 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : ""}`}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {parsedUrls.valid.length} valid URL{parsedUrls.valid.length !== 1 ? 's' : ''}
                        </Badge>
                        {parsedUrls.invalid.length > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20 cursor-help">
                                <Info className="w-3 h-3 mr-1" />
                                {parsedUrls.invalid.length} invalid
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs">
                              <p className="text-xs">Invalid entries will be skipped. Make sure URLs start with http:// or https:// or contain a domain.</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">(max 10 per batch)</span>
                    </div>
                    
                    {parsedUrls.valid.length > 0 && (
                      <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                          <Link2 className="w-3 h-3" />
                          Preview of URLs to process:
                        </p>
                        {parsedUrls.valid.slice(0, 5).map((url, idx) => (
                          <div key={idx} className="text-xs text-foreground/80 truncate flex items-center gap-2">
                            <span className="text-muted-foreground w-4">{idx + 1}.</span>
                            <span className="truncate">{url}</span>
                          </div>
                        ))}
                        {parsedUrls.valid.length > 5 && (
                          <p className="text-xs text-muted-foreground mt-2">...and {parsedUrls.valid.length - 5} more</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Tip: Paste URLs from a spreadsheet or text file, one per line
                    </p>
                    <Button 
                      type="submit" 
                      size="lg" 
                      className="min-h-[44px] sm:min-h-[48px] px-6 sm:px-8 bg-primary hover:bg-primary/90 text-white font-medium w-full sm:w-auto"
                      disabled={isProcessing || parsedUrls.valid.length === 0 || isLimitReached}
                      data-testid="button-batch-extract"
                    >
                      {batchExtractMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" /> Extract All
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Plan Usage</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex items-center justify-center h-16">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-emails-extracted">
                      {stats?.emailsExtracted || 0}
                    </span>
                    <span className="text-xs sm:text-sm text-muted-foreground">/ {planLimit === Infinity ? 'Unlimited' : planLimit}</span>
                  </div>
                  <Progress value={planLimit === Infinity ? 0 : ((stats?.emailsExtracted || 0) / planLimit) * 100} className="h-2 mb-3" />
                  <div className="flex justify-between items-center">
                    <Badge variant="outline" className="border-border/50 text-muted-foreground capitalize text-xs">
                      {stats?.plan || "Free"} Plan
                    </Badge>
                    <Button 
                      variant="link" 
                      className="text-primary p-0 h-auto text-xs min-h-[44px]" 
                      onClick={() => setUpgradeDialogOpen(true)}
                      data-testid="button-upgrade"
                    >
                      <Crown className="w-3 h-3 mr-1" />
                      Upgrade
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-lg sm:text-xl font-heading">Extraction History</CardTitle>
                <div className="flex flex-wrap gap-2">
                  {selectedRows.size > 0 && (
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="min-h-[44px]"
                      onClick={handleBulkDelete}
                      data-testid="button-bulk-delete"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedRows.size})
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-border/50 min-h-[44px]"
                    onClick={handleExportCSV}
                    disabled={filteredExtractions.length === 0}
                    data-testid="button-export"
                  >
                    <Download className="mr-2 h-4 w-4" /> 
                    Export {selectedRows.size > 0 ? `(${selectedRows.size})` : 'CSV'}
                  </Button>
                </div>
              </div>
              
              {extractions.length > 0 && (
                <div className="flex flex-wrap gap-3 p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Quick Stats:</span>
                  </div>
                  <Badge variant="secondary" className="text-xs" data-testid="badge-total-scans">
                    {filteredExtractions.length} scans
                  </Badge>
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs" data-testid="badge-successful">
                    {successCount} successful
                  </Badge>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs" data-testid="badge-emails-found">
                    {totalEmails} emails found
                  </Badge>
                </div>
              )}
              
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search URLs or emails..." 
                      className="pl-10 bg-background/50 border-border/50 min-h-[44px] text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-search"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                      <SelectTrigger className="w-full sm:w-[140px] min-h-[44px] bg-background/50 border-border/50" data-testid="select-filter">
                        <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="failed">No Data</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="outline" 
                          className={`w-full sm:w-auto min-h-[44px] bg-background/50 border-border/50 ${dateRange.from ? "text-foreground" : "text-muted-foreground"}`}
                          data-testid="button-date-filter"
                        >
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {dateRange.from ? (
                            dateRange.to ? (
                              <span className="text-xs sm:text-sm">
                                {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d")}
                              </span>
                            ) : (
                              format(dateRange.from, "MMM d, yyyy")
                            )
                          ) : (
                            "Date Range"
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          selected={{ from: dateRange.from, to: dateRange.to }}
                          onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                          initialFocus
                        />
                        {(dateRange.from || dateRange.to) && (
                          <div className="p-2 border-t">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full min-h-[44px]"
                              onClick={() => setDateRange({ from: undefined, to: undefined })}
                            >
                              Clear dates
                            </Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                    
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                      <SelectTrigger className="w-full sm:w-[160px] min-h-[44px] bg-background/50 border-border/50" data-testid="select-sort">
                        <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date-desc">Newest First</SelectItem>
                        <SelectItem value="date-asc">Oldest First</SelectItem>
                        <SelectItem value="emails-desc">Most Emails</SelectItem>
                        <SelectItem value="emails-asc">Least Emails</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>Showing {filteredExtractions.length} of {extractions.length} results</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="min-h-[44px] px-2 text-xs"
                    onClick={clearAllFilters}
                    data-testid="button-clear-filters"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear all filters
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            {extractionsLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredExtractions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground px-4">
                <FileText className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-center">
                  {extractions.length === 0 
                    ? "No extractions yet. Start by entering a URL above!" 
                    : "No results match your filters."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {filteredExtractions.length > 0 && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-muted/20">
                    <Checkbox 
                      checked={selectedRows.size === filteredExtractions.length && filteredExtractions.length > 0}
                      onCheckedChange={toggleSelectAll}
                      className="min-h-[20px] min-w-[20px]"
                      data-testid="checkbox-select-all"
                    />
                    <span className="text-sm text-muted-foreground">
                      {selectedRows.size > 0 
                        ? `${selectedRows.size} of ${filteredExtractions.length} selected`
                        : "Select all"
                      }
                    </span>
                  </div>
                )}
                {filteredExtractions.map((result) => {
                  const isExpanded = expandedRows.has(result.id);
                  const isSelected = selectedRows.has(result.id);
                  const hasEmails = result.emails.length > 0;
                  
                  return (
                    <div key={result.id} className={`group ${isSelected ? "bg-primary/5" : ""}`}>
                      <div 
                        className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 hover:bg-muted/30 transition-colors"
                        data-testid={`row-extraction-${result.id}`}
                      >
                        <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={() => toggleRowSelected(result.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 sm:mt-0 min-h-[20px] min-w-[20px]"
                            data-testid={`checkbox-row-${result.id}`}
                          />
                          <div 
                            className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center text-xs font-bold shrink-0 cursor-pointer"
                            onClick={() => hasEmails && toggleRowExpanded(result.id)}
                          >
                            {result.url.replace('https://', '').replace('http://', '').substring(0, 2).toUpperCase()}
                          </div>
                          <div 
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => hasEmails && toggleRowExpanded(result.id)}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-foreground truncate text-sm sm:text-base max-w-[180px] sm:max-w-[400px]">
                                {result.url.replace('https://', '').replace('http://', '')}
                              </span>
                              {result.status === 'success' ? (
                                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs shrink-0">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  {result.emails.length} email{result.emails.length !== 1 ? 's' : ''}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs shrink-0">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  No Data
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <CalendarIcon className="w-3 h-3" />
                              <span>{new Date(result.scannedAt).toLocaleDateString()} at {new Date(result.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 ml-auto pl-8 sm:pl-0">
                          {hasEmails && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="min-h-[44px] px-3 text-xs"
                              onClick={(e) => { e.stopPropagation(); handleCopyAllEmails(result.emails); }}
                              data-testid={`button-copy-all-${result.id}`}
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              <span className="hidden sm:inline">Copy All</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(result.id); }}
                            data-testid={`button-delete-${result.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          {hasEmails && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="min-h-[44px] min-w-[44px]"
                              onClick={() => toggleRowExpanded(result.id)}
                              data-testid={`button-expand-${result.id}`}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {isExpanded && hasEmails && (
                        <div className="px-4 pb-4 pt-0 sm:pl-[76px]">
                          <div className="bg-muted/30 rounded-lg p-3 sm:p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {result.emails.map((email, idx) => (
                                <div 
                                  key={`${email}-${idx}`}
                                  className="flex items-center gap-2 p-3 rounded-md bg-background/50 hover:bg-background transition-colors cursor-pointer group/email min-h-[44px]"
                                  onClick={() => handleCopy(email)}
                                  data-testid={`email-${result.id}-${idx}`}
                                >
                                  <Mail className="w-4 h-4 text-primary shrink-0" />
                                  <span className="text-sm truncate flex-1">{email}</span>
                                  <Copy className="w-3 h-3 opacity-0 group-hover/email:opacity-100 transition-opacity text-muted-foreground shrink-0" />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      
      <UpgradeDialog
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        currentPlan={stats?.plan || "free"}
      />
    </div>
  );
}
