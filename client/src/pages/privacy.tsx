import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <main className="container mx-auto px-4 py-32 max-w-4xl">
        <h1 className="text-4xl font-heading font-bold text-white mb-8">Privacy Policy</h1>
        <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
          <p>Last Updated: December 28, 2025</p>
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Information We Collect</h2>
            <p>At MilkTheLink, we collect information necessary to provide our email extraction services. This includes account information (name, email) and usage data related to the URLs you scan.</p>
          </section>
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. How We Use Data</h2>
            <p>We use your data to facilitate lead generation, improve our scanning algorithms, and provide customer support. We do not sell your personal data to third parties.</p>
          </section>
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Data Security</h2>
            <p>We implement industry-standard security measures to protect your information from unauthorized access or disclosure.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
