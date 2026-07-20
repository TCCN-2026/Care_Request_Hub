import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { appSettings } from "@/lib/settings";

const steps = [
  {
    title: "Post your request anonymously",
    body: "Tell us what your business needs. Your organisation's identity stays private until you choose to reveal it.",
  },
  {
    title: "The Care Connector Network reviews it",
    body: "An admin checks the request before it goes live, so suppliers only ever see approved, well-formed requests.",
  },
  {
    title: "Matched suppliers respond",
    body: "Only verified suppliers covering your area and category can see and reply to the anonymous version of your request.",
  },
  {
    title: "You choose who to meet",
    body: "Compare responses, shortlist the ones you like, and request an introduction. Contact details are shared only once approved.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight text-zinc-900">
            {appSettings.productName}
          </span>
          <nav className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Sign up</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
            {appSettings.tagline}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-600">
            A protected space for care providers to source business products and services, and
            for verified suppliers to respond to the requests that actually match what they offer.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/signup?type=care_provider">I&apos;m a care provider</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/signup?type=supplier">I&apos;m a supplier</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-zinc-500">{appSettings.poweredByLine}</p>
        </section>

        <section className="border-t bg-zinc-50 py-16">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-2xl font-semibold text-zinc-900">How it works</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => (
                <Card key={step.title}>
                  <CardHeader>
                    <span className="text-sm font-medium text-zinc-500">Step {index + 1}</span>
                    <CardTitle className="text-base">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-zinc-600">{step.body}</CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 py-16 text-center">
          <p className="text-sm text-zinc-500">
            {appSettings.organisationName} hosts the request and introduction process. It is not
            the buyer or seller and does not guarantee the quality, price, delivery or suitability
            of any supplier, service or product.
          </p>
        </section>
      </main>

      <footer className="border-t bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 text-sm text-zinc-500 sm:flex-row">
          <span>
            &copy; {new Date().getFullYear()} {appSettings.organisationName}
          </span>
          <a href={`mailto:${appSettings.supportEmail}`} className="hover:text-zinc-700">
            {appSettings.supportEmail}
          </a>
        </div>
      </footer>
    </div>
  );
}
