import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, Home, LayoutDashboard } from "lucide-react";
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
          <Link href="/" className="flex items-center gap-3 group min-h-[44px]" data-testid="link-logo">
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
          <div className="hidden md:flex items-center gap-6">
            {isLoggedIn ? (
              <>
                <Link href="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-white transition-colors min-h-[44px]" data-testid="link-home">
                  <Home className="w-4 h-4" />
                  Home
                </Link>
                <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-white transition-colors min-h-[44px]" data-testid="link-dashboard">
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>
              </>
            ) : location === "/" && (
              <>
                <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors min-h-[44px] flex items-center">Features</a>
                <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors min-h-[44px] flex items-center">Pricing</a>
              </>
            )}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {isLoggedIn ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground" data-testid="text-user-name">
                  {user.firstName} {user.lastName}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-white/10 hover:bg-white/5 min-h-[44px]"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                  data-testid="button-logout"
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <>
                <Link href="/auth?mode=login">
                  <Button variant="ghost" className="text-muted-foreground hover:text-white min-h-[44px]" data-testid="button-signin">
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth?mode=signup">
                  <Button className="bg-primary hover:bg-primary/90 text-white font-medium shadow-[0_0_20px_-5px_hsl(var(--primary))] min-h-[44px]" data-testid="button-get-started">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden p-3 text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            data-testid="button-mobile-menu"
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-20 left-0 right-0 bg-background border-b border-white/10 p-4 flex flex-col gap-2 shadow-2xl animate-in slide-in-from-top-5">
          {isLoggedIn ? (
            <>
              <Link 
                href="/" 
                className="flex items-center gap-3 text-lg font-medium text-muted-foreground hover:text-white min-h-[44px] px-2 rounded-md hover:bg-white/5 transition-colors" 
                onClick={() => setIsMobileMenuOpen(false)}
                data-testid="mobile-link-home"
              >
                <Home className="w-5 h-5" />
                Home
              </Link>
              <Link 
                href="/dashboard" 
                className="flex items-center gap-3 text-lg font-medium text-muted-foreground hover:text-white min-h-[44px] px-2 rounded-md hover:bg-white/5 transition-colors" 
                onClick={() => setIsMobileMenuOpen(false)}
                data-testid="mobile-link-dashboard"
              >
                <LayoutDashboard className="w-5 h-5" />
                Dashboard
              </Link>
              <div className="h-px bg-white/10 my-2" />
              <div className="px-2 py-2 text-sm text-muted-foreground" data-testid="mobile-text-user">
                Logged in as {user.firstName} {user.lastName}
              </div>
              <Button 
                variant="outline" 
                className="w-full min-h-[44px]"
                onClick={() => {
                  logoutMutation.mutate();
                  setIsMobileMenuOpen(false);
                }}
                data-testid="mobile-button-logout"
              >
                Sign Out
              </Button>
            </>
          ) : (
            <>
              {location === "/" && (
                <>
                  <a 
                    href="#features" 
                    className="text-lg font-medium text-muted-foreground hover:text-white min-h-[44px] flex items-center px-2 rounded-md hover:bg-white/5 transition-colors" 
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Features
                  </a>
                  <a 
                    href="#pricing" 
                    className="text-lg font-medium text-muted-foreground hover:text-white min-h-[44px] flex items-center px-2 rounded-md hover:bg-white/5 transition-colors" 
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Pricing
                  </a>
                </>
              )}
              <div className="h-px bg-white/10 my-2" />
              <Link href="/auth?mode=login" onClick={() => setIsMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start min-h-[44px]" data-testid="mobile-button-signin">
                  Sign In
                </Button>
              </Link>
              <Link href="/auth?mode=signup" onClick={() => setIsMobileMenuOpen(false)}>
                <Button className="w-full bg-primary text-white min-h-[44px]" data-testid="mobile-button-get-started">
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
