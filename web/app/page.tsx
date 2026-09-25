import Image from "next/image";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { buttonClasses } from "@/components/ui/button";
import { IconArrowRight, IconCalendar, IconChat, IconInbox, IconShield } from "@/components/ui/icons";
import { PRODUCT_NAME } from "@/lib/brand";

const features = [
  { Icon: IconChat, title: "A little help with every hello.", body: "Your AI assistant answers from your house notes: Wi-Fi, parking, directions. Step into any conversation whenever you like." },
  { Icon: IconInbox, title: "Every guest. One inbox.", body: "Keep conversations across your properties in one place, with booking details close at hand." },
  { Icon: IconCalendar, title: "Make room for better planning.", body: "Manage availability, seasonal rates and blocked dates. Let guests see when your place is ready for them." },
  { Icon: IconShield, title: "The details, taken care of.", body: "Collect CNIC details through a private link for Hotel Eye records. Documents are deleted after 90 days at most." },
];

export default function Page() {
  return (
    <div className="marketing">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="landing-header">
        <Link href="/" aria-label={`${PRODUCT_NAME} home`}><Wordmark /></Link>
        <nav aria-label="Main" className="landing-nav">
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
          <a href="/login">Log in</a>
        </nav>
        <a href="/signup" className={buttonClasses("primary", "nav-cta")}>Get started <IconArrowRight /></a>
      </header>
      <main id="main">
        <section className="landing-hero">
          <Image src="/images/hunza-valley.jpg" alt="Homes in the Hunza valley beneath the Karakoram mountains" fill preload sizes="100vw" className="object-cover" />
          <div className="hero-shade" />
          <div className="hero-copy animate-rise">
            <p className="eyebrow">Made for Pakistani hosts</p>
            <h1>Your place.<br />Their next escape.</h1>
            <p className="hero-description">Your own booking page, happier guests, and more time for the hosting you love.</p>
            <a href="/signup" className={buttonClasses("primary", "hero-cta")}>Get started <IconArrowRight /></a>
          </div>
          <p className="hero-location">A little closer to Hunza.<br /><span>A little closer to your guests.</span></p>
        </section>

        <section className="intro-section section-wrap">
          <div className="intro-heading">
            <p className="eyebrow">A more personal way to host</p>
            <h2>Great stays begin<br />with a direct connection.</h2>
            <p>Turn the interest you get on Instagram and WhatsApp into bookings. {PRODUCT_NAME} brings your guesthouse, your guests and your day together.</p>
          </div>
          <div className="intro-note">
            <span className="large-figure">100%</span>
            <h3>Your guests. Your payments.</h3>
            <p>Guests pay you directly through your bank, Easypaisa or JazzCash. {PRODUCT_NAME} never holds guest money.</p>
            <a href="#how-it-works" className="text-link">How it works <IconArrowRight /></a>
          </div>
        </section>

        <section id="how-it-works" className="journey section-wrap">
          <div className="journey-image">
            <Image src="/images/guesthouse-cliff.jpg" alt="A guesthouse tucked into the mountains of Hunza" fill sizes="(min-width: 900px) 45vw, 100vw" className="object-cover" />
          </div>
          <div className="journey-copy">
            <h2>Less back and forth.<br />More welcome in.</h2>
            <p className="section-description">From the first question to the next check-in, keep it simple.</p>
            <ol className="journey-steps">
              <li><span>1</span><div><h3>Share one link</h3><p>Add your booking page to Instagram and WhatsApp. Guests don&apos;t need an account.</p></div></li>
              <li><span>2</span><div><h3>Let the conversation begin</h3><p>Guests ask questions and request dates. Your assistant helps with the everyday details.</p></div></li>
              <li><span>3</span><div><h3>Make it a stay</h3><p>You approve the booking. Guests pay you directly. All that&apos;s left is the welcome.</p></div></li>
            </ol>
          </div>
        </section>

        <section id="features" className="feature-section">
          <div className="section-wrap">
            <div className="feature-heading"><h2>A thoughtful host.<br />A little less on your plate.</h2><p>Everything behind the front desk, brought together.</p></div>
            <div className="feature-grid">
              {features.map(({ Icon, title, body }) => <article key={title}><span className="feature-icon"><Icon className="size-6" /></span><h3>{title}</h3><p>{body}</p></article>)}
            </div>
          </div>
        </section>

        <section className="closing section-wrap">
          <div className="closing-copy"><p className="eyebrow">Your next chapter</p><h2>Make yourself<br />at home.</h2><p>A name, an address and a nightly rate are enough to start. Make the rest your own as you go.</p><a href="/signup" className={buttonClasses("primary")}>Get started <IconArrowRight /></a></div>
          <div className="closing-image"><Image src="/images/karakoram-river.jpg" alt="A winding river through the Karakoram mountains" fill sizes="(min-width: 900px) 50vw, 100vw" className="object-cover" /></div>
        </section>
      </main>
      <footer className="landing-footer section-wrap"><Link href="/" aria-label={`${PRODUCT_NAME} home`}><Wordmark /></Link><p>Thoughtful hosting. Direct connections.</p><a href="/login">Log in <IconArrowRight /></a></footer>
    </div>
  );
}
