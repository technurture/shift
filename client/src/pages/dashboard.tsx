import { useState, useEffect } from "react";
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
  CheckCircle2, 
  AlertCircle, 
  Copy,
  Mail,
  Link as LinkIcon,
  BarChart3
} from "lucide-react";
import { mockExtractEmail } from "@/lib/mock-service";
import { useToast } from "@/hooks/use-toast";

type ExtractionResult = {
  id: string;
  url: string;
  status: 'success' | 'failed' | 'processing';
  emails: string[];
  date: string;
};

export default function Dashboard() {
  const [url, setUrl] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<ExtractionResult[]>([
    {
      id: "1",
      url: "https://example-company.com",
      status: "success",
      emails: ["contact@example-company.com", "sales@example-company.com"],
      date: "2025-12-01"
    },
    {
      id: "2",
      url: "https://tech-startup.io",
      status: "success",
      emails: ["hello@tech-startup.io"],
      date: "2025-11-30"
    }
  ]);
  
  // Plan limits mock
  const planLimit = 500;
  const usedCredits = results.reduce((acc, curr) => acc + curr.emails.length, 0);
  const { toast } = useToast();

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsScanning(true);
    
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const foundEmails = mockExtractEmail(url);
      
      if (foundEmails.length === 0) {
        toast({
          title: "No emails found",
          description: "We couldn't find any valid email addresses on this page.",
          variant: "destructive"
        });
        setResults(prev => [{
          id: Math.random().toString(),
          url,
          status: 'failed',
          emails: [],
          date: new Date().toISOString().split('T')[0]
        }, ...prev]);
      } else {
        toast({
          title: "Success!",
          description: `Found ${foundEmails.length} email(s).`,
        });
        setResults(prev => [{
          id: Math.random().toString(),
          url,
          status: 'success',
          emails: foundEmails,
          date: new Date().toISOString().split('T')[0]
        }, ...prev]);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong while scanning.",
        variant: "destructive"
      });
    } finally {
      setIsScanning(false);
      setUrl("");
    }
  };

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
                    disabled={isScanning}
                  />
                </div>
                <Button 
                  type="submit" 
                  size="lg" 
                  className="h-12 bg-primary hover:bg-primary/90 text-white font-medium"
                  disabled={isScanning}
                >
                  {isScanning ? (
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
              <div className="flex justify-between items-end mb-2">
                <span className="text-3xl font-bold text-white">{usedCredits}</span>
                <span className="text-sm text-muted-foreground">/ {planLimit} emails</span>
              </div>
              <Progress value={(usedCredits / planLimit) * 100} className="h-2 mb-4" />
              <div className="flex justify-between items-center">
                <Badge variant="outline" className="border-white/10 text-muted-foreground">Free Plan</Badge>
                <Button variant="link" className="text-secondary p-0 h-auto text-xs">Upgrade Plan</Button>
              </div>
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
                {results.map((result) => (
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
                        <div className="flex flex-col gap-1">
                          {result.emails.map(email => (
                            <div key={email} className="flex items-center gap-2 text-sm text-muted-foreground group cursor-pointer hover:text-white">
                              <Mail className="w-3 h-3" />
                              {email}
                              <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm italic">No emails found</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {result.date}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
