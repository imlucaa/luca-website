"use client";

import { useEffect, useMemo, useState } from "react";

const gear = [
  { label: "Mouse", value: "op18k" },
  { label: "Mousepad", value: "Artisan Zero Soft" },
  { label: "Keyboard", value: "Nano 68 Pro" },
] as const;

const links = [
  { href: "https://github.com/imlucaa", label: "GitHub" },
  { href: "https://discord.com/users/1132691475830943744", label: "Discord" },
] as const;

const timeFormatter = new Intl.DateTimeFormat("en-AU", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Australia/Sydney",
});

export default function Home() {
  const [time, setTime] = useState("00:00:00");

  useEffect(() => {
    const updateTime = () => {
      setTime(timeFormatter.format(new Date()));
    };

    updateTime();
    const interval = window.setInterval(updateTime, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <main className="page-shell">
      <section className="hero-card panel span-8">
        <p className="eyebrow">Home</p>
        <div className="hero-copy">
          <div>
            <p className="hero-kicker">luca / ossed</p>
            <h1>Clean personal space, minus the extra integrations.</h1>
          </div>
          <p className="hero-text">
            Based in Australia. I like sharp UI, fast pages, and keeping my site
            focused on the parts that actually matter.
          </p>
        </div>
        <div className="hero-links">
          {links.map((link) => (
            <a
              className="button-link"
              href={link.href}
              key={link.href}
              rel="noopener noreferrer"
              target="_blank"
            >
              {link.label}
            </a>
          ))}
        </div>
      </section>

      <section className="panel stat-card span-4">
        <p className="eyebrow">Local Time</p>
        <p className="stat-value">{time}</p>
        <p className="stat-copy">Sydney, Australia</p>
      </section>

      <section className="panel span-4">
        <p className="eyebrow">Status</p>
        <h2 className="section-title">Building a smaller homepage.</h2>
        <p className="section-copy">
          This app version keeps the core landing page and drops the music,
          Steam, and other side sections.
        </p>
      </section>

      <section className="panel span-4">
        <p className="eyebrow">Focus</p>
        <ul className="stack-list">
          <li>Polished layouts over noisy widgets.</li>
          <li>Readable motion and strong typography.</li>
          <li>Fast page loads with a simple footprint.</li>
        </ul>
      </section>

      <section className="panel span-4">
        <p className="eyebrow">Gear</p>
        <div className="gear-list">
          {gear.map((item) => (
            <div className="gear-row" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel footer-card span-8">
        <p className="eyebrow">Notes</p>
        <p className="section-copy">
          {year} portfolio refresh for the new `app/` setup, styled to fit the
          cleaner Biome and Ultracite baseline.
        </p>
      </section>
    </main>
  );
}
