import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  Mail, 
  ArrowLeft, 
  Loader2, 
  Save,
  CheckCircle2,
  XCircle,
  Crown,
  BarChart3,
} from "lucide-react";
import { api, type User as UserType, type Stats } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function Profile() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading, error: userError } = useQuery<UserType>({
    queryKey: ["user"],
    queryFn: () => api.getCurrentUser(),
    retry: false,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: () => api.getStats(),
    retry: false,
  });

  useEffect(() => {
    if (userError) {
      setLocation("/auth?mode=login");
    }
  }, [userError, setLocation]);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.firstName,
        lastName: user.lastName,
      });
    }
  }, [user, form]);

  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileFormData) => api.updateProfile(data),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["user"], updatedUser);
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const planLimit = stats ? (stats.plan === "free" ? 500 : stats.plan === "basic" ? 1000 : Infinity) : 500;
  const linksLimit = stats ? (stats.plan === "free" ? 500 : stats.plan === "basic" ? 1000 : Infinity) : 500;

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 pt-20 sm:pt-24 pb-8 sm:pb-12 max-w-4xl">
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" className="gap-2" data-testid="button-back-to-dashboard">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl font-heading flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Profile Information
              </CardTitle>
              <CardDescription>
                View and update your personal information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="Enter your first name"
                              className="bg-background/50 border-border/50"
                              data-testid="input-first-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="Enter your last name"
                              className="bg-background/50 border-border/50"
                              data-testid="input-last-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email Address</label>
                    <div className="flex items-center gap-2">
                      <Input 
                        value={user?.email || ""} 
                        disabled 
                        className="bg-muted/50 border-border/50 flex-1"
                        data-testid="input-email"
                      />
                      {user?.isEmailVerified ? (
                        <Badge 
                          variant="secondary" 
                          className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1"
                          data-testid="badge-email-verified"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge 
                          variant="secondary" 
                          className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1"
                          data-testid="badge-email-unverified"
                        >
                          <XCircle className="w-3 h-3" />
                          Not Verified
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Email address cannot be changed
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <Button 
                      type="submit" 
                      disabled={updateProfileMutation.isPending || !form.formState.isDirty}
                      className="gap-2"
                      data-testid="button-save-profile"
                    >
                      {updateProfileMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl font-heading flex items-center gap-2">
                <Crown className="w-5 h-5 text-primary" />
                Current Plan
              </CardTitle>
              <CardDescription>
                Your subscription and usage statistics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {statsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Crown className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold capitalize text-lg" data-testid="text-plan-name">
                          {stats?.plan || "Free"} Plan
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {stats?.plan === "premium" ? "Unlimited access" : "Limited monthly quota"}
                        </p>
                      </div>
                    </div>
                    <Link href="/#pricing">
                      <Button variant="outline" data-testid="button-upgrade-plan">
                        {stats?.plan === "premium" ? "View Plans" : "Upgrade Plan"}
                      </Button>
                    </Link>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-muted-foreground" />
                      Usage Statistics
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2 p-4 bg-muted/20 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Emails Extracted
                          </span>
                          <span className="font-semibold" data-testid="text-emails-used">
                            {stats?.emailsExtracted || 0}
                            <span className="text-muted-foreground font-normal">
                              /{planLimit === Infinity ? "Unlimited" : planLimit}
                            </span>
                          </span>
                        </div>
                        <Progress 
                          value={planLimit === Infinity ? 0 : ((stats?.emailsExtracted || 0) / planLimit) * 100} 
                          className="h-2" 
                        />
                      </div>

                      <div className="space-y-2 p-4 bg-muted/20 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" />
                            Links Scanned
                          </span>
                          <span className="font-semibold" data-testid="text-links-used">
                            {stats?.linksScanned || 0}
                            <span className="text-muted-foreground font-normal">
                              /{linksLimit === Infinity ? "Unlimited" : linksLimit}
                            </span>
                          </span>
                        </div>
                        <Progress 
                          value={linksLimit === Infinity ? 0 : ((stats?.linksScanned || 0) / linksLimit) * 100} 
                          className="h-2" 
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl font-heading flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                Email Verification Status
              </CardTitle>
              <CardDescription>
                Your email verification status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  {user?.isEmailVerified ? (
                    <>
                      <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold" data-testid="text-verification-status">
                          Email Verified
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Your email address has been verified
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-2 bg-amber-500/10 rounded-lg">
                        <XCircle className="w-6 h-6 text-amber-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold" data-testid="text-verification-status">
                          Email Not Verified
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Please verify your email to unlock all features
                        </p>
                      </div>
                    </>
                  )}
                </div>
                {!user?.isEmailVerified && (
                  <Button 
                    variant="outline"
                    onClick={() => setLocation("/auth?mode=verify")}
                    data-testid="button-verify-email"
                  >
                    Verify Now
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
