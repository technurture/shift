import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdSenseScript } from "@/components/ads";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import AuthPage from "@/pages/auth";
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import PaymentCallback from "@/pages/payment-callback";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/profile" component={Profile} />
      <Route path="/settings" component={Settings} />
      <Route path="/payment/callback" component={PaymentCallback} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AdSenseScript />
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
