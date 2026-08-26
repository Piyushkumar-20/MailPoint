import { AiActionLayer } from "@/components/landing/ai-action-layer";
import { Architecture } from "@/components/landing/architecture";
import { CoreExperience } from "@/components/landing/core-experience";
import { EmailCalendar } from "@/components/landing/email-calendar";
import { FinalCta } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { KeyboardSection } from "@/components/landing/keyboard-section";
import { LandingNavbar } from "@/components/landing/navbar";
import { Problem } from "@/components/landing/problem";
import { RealtimeSection } from "@/components/landing/realtime-section";
import { SearchSection } from "@/components/landing/search-section";
import { Security } from "@/components/landing/security";

export function LandingPage() {
  return (
    <div className="bg-[#08080B]">
      <LandingNavbar />
      <main>
        <Hero />
        <Problem />
        <CoreExperience />
        <EmailCalendar />
        <AiActionLayer />
        <SearchSection />
        <RealtimeSection />
        <KeyboardSection />
        <Architecture />
        <Security />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
