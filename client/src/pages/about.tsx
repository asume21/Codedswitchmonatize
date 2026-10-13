import React from "react";
import { Link } from "wouter";
import { Building2, ArrowLeft, Mail } from "lucide-react";
import { COMPANY, companyDisplayName } from "@/lib/company";

export default function AboutPage() {
  return (
    <div className="min-h-screen w-full bg-black/95 text-cyan-100 px-6 py-12 flex flex-col items-center overflow-y-auto astutely-scrollbar">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-4xl relative z-10">
        {/* Header and Back Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-cyan-500/20 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              <Building2 className="h-8 w-8 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white uppercase">About {COMPANY.brandName}</h1>
              <p className="text-xs text-cyan-400/70 font-semibold tracking-wider uppercase mt-1">Who we are and how to reach us</p>
            </div>
          </div>
          <Link href="/">
            <a className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/15 text-xs font-black uppercase tracking-wider text-cyan-300 transition-all cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </a>
          </Link>
        </div>

        {/* Content Card */}
        <div className="rounded-2xl border border-cyan-500/25 bg-black/70 backdrop-blur-xl p-8 md:p-12 shadow-[0_0_30px_rgba(6,182,212,0.15)] space-y-8 text-cyan-200/80 leading-relaxed text-sm">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white uppercase tracking-wider border-l-2 border-cyan-500 pl-3">What We Build</h2>
            <p>
              {COMPANY.brandName} Studio is a browser-based AI music workstation. Producers make beats, write melodies and lyrics, mix, master and share songs in one place — with Organism, our real-time generative band, and Astutely, our AI production assistant.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white uppercase tracking-wider border-l-2 border-cyan-500 pl-3">Company</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-x-6 gap-y-2">
              {COMPANY.legalName && (
                <>
                  <dt className="text-cyan-400/70 font-semibold uppercase text-xs tracking-wider pt-0.5">Legal name</dt>
                  <dd className="text-white">{COMPANY.legalName}</dd>
                </>
              )}
              <dt className="text-cyan-400/70 font-semibold uppercase text-xs tracking-wider pt-0.5">Founder</dt>
              <dd className="text-white">{COMPANY.founder}</dd>
              <dt className="text-cyan-400/70 font-semibold uppercase text-xs tracking-wider pt-0.5">Website</dt>
              <dd className="text-white">{COMPANY.website.replace(/^https?:\/\//, "")}</dd>
            </dl>
          </section>

          <section className="space-y-3" id="contact">
            <h2 className="text-lg font-bold text-white uppercase tracking-wider border-l-2 border-cyan-500 pl-3">Contact Support</h2>
            <p>
              Questions about your account, billing, credits or anything else — email us and a real person will answer.
            </p>
            <a
              href={`mailto:${COMPANY.contactEmail}`}
              className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-semibold transition-all"
            >
              <Mail className="w-4 h-4" />
              {COMPANY.contactEmail}
            </a>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-cyan-500/50 font-bold uppercase tracking-widest">
          © 2026 {companyDisplayName}. All Rights Reserved.
        </div>
      </div>
    </div>
  );
}
