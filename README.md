# CodedSwitch Studio 🎵

A revolutionary AI-powered music creation platform that bridges the gap between coding and music composition. CodedSwitch embodies a triple entendre - representing code development, state switching, and adaptive communication - while providing professional music production capabilities powered by artificial intelligence.

## ✨ Features

### 🎼 AI-Powered Music Generation
- **Multi-Track Orchestral Composition**: AI creates arrangements across piano, guitar, violin, flute, trumpet, bass, and organ simultaneously
- **Intelligent Instrument Layering**: AI analyzes current arrangements and adds complementary instrumental parts
- **Realistic Instrument Sounds**: Professional General MIDI soundfonts for authentic instrument audio
- **Dynamic Music Styles**: Generate music in classical, jazz, blues, rock, electronic, folk, ambient, and more

### 🎹 MIDI Controller Support
- **Real-Time Hardware Input**: Connect MIDI keyboards, pad controllers, and drum machines
- **Channel-Based Instrument Mapping**: Different MIDI channels automatically map to different instruments
- **Velocity Sensitivity**: Note velocity controls volume and expression
- **Live Performance Mode**: Play CodedSwitch instruments directly with your hardware

### 🥁 Advanced Beat Creation
- **Professional Drum Synthesis**: Multi-layered kick drums, realistic snare with rattle simulation, shimmer hi-hats
- **Real-Time Pattern Editing**: Edit beats while they're playing with instant audio feedback
- **Visual Step Sequencer**: 16-step grid with individual sound controls and mixing
- **Comprehensive Drum Kit**: Kick, snare, hi-hat, clap, crash, tom sounds with authentic synthesis

### 🎵 Melody Composition Studio
- **Piano Roll Editor**: Drag-to-resize notes with snap-to-grid functionality
- **Multi-Track Support**: Compose across 8 instrument tracks simultaneously
- **Sustain Control**: Toggle between sustained and percussive note playback
- **Click-and-Hold Playback**: Intelligent note triggering with mousedown sustain behavior

### 🔧 Developer-Focused Tools
- **Code Translation**: Convert between programming languages with AI assistance
- **Code-to-Music**: Transform code structures into musical compositions
- **Security Scanner**: AI-powered vulnerability detection for your code
- **Pattern Recognition**: Analyze code patterns and generate corresponding musical elements

### 🎚️ Professional Studio Interface
- **Comprehensive Mixer**: Volume controls, muting, and track management
- **Song Upload & Analysis**: Upload existing audio files for AI analysis and integration
- **Dual Audio Modes**: Switch between realistic sampled sounds and synthesized audio
- **Export Capabilities**: Save and share your musical creations

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Modern web browser (Chrome, Edge, or Opera recommended for MIDI support)
- Optional: MIDI controller for hardware input

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/asume21/codetune-studio.git
   cd codetune-studio
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Add your API keys
   XAI_API_KEY=your_xai_api_key_here
   DATABASE_URL=your_postgresql_url_here
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open CodedSwitch Studio**
   Navigate to `http://localhost:5000` in your browser

## 🎛️ MIDI Controller Setup

### Connecting Your MIDI Device

1. **Connect your MIDI controller** via USB or MIDI interface
2. **Open CodedSwitch Studio** in Chrome, Edge, or Opera
3. **Navigate to MIDI Controller tab** in the sidebar
4. **Click "Connect MIDI Devices"** and grant permissions
5. **Start playing!** Your controller will trigger CodedSwitch instruments

### Channel Mapping

| MIDI Channel | Instrument |
|--------------|------------|
| 1 | Piano |
| 2 | Guitar |
| 3 | Bass |
| 4 | Violin |
| 5 | Flute |
| 6 | Trumpet |
| 7 | Organ |
| 8 | Synth |
| 10 | Drums |

Set your MIDI controller to different channels to play different instruments simultaneously.

## 🏗️ Architecture

### Frontend
- **React 18** with TypeScript for component-based UI
- **Vite** for fast development and optimized builds
- **Web Audio API** for real-time audio synthesis and processing
- **shadcn/ui** and **Tailwind CSS** for modern, responsive design
- **TanStack Query** for efficient server state management

### Backend
- **Express.js** RESTful API with TypeScript
- **PostgreSQL** with Drizzle ORM for type-safe database operations
- **xAI Grok integration** for advanced AI music generation
- **Multi-layered audio synthesis** for professional instrument sounds

### Audio Engine
- **Custom Web Audio implementation** with advanced synthesis
- **General MIDI soundfont support** for realistic instrument sounds
- **Real-time MIDI processing** via Web MIDI API
- **Multi-track composition** with simultaneous instrument playback

## 🎵 Studio Tools

### Beat Maker
Create professional drum patterns with multi-layered synthesis and real-time editing capabilities.

### Melody Composer
Compose melodies across multiple instrument tracks with piano roll editing and AI assistance.

### Code Translator
Convert code between programming languages with intelligent AI translation.

### Code to Music
Transform code structures into musical compositions, bridging programming and music theory.

### Dynamic Layering
AI-powered instrument layering that analyzes arrangements and adds complementary parts.

### Song Uploader
Upload and analyze existing audio files to integrate with your studio workflow.

### AI Assistant
Intelligent music composition help and creative guidance.

### Security Scanner
Analyze code for vulnerabilities while you compose.

### Lyric Lab
Write and edit song lyrics with AI assistance.

### Mixer
Professional mixing interface with comprehensive track controls.

## 🔧 API Integration

CodedSwitch integrates with xAI Grok for advanced AI capabilities:

- **Multi-track composition generation**
- **Intelligent instrument selection**
- **Style-aware music creation**
- **Code analysis and translation**
- **Creative assistance and suggestions**

## 🎯 Use Cases

### Music Producers
- Create professional beats and melodies
- Layer instruments intelligently with AI
- Use MIDI controllers for live performance
- Export compositions for further production

### Developers
- Convert code between languages
- Transform code into musical representations
- Scan for security vulnerabilities
- Bridge technical and creative workflows

### Musicians
- Compose with AI assistance
- Access realistic instrument sounds
- Perform live with MIDI controllers
- Experiment with new musical ideas

### Educators
- Teach music theory through code
- Demonstrate pattern recognition
- Explore the intersection of technology and music
- Create engaging educational content

## 🚀 Deployment

### Replit (Recommended)
The project is optimized for Replit deployment with automatic environment setup.

### Manual Deployment
1. Build the project: `npm run build`
2. Deploy to your preferred hosting platform
3. Set up PostgreSQL database
4. Configure environment variables
5. Start the production server

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -m 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **xAI Grok** for advanced AI music generation capabilities
- **Web Audio API** for browser-based audio processing
- **General MIDI** standard for realistic instrument sounds
- **Replit** platform for seamless development and deployment

## 📧 Support

For support, feature requests, or questions:
- Open an issue on GitHub
- Email: support@codedswitch.studio

---

**CodedSwitch Studio** - Where code meets creativity 🎵✨