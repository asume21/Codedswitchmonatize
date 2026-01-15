import React from 'react';
import { Link } from 'wouter';

export default function SitemapPage() {
  const sections = [
    {
      title: 'Core Pages',
      description: 'Main application pages and entry points',
      links: [
        { href: '/', label: 'Home / Landing' },
        { href: '/home', label: 'Home (alt)' },
        { href: '/login', label: 'Login' },
        { href: '/signup', label: 'Sign Up' },
        { href: '/activate', label: 'Activate Account' },
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/settings', label: 'Settings' },
        { href: '/sitemap', label: 'Sitemap (this page)' },
      ],
    },
    {
      title: 'Studio & Music Tools',
      description: 'Music creation, production, and analysis tools',
      links: [
        { href: '/studio', label: 'Unified Studio Workspace' },
        { href: '/lyric-lab', label: 'Lyric Lab (Lyrics Tab)' },
      ],
    },
    {
      title: 'AI & Tools',
      description: 'AI-powered features and utilities',
      links: [
        { href: '/ai-assistant', label: 'AI Assistant' },
        { href: '/vulnerability-scanner', label: 'Vulnerability Scanner' },
      ],
    },
    {
      title: 'Social & Community',
      description: 'User profiles and social features',
      links: [
        { href: '/social-hub', label: 'Social Hub' },
        { href: '/profile', label: 'User Profile' },
        { href: '/s/:id', label: 'Public Song Page' },
      ],
    },
    {
      title: 'Billing & Credits',
      description: 'Subscription and credit management',
      links: [
        { href: '/subscribe', label: 'Subscribe' },
        { href: '/billing', label: 'Billing' },
        { href: '/buy-credits', label: 'Buy Credits' },
        { href: '/credits', label: 'Credits (alt)' },
        { href: '/credits/success', label: 'Credits Purchase Success' },
        { href: '/credits/cancel', label: 'Credits Purchase Cancel' },
      ],
    },
    {
      title: 'Technical',
      description: 'Technical and utility endpoints',
      links: [
        { href: '/sitemap.xml', label: 'SEO Sitemap (XML)', external: true },
        { href: '/api/health', label: 'Health Check API', external: true },
      ],
    },
  ] as const;

  return (
    <div className="min-h-screen bg-black/95 text-cyan-100 astutely-app astutely-scanlines astutely-grid-bg p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12">
          <h1 className="text-4xl font-black text-white mb-4">Sitemap</h1>
          <p className="text-cyan-200/70 text-lg">
            Navigate all pages and features of CodedSwitch
          </p>
        </header>

        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3">
          {sections.map((section, idx) => (
            <section key={idx} className="relative">
              <div className="absolute inset-0 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 backdrop-blur-sm shadow-[0_0_25px_rgba(6,182,212,0.08)]" />
              <div className="relative p-6">
                <h2 className="text-xl font-black text-white mb-2">{section.title}</h2>
                <p className="text-cyan-200/60 text-sm mb-6">{section.description}</p>
                <ul className="space-y-2">
                  {section.links.map((link, linkIdx) => (
                    <li key={linkIdx}>
                      {'external' in link ? (
                        <a
                          href={link.href}
                          className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-100 transition-colors text-sm font-medium"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {link.label}
                          <span className="text-cyan-400/40 text-xs">↗</span>
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-100 transition-colors text-sm font-medium"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-16 pt-8 border-t border-cyan-500/20">
          <div className="text-center text-cyan-200/50 text-sm">
            <p>
              Can't find what you're looking for?{' '}
              <Link href="/studio" className="text-cyan-300 hover:text-cyan-100">
                Visit the Studio
              </Link>{' '}
              or{' '}
              <Link href="/dashboard" className="text-cyan-300 hover:text-cyan-100">
                check your Dashboard
              </Link>.
            </p>
            <p className="mt-2">
              <Link href="/" className="text-cyan-300 hover:text-cyan-100">
                ← Back to Home
              </Link>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
