import Hero from "@/components/Hero"
import Intro from "@/components/Intro"
import Pillars from "@/components/Pillars"
import Portfolio from "@/components/Portfolio"
import Results from "@/components/Results"
import CtaBanner from "@/components/CtaBanner"
import MobileActionBar from "@/components/MobileActionBar"

export default function MarketingSitePage() {
  return (
    <main>
      <Hero />
      <Intro />
      <Pillars />
      <Portfolio />
      <Results />
      <CtaBanner />
      <MobileActionBar />
    </main>
  )
}
