import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import icon from "@assets/generated_images/app_icon_for_mailsift.png";
import { api, type User } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function Navbar() {
  const [location, setLocation] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery<User>({
    queryKey: ["currentUser"],
    queryFn: () => api.getCurrentUser(),
    retry: false,
    enabled: location !== "/" && !location.includes("/auth"),
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      queryClient.clear();
      setLocation("/");
    },
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isLoggedIn = !!user;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled || isMobileMenuOpen
          ? "bg-background/80 backdrop-blur-md border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 overflow-hidden rounded-xl border border-white/10 group-hover:border-primary/50 transition-colors">
              <img 
                src={icon} 
                alt="MailSift Logo" 
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-xl font-heading font-bold tracking-tight text-white group-hover:text-primary transition-colors">
              MailSift
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {!isLoggedIn && location === "/" && (
              <>
                <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">Features</a>
                <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">Pricing</a>
              </>
            )}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {isLoggedIn ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {user.firstName} {user.lastName}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-white/10 hover:bg-white/5"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <>
                <Link href="/auth?mode=login">
                  <Button variant="ghost" className="text-muted-foreground hover:text-white">
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth?mode=signup">
                  <Button className="bg-primary hover:bg-primary/90 text-white font-medium shadow-[0_0_20px_-5px_hsl(var(--primary))]">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden p-2 text-white"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-20 left-0 right-0 bg-background border-b border-white/10 p-4 flex flex-col gap-4 shadow-2xl animate-in slide-in-from-top-5">
          {!isLoggedIn && location === "/" && (
            <>
              <a href="#features" className="text-lg font-medium text-muted-foreground hover:text-white" onClick={() => setIsMobileMenuOpen(false)}>Features</a>
              <a href="#pricing" className="text-lg font-medium text-muted-foreground hover:text-white" onClick={() => setIsMobileMenuOpen(false)}>Pricing</a>
            </>
          )}
          <div className="h-px bg-white/10 my-2" />
          {isLoggedIn ? (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                logoutMutation.mutate();
                setIsMobileMenuOpen(false);
              }}
            >
              Sign Out
            </Button>
          ) : (
            <>
              <Link href="/auth?mode=login" onClick={() => setIsMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">Sign In</Button>
              </Link>
              <Link href="/auth?mode=signup" onClick={() => setIsMobileMenuOpen(false)}>
                <Button className="w-full bg-primary text-white">Get Started</Button>
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
