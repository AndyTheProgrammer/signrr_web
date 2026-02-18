import Link from "next/link";
import Image from "next/image";
import {
  Shield,
  Zap,
  Users,
  ArrowRight,
  CheckCircle2,
  PenLine,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100">
        <div className="container mx-auto flex items-center justify-between px-6 py-3">
          <Link href="/">
            <div className="overflow-hidden h-12">
              <Image
                src="/signrR_Logo_3-1.png"
                alt="SignrR"
                width={150}
                height={150}
                className="h-[150px] w-auto -mt-[58px]"
              />
            </div>
          </Link>
          <div className="flex items-center space-x-3">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 px-4 py-2 rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-20 pb-16 md:pt-28 md:pb-24">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5 text-sm text-neutral-700 mb-6">
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            Fast, simple, and secure
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 leading-tight">
            Sign documents
            <br />
            <span className="text-neutral-500">without the hassle</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Upload a PDF, add your signers, and get documents signed in minutes.
            No complicated setup, no learning curve.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 h-12 px-8 rounded-lg transition-colors w-full sm:w-auto"
            >
              Start signing for free
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 h-12 px-8 rounded-lg transition-colors w-full sm:w-auto"
            >
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">
            How it works
          </h2>
          <p className="text-gray-600 text-center mb-12 max-w-xl mx-auto">
            Three steps to get your documents signed
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Upload your document",
                description:
                  "Upload any PDF document and choose your signing mode — simple signature or positioned on the document.",
              },
              {
                step: "2",
                title: "Add your signers",
                description:
                  "Enter the names and emails of people who need to sign. They'll receive a secure link — no account needed.",
              },
              {
                step: "3",
                title: "Collect signatures",
                description:
                  "Signers draw their signature from any device. Once complete, download the fully signed PDF.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-white rounded-xl border border-gray-200 p-6"
              >
                <div className="w-9 h-9 rounded-full bg-neutral-900 text-white flex items-center justify-center text-sm font-bold mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 md:py-24">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">
            Everything you need
          </h2>
          <p className="text-gray-600 text-center mb-12 max-w-xl mx-auto">
            Built for individuals and teams who want document signing to just work
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: Shield,
                title: "Secure by default",
                description:
                  "Magic links with 48-hour expiry. Each signer gets a unique, time-limited signing token.",
              },
              {
                icon: Users,
                title: "No account required for signers",
                description:
                  "Your signers click a link and sign. They don't need to create an account or download anything.",
              },
              {
                icon: PenLine,
                title: "Two signing modes",
                description:
                  "Simple mode for quick signatures, or positioned mode to place signatures exactly where they belong on the PDF.",
              },
              {
                icon: Zap,
                title: "Sequential workflow",
                description:
                  "Signers are notified in order. The next signer gets their email only after the previous one completes.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="flex items-start space-x-4 rounded-xl border border-gray-200 p-6 hover:border-gray-300 transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center">
                  <feature.icon className="h-5 w-5 text-neutral-700" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to get started?
          </h2>
          <p className="text-gray-600 mb-8">
            Create your free account and send your first document for signing in
            under a minute.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 h-11 px-6 rounded-lg transition-colors"
            >
              Create free account
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </div>
          <div className="mt-6 flex items-center justify-center gap-6 text-sm text-gray-500">
            <span className="flex items-center">
              <CheckCircle2 className="h-4 w-4 mr-1.5 text-neutral-900" />
              Free to use
            </span>
            <span className="flex items-center">
              <CheckCircle2 className="h-4 w-4 mr-1.5 text-neutral-900" />
              No credit card
            </span>
            <span className="flex items-center">
              <CheckCircle2 className="h-4 w-4 mr-1.5 text-neutral-900" />
              Setup in seconds
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-6 py-8">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="overflow-hidden h-8">
            <Image
              src="/signrR_Logo_3-1.png"
              alt="SignrR"
              width={100}
              height={100}
              className="h-[100px] w-auto -mt-[42px]"
            />
          </div>
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} SignrR. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
