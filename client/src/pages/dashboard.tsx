import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  Download, 
  Loader2, 
  Copy,
  Mail,
  Link as LinkIcon,
  Trash2,
  CheckCircle2,
  XCircle,
  Filter,
  Calendar,
  Globe,
  ChevronDown,
  ChevronUp,
  FileText,
  Sparkles,
} from "lucide-react";
import { api, type Extraction, type Stats } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const [inputMode, setInputMode] = useState<"single" | "batch">("single");
  const [singleUrl, setSingleUrl] = useState("");
  const [batchUrls, setBatchUrls] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
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

  const handleSingleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleUrl) return;
    extractMutation.mutate(singleUrl);
  };

  const handleBatchExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchUrls.trim()) return;
    
    const urls = batchUrls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0 && (url.startsWith('http') || url.includes('.')));
    
    if (urls.length === 0) {
      toast({
        title: "No valid URLs",
        description: "Please enter at least one valid URL.",
        variant: "destructive",
      });
      return;
    }
    
    if (urls.length > 10) {
      toast({
        title: "Too many URLs",
        description: "Maximum 10 URLs per batch. Processing first 10.",
      });
    }
    
    batchExtractMutation.mutate(urls.slice(0, 10));
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
    const filteredData = filteredExtractions;
    if (filteredData.length === 0) {
      toast({ description: "No data to export", variant: "destructive" });
      return;
    }
    
    const csvContent = [
      ["URL", "Status", "Emails", "Date"].join(","),
      ...filteredData.map(e => [
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
    toast({ description: "CSV downloaded" });
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

  const filteredExtractions = useMemo(() => {
    return extractions.filter(extraction => {
      const matchesSearch = searchQuery === "" || 
        extraction.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
        extraction.emails.some(email => email.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = statusFilter === "all" || extraction.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [extractions, searchQuery, statusFilter]);

  const totalEmails = useMemo(() => {
    return filteredExtractions.reduce((sum, e) => sum + e.emails.length, 0);
  }, [filteredExtractions]);

  const planLimit = stats ? (stats.plan === "free" ? 500 : stats.plan === "basic" ? 1000 : Infinity) : 500;
  const isProcessing = extractMutation.isPending || batchExtractMutation.isPending;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 pt-20 sm:pt-24 pb-8 sm:pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="lg:col-span-3 border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-lg sm:text-xl font-heading flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Extract Emails
                </CardTitle>
                <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "single" | "batch")} className="w-full sm:w-auto">
                  <TabsList className="grid w-full sm:w-auto grid-cols-2 h-9">
                    <TabsTrigger value="single" className="text-xs sm:text-sm" data-testid="tab-single">
                      Single URL
                    </TabsTrigger>
                    <TabsTrigger value="batch" className="text-xs sm:text-sm" data-testid="tab-batch">
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
                      className="pl-10 bg-background/50 border-border/50 h-11 sm:h-12 text-sm sm:text-base"
                      value={singleUrl}
                      onChange={(e) => setSingleUrl(e.target.value)}
                      disabled={isProcessing}
                      data-testid="input-url"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    size="lg" 
                    className="h-11 sm:h-12 px-6 sm:px-8 bg-primary hover:bg-primary/90 text-white font-medium w-full sm:w-auto"
                    disabled={isProcessing}
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
                <form onSubmit={handleBatchExtract} className="space-y-3">
                  <Textarea
                    placeholder="Paste multiple URLs (one per line)&#10;&#10;Example:&#10;https://company1.com&#10;https://company2.com&#10;https://company3.com"
                    className="min-h-[140px] sm:min-h-[160px] bg-background/50 border-border/50 text-sm resize-none"
                    value={batchUrls}
                    onChange={(e) => setBatchUrls(e.target.value)}
                    disabled={isProcessing}
                    data-testid="input-batch-urls"
                  />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {batchUrls.split('\n').filter(u => u.trim()).length} URL(s) entered (max 10)
                    </p>
                    <Button 
                      type="submit" 
                      size="lg" 
                      className="h-11 sm:h-12 px-6 sm:px-8 bg-primary hover:bg-primary/90 text-white font-medium w-full sm:w-auto"
                      disabled={isProcessing}
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
                    <Button variant="link" className="text-primary p-0 h-auto text-xs">Upgrade</Button>
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
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-border/50 w-full sm:w-auto"
                  onClick={handleExportCSV}
                  disabled={filteredExtractions.length === 0}
                  data-testid="button-export"
                >
                  <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search URLs or emails..." 
                    className="pl-10 bg-background/50 border-border/50 h-10 text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger className="w-full sm:w-[150px] h-10 bg-background/50 border-border/50" data-testid="select-filter">
                    <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failed">No Data</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {(searchQuery || statusFilter !== "all") && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>Showing {filteredExtractions.length} of {extractions.length} results</span>
                  {totalEmails > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {totalEmails} emails
                    </Badge>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2 text-xs"
                    onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                  >
                    Clear filters
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
                    : "No results match your search."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {filteredExtractions.map((result) => {
                  const isExpanded = expandedRows.has(result.id);
                  const hasEmails = result.emails.length > 0;
                  
                  return (
                    <div key={result.id} className="group">
                      <div 
                        className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => hasEmails && toggleRowExpanded(result.id)}
                        data-testid={`row-extraction-${result.id}`}
                      >
                        <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center text-xs font-bold shrink-0">
                            {result.url.replace('https://', '').replace('http://', '').substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-foreground truncate text-sm sm:text-base max-w-[200px] sm:max-w-[400px]">
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
                              <Calendar className="w-3 h-3" />
                              <span>{new Date(result.scannedAt).toLocaleDateString()} at {new Date(result.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 ml-auto">
                          {hasEmails && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs"
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
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(result.id); }}
                            data-testid={`button-delete-${result.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          {hasEmails && (
                            <Button variant="ghost" size="icon" className="h-8 w-8">
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
                                  className="flex items-center gap-2 p-2 rounded-md bg-background/50 hover:bg-background transition-colors cursor-pointer group/email"
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
    </div>
  );
}
