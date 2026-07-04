import React from "react";
import { Link } from "wouter";
import { Shield, ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
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
              <Shield className="h-8 w-8 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white uppercase">Privacy Policy</h1>
              <p className="text-xs text-cyan-400/70 font-semibold tracking-wider uppercase mt-1">Last Updated: July 4, 2026</p>
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
            <h2 className="text-lg font-bold text-white uppercase tracking-wider border-l-2 border-cyan-500 pl-3">1. Introduction</h2>
            <p>
              Welcome to CodedSwitch. We are committed to protecting your privacy and ensuring your creative work remains secure. This Privacy Policy explains how we collect, use, and safeguard your personal data and audio data when you use our online workstation, AI music generators, and community platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white uppercase tracking-wider border-l-2 border-cyan-500 pl-3">2. Information We Collect</h2>
            <p>We collect information to provide a highly personalized, intelligent music composition experience:</p>
            <ul className="list-disc pl-5 space-y-2 text-cyan-300/80">
              <li>
                <strong className="text-white">Account Information:</strong> When you sign up, we collect your email address, username, profile information, and subscription credentials.
              </li>
              <li>
                <strong className="text-white">Audio & Voice Input (React-to-Voice):</strong> If you enable microphone access for voice-reactive features, we capture temporary audio feeds. <span className="text-cyan-400 font-semibold">Important:</span> Voice inputs are processed transiently in your browser session for live parameters (like cadence and volume ducking) and are not stored permanently on our servers.
              </li>
              <li>
                <strong className="text-white">Composition Data:</strong> We store settings, parameters, custom scales, and saved loops associated with your project DNA so you can resume editing across sessions.
              </li>
              <li>
                <strong className="text-white">Telemetry & Analytics:</strong> Standard usage data, browser type, device information, and interaction records are tracked to optimize system performance and prevent abuse.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white uppercase tracking-wider border-l-2 border-cyan-500 pl-3">3. How We Use Your Information</h2>
            <p>Your data is processed to deliver and improve our workstation services, specifically to:</p>
            <ul className="list-disc pl-5 space-y-2 text-cyan-300/80">
              <li>Render dynamic, high-fidelity AI accompaniment tailored to your voice or vibe.</li>
              <li>Maintain and sync your studio settings, presets, and customized composition plans.</li>
              <li>Process billing, credits purchases, and manage subscription access tiers.</li>
              <li>Deliver community interactions, allowing you to showcase and share finished songs on the Social Hub.</li>
              <li>Monitor API performance, identify bugs, and ensure the security of the workstation.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white uppercase tracking-wider border-l-2 border-cyan-500 pl-3">4. Cookies & Local Storage</h2>
            <p>
              We utilize cookies and HTML5 local storage to preserve your workflow environment. This includes retaining your layout preferences, caching multisampled instrument configuration tables, keeping you securely logged in, and saving your active loop package downloads.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white uppercase tracking-wider border-l-2 border-cyan-500 pl-3">5. Data Sharing & Security</h2>
            <p>
              We do not sell, rent, or trade your personal or audio data. Information is only shared with third-party service providers (such as Stripe for payment processing) to the extent necessary to deliver the service. We implement industry-standard SSL/TLS encryption, secure database access protocols, and firewall rules to guard your projects against unauthorized access.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white uppercase tracking-wider border-l-2 border-cyan-500 pl-3">6. Your Rights & Data Control</h2>
            <p>
              You have full control over your creative portfolio. Through your Account Settings panel, you can update your credentials, adjust audio tracking options, or request the permanent deletion of your account and all associated composition records.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white uppercase tracking-wider border-l-2 border-cyan-500 pl-3">7. Contact Us</h2>
            <p>
              If you have any questions regarding this Privacy Policy or your data controls, please contact our privacy compliance team at <span className="text-cyan-400 font-semibold">support@codedswitch.com</span>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-cyan-500/50 font-bold uppercase tracking-widest">
          © 2026 CodedSwitch. All Rights Reserved.
        </div>
      </div>
    </div>
  );
}
