import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Check, Search, Zap, Shield, Globe, ArrowRight, Mail, Loader2, Send } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import heroBg from "@assets/generated_images/abstract_data_flow_background_for_saas_hero_section.png";

export default function Home() {
  const [url, setUrl] = useState("");
  const [, setLocation] = useLocation();

  const handleExtract = (e: React.FormEvent) => {
    e.preventDefault();
    // Redirect to auth if extracting from home
    setLocation(`/auth?mode=signup&redirect=${encodeURIComponent(url)}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-4">
        <div className="hero-glow" />
        
        {/* Background Image Overlay */}
        <div className="absolute inset-0 z-[-1] opacity-20 mix-blend-screen">
          <img src={heroBg} alt="Background" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
        </div>

        <div className="container mx-auto max-w-5xl text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-primary text-sm font-medium mb-6 backdrop-blur-sm">
              ✨ #1 Email Extraction Tool for 2025
            </span>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-heading font-bold tracking-tight text-white mb-6">
              Turn Websites into <br />
              <span className="gradient-text">Leads in Seconds</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Paste any URL and instantly extract valid email addresses. 
              No more manual searching. Start building your list today.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-2xl mx-auto"
          >
            <form onSubmit={handleExtract} className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
              <div className="relative flex flex-col sm:flex-row gap-2 p-2 bg-background/80 backdrop-blur-xl border border-white/10 rounded-xl">
                <div className="relative flex-1 flex items-center px-4">
                  <Globe className="w-5 h-5 text-muted-foreground mr-3" />
                  <Input 
                    placeholder="Paste website URL (e.g. www.company.com)" 
                    className="border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-lg h-12 placeholder:text-muted-foreground/50"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                  />
                </div>
                <Button 
                  size="lg" 
                  type="submit"
                  className="h-14 px-8 bg-primary hover:bg-primary/90 text-white font-bold text-base rounded-lg shadow-[0_0_30px_-10px_hsl(var(--primary))]"
                >
                  Extract Emails <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </form>
            <p className="mt-4 text-sm text-muted-foreground">
              Try it free. No credit card required for first 500 emails.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-black/20 border-y border-white/5">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">Why Choose MilkTheLink?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our advanced algorithms scan deeper and faster to find contacts others miss.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Zap className="w-10 h-10 text-secondary" />}
              title="Lightning Fast"
              description="Scan hundreds of pages in seconds. Our distributed crawler infrastructure ensures you never wait for data."
            />
            <FeatureCard 
              icon={<Shield className="w-10 h-10 text-primary" />}
              title="Verified Accuracy"
              description="We verify every email syntax and domain validity in real-time so you don't waste time on bounces."
            />
            <FeatureCard 
              icon={<Search className="w-10 h-10 text-blue-400" />}
              title="Deep Search"
              description="We find emails hidden in obfuscated code, contact pages, and even linked social media profiles."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground">Start for free, upgrade as you grow.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Free Plan */}
            <PricingCard 
              title="Starter" 
              price="$0" 
              nairaPrice="Free"
              description="Perfect for testing the waters"
              features={["500 Links Scanned", "500 Emails Extracted", "Standard Speed", "CSV Export"]}
              cta="Start Free"
              variant="outline"
            />

            {/* Basic Plan */}
            <PricingCard 
              title="Basic" 
              price="$50" 
              nairaPrice="75,000 NGN"
              period="/mo"
              description="For serious individual prospectors"
              features={["1,000 Links Scanned", "1,000 Emails Extracted", "High Speed Priority", "CSV & JSON Export", "Email Support"]}
              cta="Get Basic"
              popular
              variant="primary"
            />

            {/* Premium Plan */}
            <PricingCard 
              title="Premium" 
              price="$150" 
              nairaPrice="225,000 NGN"
              period="/mo"
              description="Powerhouse for sales teams"
              features={["Unlimited Links", "Unlimited Emails", "Maximum Speed", "API Access", "Dedicated Support"]}
              cta="Contact Sales"
              variant="outline"
            />
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <ContactSection />

      <Footer />
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/30 hover:bg-white/10 transition-all duration-300 group">
      <div className="mb-6 p-3 bg-black/40 rounded-xl w-fit group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function PricingCard({ title, price, nairaPrice, period = "", description, features, cta, popular, variant }: any) {
  return (
    <div className={`relative p-8 rounded-3xl border flex flex-col ${popular ? 'bg-white/5 border-primary shadow-[0_0_40px_-10px_rgba(124,58,237,0.3)]' : 'bg-background border-white/10'}`} data-testid={`card-pricing-${title.toLowerCase()}`}>
      {popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-purple-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
          Most Popular
        </div>
      )}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-muted-foreground mb-2">{title}</h3>
        <div className="flex flex-col">
          <span className="text-4xl font-bold text-white" data-testid={`text-price-usd-${title.toLowerCase()}`}>{price}</span>
          <span className="text-lg font-semibold text-primary/80" data-testid={`text-price-ngn-${title.toLowerCase()}`}>{nairaPrice}</span>
          {period && <span className="text-muted-foreground text-sm">{period}</span>}
        </div>
        <p className="text-sm text-muted-foreground mt-2">{description}</p>
      </div>
      <div className="flex-1 mb-8">
        <ul className="space-y-4">
          {features.map((feature: string, i: number) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
              <Check className="w-5 h-5 text-secondary shrink-0" />
              {feature}
            </li>
          ))}
        </ul>
      </div>
      <Link href="/auth?mode=signup">
        <Button 
          className={`w-full h-12 font-bold ${popular ? 'bg-primary hover:bg-primary/90 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
          data-testid={`button-cta-${title.toLowerCase()}`}
        >
          {cta}
        </Button>
      </Link>
    </div>
  );
}

function ContactSection() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const { toast } = useToast();

  const contactMutation = useMutation({
    mutationFn: (data: { name: string; email: string; message: string }) => 
      api.sendContactMessage(data),
    onSuccess: () => {
      toast({
        title: "Message sent!",
        description: "We'll get back to you as soon as possible.",
      });
      setFormData({ name: "", email: "", message: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }
    contactMutation.mutate(formData);
  };

  return (
    <section id="contact" className="py-24 px-4 bg-black/20 border-y border-white/5">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">Get in Touch</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Have questions? We'd love to hear from you.
          </p>
        </div>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Contact Us
            </CardTitle>
            <CardDescription>
              Send us a message and we'll respond within 24 hours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Name
                  </label>
                  <Input
                    id="name"
                    placeholder="Your name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-background/50 border-border/50"
                    data-testid="input-contact-name"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-background/50 border-border/50"
                    data-testid="input-contact-email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="message" className="text-sm font-medium">
                  Message
                </label>
                <Textarea
                  id="message"
                  placeholder="How can we help you?"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="bg-background/50 border-border/50 min-h-[120px] resize-y"
                  data-testid="input-contact-message"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12 font-bold bg-primary hover:bg-primary/90 text-white"
                disabled={contactMutation.isPending}
                data-testid="button-contact-submit"
              >
                {contactMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Message
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
