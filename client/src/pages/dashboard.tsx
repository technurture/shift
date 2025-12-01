import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Search, 
  Download, 
  Loader2, 
  Copy,
  Mail,
  Link as LinkIcon,
} from "lucide-react";
import { api, type Extraction, type Stats } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const [url, setUrl] = useState("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Fetch user stats
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: () => api.getStats(),
    retry: false,
  });

  // Fetch extractions
  const { data: extractions = [], isLoading: extractionsLoading } = useQuery<Extraction[]>({
    queryKey: ["extractions"],
    queryFn: () => api.getExtractions(),
    retry: false,
  });

  // Check auth
  useEffect(() => {
    api.getCurrentUser().catch(() => {
      setLocation("/auth?mode=login");
    });
  }, [setLocation]);

  // Extract mutation
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
      setUrl("");
    },
    onError: (error: any) => {
      toast({
        title: "Extraction failed",
        description: error.message || "Something went wrong while scanning.",
        variant: "destructive",
      });
    },
  });

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    extractMutation.mutate(url);
  };

  const handleCopy = (email: string) => {
    navigator.clipboard.writeText(email);
    toast({ description: "Copied to clipboard" });
  };

  const planLimit = stats ? (stats.plan === "free" ? 500 : stats.plan === "basic" ? 1000 : Infinity) : 500;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 pt-24 pb-12">
        {/* Stats & Header */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <Card className="lg:col-span-2 border-white/10 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl font-heading">New Extraction</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleExtract} className="flex gap-3">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Enter website URL to scan..." 
                    className="pl-10 bg-background/50 border-white/10 h-12"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={extractMutation.isPending}
                    data-testid="input-url"
                  />
                </div>
                <Button 
                  type="submit" 
                  size="lg" 
                  className="h-12 bg-primary hover:bg-primary/90 text-white font-medium"
                  disabled={extractMutation.isPending}
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
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Plan Usage</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex items-center justify-center h-20">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-3xl font-bold text-white" data-testid="text-emails-extracted">
                      {stats?.emailsExtracted || 0}
                    </span>
                    <span className="text-sm text-muted-foreground">/ {planLimit} emails</span>
                  </div>
                  <Progress value={((stats?.emailsExtracted || 0) / planLimit) * 100} className="h-2 mb-4" />
                  <div className="flex justify-between items-center">
                    <Badge variant="outline" className="border-white/10 text-muted-foreground capitalize">
                      {stats?.plan || "Free"} Plan
                    </Badge>
                    <Button variant="link" className="text-secondary p-0 h-auto text-xs">Upgrade Plan</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results Table */}
        <Card className="border-white/10 bg-card/50 backdrop-blur-sm min-h-[400px]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-heading">Recent Extractions</CardTitle>
            <Button variant="outline" size="sm" className="border-white/10 hover:bg-white/5">
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            {extractionsLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : extractions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <Search className="w-12 h-12 mb-4 opacity-20" />
                <p>No extractions yet. Start by pasting a URL above!</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="w-[300px]">Source URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Extracted Emails</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extractions.map((result) => (
                    <TableRow key={result.id} className="border-white/10 hover:bg-white/5 transition-colors">
                      <TableCell className="font-medium text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-xs font-bold">
                            {result.url.replace('https://', '').substring(0, 2).toUpperCase()}
                          </div>
                          <span className="truncate max-w-[200px]">{result.url}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {result.status === 'success' ? (
                          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20">Success</Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20">No Data</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {result.emails.length > 0 ? (
                          <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto pr-2">
                            {result.emails.map((email, idx) => (
                              <div 
                                key={`${email}-${idx}`} 
                                className="flex items-center gap-2 text-sm text-muted-foreground group cursor-pointer hover:text-white py-0.5"
                                onClick={() => handleCopy(email)}
                              >
                                <Mail className="w-3 h-3 shrink-0" />
                                <span className="truncate">{email}</span>
                                <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm italic">No emails found</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {new Date(result.scannedAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
