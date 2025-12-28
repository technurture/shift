import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Mail, Shield, Zap, Search, Globe, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

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
