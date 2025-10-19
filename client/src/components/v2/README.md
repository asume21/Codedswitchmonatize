# CodedSwitch V2 Design System

This directory contains the redesigned components for CodedSwitch using the new design system.

## 🎨 Design Philosophy

- **Creative Momentum**: Smooth workflows that keep users creating
- **Professional Credibility**: Dark theme with electric accents
- **AI Augmentation**: Highlighted, approachable AI features
- **Community Focus**: Social features integrated throughout

## 📁 Structure

```
v2/
├── ui/           # Base components (Button, Input, Card, etc.)
├── layout/       # Page layouts (Hero, Navigation, Footer)
├── studio/       # Studio-specific components (PianoRoll, BeatMaker)
└── social/       # Community features
```

## 🚀 Usage

### Using Feature Flags

Components can be enabled/disabled via feature flags:

```typescript
import { FEATURES } from '@/config/features';
import HeroV1 from '@/components/studio/Hero';
import HeroV2 from '@/components/v2/layout/Hero';

export default function Home() {
  const Hero = FEATURES.useNewHero ? HeroV2 : HeroV1;
  return <Hero />;
}
```

### Environment Variables

Create `.env.local` and enable features:

```bash
# Enable new hero
VITE_USE_NEW_HERO=true

# Enable all v2 features
VITE_USE_V2_DESIGN=true
```

## 🎨 Design Tokens

All design tokens are defined in `/styles/design-tokens.css`:

- **Colors**: Dark base (#0A0F1B) + electric accents (#7B61FF, #00E0C6)
- **Typography**: Inter/Space Grotesk (body), Satoshi (display)
- **Spacing**: 4px base scale
- **Motion**: Smooth easing with audio-reactive states

## 📦 Components

### UI Components

- **Button**: Multiple variants, sizes, with glow/gradient effects
- _(More components coming soon)_

### Layout Components

- **Hero**: Cinematic landing with particle effects
- _(More layouts coming soon)_

## 🧪 Testing Locally

1. Create `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Enable features you want to test:
   ```bash
   VITE_USE_NEW_HERO=true
   ```

3. Start dev server:
   ```bash
   npm run dev
   ```

4. See changes at `http://localhost:5173`

## 🔄 Migration Strategy

1. Build v2 component alongside v1
2. Test locally with feature flags
3. Merge to main (flags OFF)
4. Gradually enable in production
5. Monitor and iterate
6. Remove v1 once stable

## 🎯 Roadmap

- [x] Design tokens
- [x] Feature flag system
- [x] Button component
- [x] Hero component
- [ ] Navigation
- [ ] Studio Dashboard
- [ ] Piano Roll
- [ ] Beat Maker
- [ ] AI Copilot
- [ ] Social Hub

## 🤝 Contributing

When adding v2 components:

1. Follow design token system
2. Add feature flag
3. Include accessibility features
4. Test responsiveness
5. Document usage
