import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import icon from "@assets/generated_images/app_icon_for_mailsift.png";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const [location, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  
  // Parse query params manually since wouter doesn't support it natively easily
  const searchParams = new URLSearchParams(window.location.search);
  const mode = searchParams.get("mode") || "login";
  const defaultTab = mode === "signup" ? "signup" : "login";

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Mock network request
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsLoading(false);
    setLocation("/dashboard");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-secondary/5 blur-[120px]" />

      <div className="mb-8 flex flex-col items-center z-10">
        <Link href="/">
          <div className="w-16 h-16 rounded-2xl overflow-hidden mb-4 shadow-2xl border border-white/10 cursor-pointer hover:scale-105 transition-transform">
            <img src={icon} alt="MailSift" className="w-full h-full object-cover" />
          </div>
        </Link>
        <h1 className="text-2xl font-heading font-bold text-white">Welcome to MailSift</h1>
        <p className="text-muted-foreground mt-2">The intelligent email extraction platform.</p>
      </div>

      <Card className="w-full max-w-md border-white/10 bg-card/50 backdrop-blur-xl shadow-2xl z-10">
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-background/50 p-1">
            <TabsTrigger value="login" className="data-[state=active]:bg-primary data-[state=active]:text-white">Login</TabsTrigger>
            <TabsTrigger value="signup" className="data-[state=active]:bg-primary data-[state=active]:text-white">Sign Up</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <form onSubmit={handleAuth}>
              <CardHeader>
                <CardTitle>Welcome back</CardTitle>
                <CardDescription>Enter your credentials to access your dashboard.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="name@company.com" className="bg-background/50 border-white/10" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" className="bg-background/50 border-white/10" required />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sign In"}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleAuth}>
              <CardHeader>
                <CardTitle>Create an account</CardTitle>
                <CardDescription>Start extracting emails for free today.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First name</Label>
                    <Input id="first-name" placeholder="John" className="bg-background/50 border-white/10" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last name</Label>
                    <Input id="last-name" placeholder="Doe" className="bg-background/50 border-white/10" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-signup">Email</Label>
                  <Input id="email-signup" type="email" placeholder="name@company.com" className="bg-background/50 border-white/10" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-signup">Password</Label>
                  <Input id="password-signup" type="password" className="bg-background/50 border-white/10" required />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full bg-secondary text-black hover:bg-secondary/90" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create Account"}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
