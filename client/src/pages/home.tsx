import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Mail, Shield, Zap, Search, Globe, CheckCircle2, Check, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-4 text-center">
        <div className="hero-glow" />
        <div className="container mx-auto max-w-5xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-primary text-sm font-medium mb-6 backdrop-blur-sm">
              ✨ Advanced Email Extraction for 2025
            </span>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-heading font-bold tracking-tight text-white mb-6">
              Empower Your Outreach with <br />
              <span className="gradient-text">MilkTheLink</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              MilkTheLink is the industry-leading email extraction platform designed to help sales teams, recruiters, and marketers build high-quality lead lists in seconds. Our proprietary scanning technology identifies verified contact information from any public URL, ensuring your outreach is targeted and effective.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth?mode=signup">
                <Button size="lg" className="h-12 px-8 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg shadow-[0_0_30px_-10px_hsl(var(--primary))]">
                  Start Free Trial
                </Button>
              </Link>
              <a href="#pricing">
                <Button size="lg" variant="outline" className="h-12 px-8 border-white/10 text-white hover:bg-white/5">
                  View Pricing
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Deep Dive Content Section */}
      <section className="py-20 bg-black/20 border-y border-white/5">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="prose prose-invert max-w-none">
            <h2 className="text-3xl font-heading font-bold text-white mb-8 text-center">How MilkTheLink Transforms Your Lead Generation</h2>
            <div className="grid gap-12">
              <div>
                <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5" /> Comprehensive Web Scanning
                </h3>
                <p className="text-muted-foreground">
                  Unlike traditional scrapers that only look at visible text, MilkTheLink performs a deep-level analysis of a website's architecture. We scan through public metadata, contact pages, and linked official profiles to find the most relevant decision-makers for your business.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-secondary mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5" /> Real-Time Verification
                </h3>
                <p className="text-muted-foreground">
                  Data quality is our top priority. Every email extracted is automatically checked against our verification engine to confirm domain validity and mailbox existence. This significantly reduces bounce rates and protects your sender reputation.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5" /> Ethical & Compliance-First Approach
                </h3>
                <p className="text-muted-foreground">
                  MilkTheLink operates strictly on public data. Our tool is designed to assist professionals in finding publicly available contact information for B2B communication, adhering to best practices for data transparency and web standard protocols.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex flex-col items-center gap-1 px-6 py-3 rounded-2xl bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 mb-6"
            >
              <div className="flex items-center gap-2 text-red-400 text-sm font-bold">
                <Sparkles className="w-4 h-4" />
                LIMITED TIME PROMO - Up to 40% OFF
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-xs text-orange-300/80">Offer ends December 31st, 2025</span>
            </motion.div>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground">Start for free, upgrade as you grow. No hidden fees.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <PricingCard 
              title="Starter" 
              price="$0" 
              nairaPrice="Free"
              description="Perfect for testing the waters"
              features={["500 Links Scanned/day", "500 Emails Extracted/day", "Standard Speed", "CSV Export"]}
              cta="Start Free"
              variant="outline"
            />

            <PricingCard 
              title="Basic" 
              price="$29" 
              originalPrice="$50"
              nairaPrice="45,000 NGN"
              originalNairaPrice="75,000 NGN"
              period="/mo"
              description="For serious individual prospectors"
              features={[
                "1,000 Links Scanned/day",
                "1,000 Emails Extracted/day",
                "50 Shopify Stores/day",
                "High Speed Priority",
                "CSV & JSON Export",
                "Email Support"
              ]}
              cta="Get Basic - Save 40%"
              popular
              variant="primary"
              promo
            />

            <PricingCard 
              title="Premium" 
              price="$99" 
              originalPrice="$150"
              nairaPrice="150,000 NGN"
              originalNairaPrice="225,000 NGN"
              period="/mo"
              description="Powerhouse for sales teams"
              features={[
                "Unlimited Links/day",
                "Unlimited Emails/day",
                "Unlimited Shopify Stores/day",
                "Maximum Speed",
                "API Access",
                "Dedicated Support"
              ]}
              cta="Get Premium - Save 34%"
              variant="outline"
              promo
            />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">Core Platform Capabilities</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our suite of tools is built to handle volume without compromising on accuracy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <FeatureItem 
              icon={<Search className="w-8 h-8 text-primary" />}
              title="Bulk Extraction"
              description="Process entire lists of URLs simultaneously. Perfect for large-scale marketing campaigns and market research."
            />
            <FeatureItem 
              icon={<Mail className="w-8 h-8 text-secondary" />}
              title="Verified Results"
              description="Instant verification of every email found. We filter out invalid syntaxes and dead domains automatically."
            />
            <FeatureItem 
              icon={<CheckCircle2 className="w-8 h-8 text-green-400" />}
              title="Export Anywhere"
              description="Seamlessly export your data in CSV or JSON formats, ready to be imported into your CRM of choice."
            />
          </div>
        </div>
      </section>

      {/* FAQ Section - High Value Content */}
      <section className="py-20 bg-black/20 border-y border-white/5">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl font-heading font-bold text-white mb-12 text-center">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-white hover:text-primary transition-colors">How accurate is the email extraction?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                MilkTheLink boasts a 98% accuracy rate. Our system uses advanced pattern matching and real-time domain verification to ensure that the emails you receive are valid and active.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-white hover:text-primary transition-colors">Is MilkTheLink compliant with GDPR?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes, MilkTheLink is a tool for finding publicly available business contact information. We encourage our users to follow GDPR and CAN-SPAM regulations when performing outreach to the contacts found.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger className="text-white hover:text-primary transition-colors">Can I use this for Shopify stores?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Absolutely! We have a specialized Shopify Store Finder that helps you identify eCommerce businesses and their verified contact details specifically.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <Card className="bg-white/5 border-white/10 hover-elevate transition-all">
      <CardHeader>
        <div className="mb-4">{icon}</div>
        <CardTitle className="text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function PricingCard({ title, price, originalPrice, nairaPrice, originalNairaPrice, period = "", description, features, cta, popular, variant, promo }: any) {
  return (
    <div className={`relative p-8 rounded-3xl border flex flex-col ${popular ? 'bg-white/5 border-primary shadow-[0_0_40px_-10px_rgba(124,58,237,0.3)]' : 'bg-background border-white/10'}`} data-testid={`card-pricing-${title.toLowerCase()}`}>
      {popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-purple-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
          Most Popular
        </div>
      )}
      {promo && !popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
          PROMO
        </div>
      )}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-muted-foreground mb-2">{title}</h3>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-4xl font-bold text-white" data-testid={`text-price-usd-${title.toLowerCase()}`}>{price}</span>
            {originalPrice && (
              <span className="text-xl text-muted-foreground line-through" data-testid={`text-original-price-usd-${title.toLowerCase()}`}>{originalPrice}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-primary/80" data-testid={`text-price-ngn-${title.toLowerCase()}`}>{nairaPrice}</span>
            {originalNairaPrice && (
              <span className="text-sm text-muted-foreground line-through">{originalNairaPrice}</span>
            )}
          </div>
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
