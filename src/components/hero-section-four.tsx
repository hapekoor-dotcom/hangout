/** Tailark — Copyright (c) 2025 Irung — MIT License. See vendor/tailark/LICENSE. */

import { EventOverload } from '@/components/event-overload'
import { Button } from '@/components/ui/button'
import { HeroHeader } from '@/components/header'


export default function HeroSection() {
    return (
        <>
            <HeroHeader />
            <main id="home">
                <section className="overflow-hidden">
                    <div className="pt-36 pb-20 md:pb-36">
                        <div className="relative z-10 mx-auto max-w-5xl px-6">
                            <div className="relative text-center">
                                <h1 className="mx-auto max-w-2xl text-balance text-4xl font-bold md:text-5xl">find something and <span className="brand-orange">someone</span> to do it with</h1>

                                <p className="text-muted-foreground mx-auto mt-4 mb-6 max-w-2xl text-balance text-xl">Games, music and chill people.</p>

                                <div className="flex flex-row items-center justify-center gap-3 *:min-w-0 *:flex-1 sm:*:flex-none">
                                    <Button
                                        asChild
                                        size="lg"
                                    >
                                        <a href="#hangout-preview" className="ticket-cta">
                                            <span className="text-nowrap">Get Tickets</span>
                                        </a>
                                    </Button>
                                    <Button
                                        key={2}
                                        asChild
                                        size="lg"
                                        variant="outline"
                                    >
                                        <a href="#hangout-formats" className="secondary-cta">
                                            <span className="text-nowrap">What to expect</span>
                                        </a>
                                    </Button>
                                </div>
                            </div>

                            <EventOverload />
                        </div>
                    </div>
                </section>
            </main>
        </>
    )
}
