import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import icon from "@assets/generated_images/app_icon_for_mailsift.png";
import { Loader2, ArrowLeft, Mail, KeyRound, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type AuthView = "login" | "signup" | "verify-email" | "forgot-password" | "reset-password";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState(["", "", "", "", "", ""]);
  const { toast } = useToast();
  
  const searchParams = new URLSearchParams(window.location.search);
  const mode = searchParams.get("mode");
  
  if (mode === "signup" && view === "login") {
    setView("signup");
  }

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }
    if (!/^\d*$/.test(value)) return;
    
    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);
    
    if (value && index < 5) {
      const nextInput = document.querySelector(`[data-testid="input-code-${index + 1}"]`) as HTMLInputElement;
      nextInput?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
      const prevInput = document.querySelector(`[data-testid="input-code-${index - 1}"]`) as HTMLInputElement;
      prevInput?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;
    
    const newCode = [...verificationCode];
    for (let i = 0; i < pastedData.length; i++) {
      newCode[i] = pastedData[i];
    }
    setVerificationCode(newCode);
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const loginEmail = formData.get("email") as string;
    const password = formData.get("password") as string;
    
    try {
      await api.login({ email: loginEmail, password });
      toast({
        title: "Welcome back!",
        description: "You've successfully signed in.",
      });
      setLocation("/dashboard");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const signupEmail = formData.get("email") as string;
    const password = formData.get("password") as string;
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    
    try {
      await api.signup({ email: signupEmail, password, firstName, lastName });
      setEmail(signupEmail);
      toast({
        title: "Account created!",
        description: "Please check your email for a verification code.",
      });
      setView("verify-email");
    } catch (error: any) {
      toast({
        title: "Signup failed",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const code = verificationCode.join("");
    if (code.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter the complete 6-digit code.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    
    try {
      await api.verifyEmail({ email, code });
      toast({
        title: "Email verified!",
        description: "Your email has been successfully verified.",
      });
      setLocation("/dashboard");
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message || "Invalid verification code",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    try {
      await api.resendVerificationCode(email);
      toast({
        title: "Code resent!",
        description: "A new verification code has been sent to your email.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to resend",
        description: error.message || "Could not resend verification code",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const forgotEmail = formData.get("email") as string;
    
    try {
      await api.forgotPassword(forgotEmail);
      setEmail(forgotEmail);
      toast({
        title: "Reset code sent!",
        description: "Check your email for a password reset code.",
      });
      setView("reset-password");
      setVerificationCode(["", "", "", "", "", ""]);
    } catch (error: any) {
      toast({
        title: "Request failed",
        description: error.message || "Could not send reset code",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    const code = verificationCode.join("");
    
    if (code.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter the complete 6-digit code.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    
    try {
      await api.resetPassword({ email, code, newPassword });
      toast({
        title: "Password reset!",
        description: "Your password has been successfully reset. Please sign in.",
      });
      setView("login");
      setVerificationCode(["", "", "", "", "", ""]);
    } catch (error: any) {
      toast({
        title: "Reset failed",
        description: error.message || "Could not reset password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderBackButton = (targetView: AuthView, label: string) => (
    <Button
      type="button"
      variant="ghost"
      className="mb-4"
      onClick={() => setView(targetView)}
      data-testid="button-back"
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );

  const renderCodeInputs = () => (
    <div className="flex gap-2 justify-center" onPaste={handleCodePaste}>
      {verificationCode.map((digit, index) => (
        <Input
          key={index}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleCodeChange(index, e.target.value)}
          onKeyDown={(e) => handleCodeKeyDown(index, e)}
          className="w-12 h-12 text-center text-lg font-semibold bg-background/50 border-white/10 min-h-[44px]"
          data-testid={`input-code-${index}`}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
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
        {view === "login" && (
          <form onSubmit={handleLogin}>
            <CardHeader>
              <CardTitle>Welcome back</CardTitle>
              <CardDescription>Enter your credentials to access your dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  name="email"
                  type="email" 
                  placeholder="name@company.com" 
                  className="bg-background/50 border-white/10 min-h-[44px]" 
                  required 
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  name="password"
                  type="password" 
                  className="bg-background/50 border-white/10 min-h-[44px]" 
                  required 
                  data-testid="input-password"
                />
              </div>
              <Button
                type="button"
                variant="link"
                className="px-0 text-muted-foreground"
                onClick={() => setView("forgot-password")}
                data-testid="link-forgot-password"
              >
                Forgot Password?
              </Button>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button 
                type="submit" 
                className="w-full min-h-[44px]" 
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</> : "Sign In"}
              </Button>
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Button
                  type="button"
                  variant="link"
                  className="px-0"
                  onClick={() => setView("signup")}
                  data-testid="link-signup"
                >
                  Sign up
                </Button>
              </p>
            </CardFooter>
          </form>
        )}

        {view === "signup" && (
          <form onSubmit={handleSignup}>
            <CardHeader>
              <CardTitle>Create an account</CardTitle>
              <CardDescription>Start extracting emails for free today.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First name</Label>
                  <Input 
                    id="first-name" 
                    name="firstName"
                    placeholder="John" 
                    className="bg-background/50 border-white/10 min-h-[44px]" 
                    required 
                    data-testid="input-firstName"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last name</Label>
                  <Input 
                    id="last-name" 
                    name="lastName"
                    placeholder="Doe" 
                    className="bg-background/50 border-white/10 min-h-[44px]" 
                    required 
                    data-testid="input-lastName"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-signup">Email</Label>
                <Input 
                  id="email-signup" 
                  name="email"
                  type="email" 
                  placeholder="name@company.com" 
                  className="bg-background/50 border-white/10 min-h-[44px]" 
                  required 
                  data-testid="input-email-signup"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-signup">Password</Label>
                <Input 
                  id="password-signup" 
                  name="password"
                  type="password" 
                  className="bg-background/50 border-white/10 min-h-[44px]" 
                  required 
                  minLength={6}
                  data-testid="input-password-signup"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button 
                type="submit" 
                className="w-full min-h-[44px]" 
                variant="secondary"
                disabled={isLoading}
                data-testid="button-signup"
              >
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account...</> : "Create Account"}
              </Button>
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Button
                  type="button"
                  variant="link"
                  className="px-0"
                  onClick={() => setView("login")}
                  data-testid="link-login"
                >
                  Sign in
                </Button>
              </p>
            </CardFooter>
          </form>
        )}

        {view === "verify-email" && (
          <form onSubmit={handleVerifyEmail}>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Verify your email</CardTitle>
              <CardDescription>
                We've sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderCodeInputs()}
              <p className="text-center text-sm text-muted-foreground">
                Didn't receive the code?{" "}
                <Button
                  type="button"
                  variant="link"
                  className="px-0"
                  onClick={handleResendCode}
                  disabled={isLoading}
                  data-testid="button-resend-code"
                >
                  Resend Code
                </Button>
              </p>
            </CardContent>
            <CardFooter>
              <Button 
                type="submit" 
                className="w-full min-h-[44px]" 
                disabled={isLoading}
                data-testid="button-verify-email"
              >
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</> : "Verify Email"}
              </Button>
            </CardFooter>
          </form>
        )}

        {view === "forgot-password" && (
          <form onSubmit={handleForgotPassword}>
            <CardHeader>
              {renderBackButton("login", "Back to login")}
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-center">Forgot password?</CardTitle>
              <CardDescription className="text-center">
                Enter your email and we'll send you a reset code.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <Input 
                  id="forgot-email" 
                  name="email"
                  type="email" 
                  placeholder="name@company.com" 
                  className="bg-background/50 border-white/10 min-h-[44px]" 
                  required 
                  data-testid="input-forgot-email"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                type="submit" 
                className="w-full min-h-[44px]" 
                disabled={isLoading}
                data-testid="button-send-reset-code"
              >
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : "Send Reset Code"}
              </Button>
            </CardFooter>
          </form>
        )}

        {view === "reset-password" && (
          <form onSubmit={handleResetPassword}>
            <CardHeader>
              {renderBackButton("forgot-password", "Back")}
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-center">Reset your password</CardTitle>
              <CardDescription className="text-center">
                Enter the code sent to <span className="font-medium text-foreground">{email}</span> and your new password.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="text-center block">Verification Code</Label>
                {renderCodeInputs()}
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input 
                    id="new-password" 
                    name="newPassword"
                    type="password" 
                    className="bg-background/50 border-white/10 min-h-[44px]" 
                    required 
                    minLength={6}
                    data-testid="input-new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input 
                    id="confirm-password" 
                    name="confirmPassword"
                    type="password" 
                    className="bg-background/50 border-white/10 min-h-[44px]" 
                    required 
                    minLength={6}
                    data-testid="input-confirm-password"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button 
                type="submit" 
                className="w-full min-h-[44px]" 
                disabled={isLoading}
                data-testid="button-reset-password"
              >
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting...</> : "Reset Password"}
              </Button>
              <Button
                type="button"
                variant="link"
                className="text-muted-foreground"
                onClick={handleResendCode}
                disabled={isLoading}
                data-testid="button-resend-reset-code"
              >
                Resend Code
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
