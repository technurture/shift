import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Crown } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import icon from "@assets/generated_images/milkthelink_app_logo_icon.png";

type PaymentStatus = "verifying" | "success" | "failed";

export default function PaymentCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<PaymentStatus>("verifying");
  const [plan, setPlan] = useState<string>("");
  const [error, setError] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    const verifyPayment = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const reference = urlParams.get("reference");

      if (!reference) {
        setStatus("failed");
        setError("No payment reference found");
        return;
      }

      try {
        const result = await api.verifyPayment(reference);
        if (result.success) {
          setStatus("success");
          setPlan(result.plan);
          queryClient.invalidateQueries({ queryKey: ["stats"] });
          queryClient.invalidateQueries({ queryKey: ["user"] });
          toast({
            title: "Payment successful!",
            description: `Your plan has been upgraded to ${result.plan}.`,
          });
        } else {
          setStatus("failed");
          setError("Payment verification failed");
        }
      } catch (err: any) {
        setStatus("failed");
        setError(err.message || "Payment verification failed");
        toast({
          title: "Payment failed",
          description: err.message || "Could not verify your payment",
          variant: "destructive",
        });
      }
    };

    verifyPayment();
  }, [toast]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-secondary/5 blur-[120px]" />

      <div className="mb-8 flex flex-col items-center z-10">
        <Link href="/">
          <div className="w-16 h-16 rounded-2xl overflow-hidden mb-4 shadow-2xl border border-white/10 cursor-pointer hover:scale-105 transition-transform">
            <img src={icon} alt="MilkTheLink" className="w-full h-full object-cover" />
          </div>
        </Link>
      </div>

      <Card className="w-full max-w-md border-white/10 bg-card/50 backdrop-blur-xl shadow-2xl z-10">
        {status === "verifying" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
              <CardTitle>Verifying Payment</CardTitle>
              <CardDescription>
                Please wait while we verify your payment...
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground">
                This may take a few seconds.
              </p>
            </CardContent>
          </>
        )}

        {status === "success" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <CardTitle className="text-emerald-500">Payment Successful!</CardTitle>
              <CardDescription>
                Your account has been upgraded successfully.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-muted/30 rounded-lg flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Crown className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold capitalize" data-testid="text-new-plan">
                    {plan} Plan
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Your new plan is now active
                  </p>
                </div>
              </div>
              <Button 
                className="w-full" 
                onClick={() => setLocation("/dashboard")}
                data-testid="button-go-to-dashboard"
              >
                Go to Dashboard
              </Button>
            </CardContent>
          </>
        )}

        {status === "failed" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-destructive">Payment Failed</CardTitle>
              <CardDescription>
                {error || "We couldn't verify your payment."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Don't worry, if money was deducted, it will be refunded within 3-5 business days.
              </p>
              <div className="flex flex-col gap-2">
                <Button 
                  className="w-full" 
                  onClick={() => setLocation("/dashboard")}
                  data-testid="button-back-to-dashboard"
                >
                  Back to Dashboard
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => window.location.href = "mailto:emailshift01@gmail.com"}
                  data-testid="button-contact-support"
                >
                  Contact Support
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
