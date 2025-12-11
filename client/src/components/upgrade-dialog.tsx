import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Crown, Zap, Shield } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: string;
}

const plans = [
  {
    id: "basic",
    name: "Basic",
    priceUsd: "$50",
    priceNgn: "75,000 NGN",
    period: "/month",
    features: [
      "1,000 Links Scanned",
      "1,000 Emails Extracted",
      "100 Shopify Stores/Day",
      "High Speed Priority",
      "CSV & JSON Export",
      "Email Support",
    ],
    icon: Zap,
    popular: true,
  },
  {
    id: "premium",
    name: "Premium",
    priceUsd: "$150",
    priceNgn: "225,000 NGN",
    period: "/month",
    features: [
      "Unlimited Links",
      "Unlimited Emails",
      "1,000 Shopify Stores/Day",
      "Maximum Speed",
      "API Access",
      "Dedicated Support",
    ],
    icon: Crown,
    popular: false,
  },
];

export function UpgradeDialog({ open, onOpenChange, currentPlan }: UpgradeDialogProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const handleUpgrade = async (planId: string) => {
    setIsLoading(planId);
    try {
      const result = await api.initializePayment(planId);
      if (result.authorization_url) {
        window.location.href = result.authorization_url;
      } else {
        throw new Error("Failed to get payment URL");
      }
    } catch (error: any) {
      toast({
        title: "Payment initialization failed",
        description: error.message || "Could not start payment. Please try again.",
        variant: "destructive",
      });
      setIsLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Crown className="w-5 h-5 text-primary" />
            Upgrade Your Plan
          </DialogTitle>
          <DialogDescription>
            Choose a plan that fits your needs. Upgrade to unlock more features and higher limits.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isCurrentPlan = currentPlan.toLowerCase() === plan.id.toLowerCase();
            const isDowngrade = 
              (currentPlan === "premium" && plan.id === "basic");

            return (
              <div
                key={plan.id}
                className={`relative p-6 rounded-xl border flex flex-col ${
                  plan.popular
                    ? "bg-primary/5 border-primary/30"
                    : "bg-card border-border/50"
                }`}
                data-testid={`card-plan-${plan.id}`}
              >
                {plan.popular && (
                  <Badge 
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-white"
                  >
                    Most Popular
                  </Badge>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-lg ${plan.popular ? "bg-primary/10" : "bg-muted"}`}>
                    <Icon className={`w-5 h-5 ${plan.popular ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{plan.name}</h3>
                    {isCurrentPlan && (
                      <Badge variant="secondary" className="text-xs">
                        Current Plan
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <span className="text-3xl font-bold" data-testid={`text-price-${plan.id}`}>
                    {plan.priceUsd}
                  </span>
                  <span className="text-muted-foreground">{plan.period}</span>
                  <p className="text-primary font-medium mt-1" data-testid={`text-price-ngn-${plan.id}`}>
                    {plan.priceNgn}
                  </p>
                </div>

                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full ${plan.popular ? "bg-primary hover:bg-primary/90" : ""}`}
                  variant={plan.popular ? "default" : "outline"}
                  disabled={isCurrentPlan || isDowngrade || isLoading !== null}
                  onClick={() => handleUpgrade(plan.id)}
                  data-testid={`button-upgrade-${plan.id}`}
                >
                  {isLoading === plan.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : isCurrentPlan ? (
                    "Current Plan"
                  ) : isDowngrade ? (
                    "Downgrade not available"
                  ) : (
                    `Upgrade to ${plan.name}`
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Secure Payment</p>
              <p className="text-xs text-muted-foreground">
                Payments are processed securely through Paystack. Your payment information is encrypted and safe.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface LimitReachedBannerProps {
  onUpgrade: () => void;
  emailsUsed: number;
  emailsLimit: number;
  linksUsed: number;
  linksLimit: number;
}

export function LimitReachedBanner({ 
  onUpgrade, 
  emailsUsed, 
  emailsLimit,
  linksUsed,
  linksLimit,
}: LimitReachedBannerProps) {
  const emailsExceeded = emailsLimit !== Infinity && emailsUsed >= emailsLimit;
  const linksExceeded = linksLimit !== Infinity && linksUsed >= linksLimit;
  
  if (!emailsExceeded && !linksExceeded) return null;

  return (
    <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-destructive flex items-center gap-2">
            <Crown className="w-4 h-4" />
            Plan Limit Reached
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {emailsExceeded && linksExceeded 
              ? "You've reached both your email extraction and link scanning limits."
              : emailsExceeded 
                ? "You've reached your email extraction limit for this plan."
                : "You've reached your link scanning limit for this plan."}
          </p>
        </div>
        <Button 
          onClick={onUpgrade}
          className="bg-primary hover:bg-primary/90 shrink-0"
          data-testid="button-upgrade-now"
        >
          <Crown className="w-4 h-4 mr-2" />
          Upgrade Now
        </Button>
      </div>
    </div>
  );
}
