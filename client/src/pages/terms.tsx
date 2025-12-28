import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export default function TermsOfService() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <main className="container mx-auto px-4 py-32 max-w-4xl">
        <h1 className="text-4xl font-heading font-bold text-white mb-8">Terms of Service</h1>
        <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
          <p>Last Updated: December 28, 2025</p>
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
            <p>By using MilkTheLink, you agree to comply with and be bound by these Terms of Service.</p>
          </section>
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Permitted Use</h2>
            <p>Our tool is intended for professional B2B outreach. You agree not to use extracted data for spam or any illegal activities.</p>
          </section>
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Subscription and Billing</h2>
            <p>Some features require a paid subscription. Billing is handled through our secure payment providers.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
