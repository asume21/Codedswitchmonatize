/**
 * Advanced Lyric Analysis Service
 * Integrates sophisticated linguistic analysis with AI-powered insights
 * Based on MusicLyricAI but enhanced for CodedSwitch
 */

import natural from 'natural';
import { SentimentAnalyzer, PorterStemmer } from 'natural';
import { syllable } from 'syllable';
import { makeAICall } from './grok';

interface LyricAnalysis {
  basic_stats: {
    line_count: number;
    word_count: number;
    unique_word_count: number;
    sentence_count: number;
    avg_words_per_line: number;
    avg_syllables_per_line: number;
  };
  rhyme_scheme: string;
  syllable_analysis: {
    avg_syllables: number;
    syllable_counts: number[];
    syllable_pattern: string;
  };
  sentiment: {
    vader_compound: number;
    vader_positive: number;
    vader_negative: number;
    vader_neutral: number;
    textblob_polarity: number;
    textblob_subjectivity: number;
  };
  lexical_diversity: number;
  quality_score: number;
  themes: Array<{ theme: string; confidence: number }>;
  flow_analysis: {
    rhythm_consistency: number;
    cadence_variety: number;
    breath_control: number;
  };
  vocabulary_analysis: {
    complexity_score: number;
    poetic_devices: string[];
    imagery_score: number;
  };
}

interface AIEnhancedAnalysis extends LyricAnalysis {
  ai_insights: {
    vocal_delivery: string;
    musical_suggestions: string[];
    production_notes: string[];
    genre_recommendations: string[];
    improvement_areas: Array<{
      area: string;
      priority: 'high' | 'medium' | 'low';
      suggestion: string;
    }>;
  };
  overall_rating: {
    score: number;
    strengths: string[];
    weaknesses: string[];
    commercial_potential: number;
  };
}

class AdvancedLyricAnalyzer {
  private sentimentAnalyzer: any;
  private tokenizer: any;
  private stemmer: any;

  // Theme keywords for detection
  private themeKeywords = {
    love: ['love', 'heart', 'baby', 'darling', 'kiss', 'hug', 'romance', 'forever', 'together'],
    heartbreak: ['break', 'hurt', 'pain', 'cry', 'tears', 'lonely', 'miss', 'goodbye', 'broken'],
    party: ['party', 'dance', 'celebrate', 'fun', 'night', 'drink', 'turn up', 'club', 'music'],
    success: ['win', 'success', 'rise', 'top', 'king', 'queen', 'champion', 'victory', 'achieve'],
    struggle: ['fight', 'war', 'battle', 'pain', 'hard', 'struggle', 'hustle', 'grind', 'overcome'],
    freedom: ['free', 'fly', 'wind', 'run', 'wild', 'untamed', 'roam', 'escape', 'liberty'],
    nostalgia: ['remember', 'back', 'old', 'days', 'times', 'memories', 'past', 'yesterday', 'reminisce'],
    confidence: ['strong', 'power', 'unstoppable', 'legend', 'boss', 'king', 'queen', 'win', 'conquer'],
    spirituality: ['soul', 'god', 'pray', 'bless', 'divine', 'spirit', 'faith', 'heaven', 'angel'],
    urban: ['streets', 'city', 'hood', 'block', 'concrete', 'grind', 'hustle', 'real', 'raw'],
    luxury: ['money', 'rich', 'gold', 'diamonds', 'fancy', 'expensive', 'wealth', 'success', 'glamour']
  };

  // Poetic devices detection patterns
  private poeticPatterns = {
    alliteration: /\b([a-zA-Z])\w*\s+\1\w*\b/gi,
    assonance: /\b\w*([aeiou])\w*\s+\w*\1\w*\b/gi,
    metaphor: /\b(is|are|was|were)\s+(a|an|the)\s+\w+/gi,
    simile: /\b(like|as)\s+\w+/gi,
    repetition: /(\b\w+\b)(?=.*\1)/gi,
    imagery: /\b(see|look|watch|feel|touch|hear|sound|smell|taste)\b/gi
  };

  constructor() {
    // Initialize natural language processing
    this.sentimentAnalyzer = new SentimentAnalyzer('English', 
      PorterStemmer, 'afinn');
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = PorterStemmer;
  }

  /**
   * Clean and preprocess lyrics
   */
  private cleanText(text: string): string {
    return text
      .toLowerCase()
      .replace(/\[.*?\]/g, '') // Remove section labels
      .replace(/[^\w\s']/g, ' ') // Keep apostrophes for contractions
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Advanced rhyme scheme detection
   */
  private getRhymeScheme(lines: string[]): string[] {
    const cleanLines = lines.filter(line => line.trim());
    const lastWords = cleanLines.map(line => {
      const words = line.trim().split(/\s+/);
      return words[words.length - 1].replace(/[^a-zA-Z]/g, '').toLowerCase();
    });

    const rhymeGroups: { [key: string]: string[] } = {};
    const scheme: string[] = [];
    let nextLetter = 65; // ASCII 'A'

    for (const word of lastWords) {
      let found = false;
      
      // Check if word rhymes with existing group
      for (const [letter, wordsInGroup] of Object.entries(rhymeGroups)) {
        if (this.wordsRhyme(word, wordsInGroup[0])) {
          rhymeGroups[letter].push(word);
          scheme.push(letter);
          found = true;
          break;
        }
      }

      if (!found) {
        const letter = String.fromCharCode(nextLetter++);
        rhymeGroups[letter] = [word];
        scheme.push(letter);
      }
    }

    return scheme;
  }

  /**
   * Check if two words rhyme
   */
  private wordsRhyme(word1: string, word2: string): boolean {
    // Simple rhyme detection - can be enhanced with pronunciation dictionary
    const minLen = Math.min(word1.length, word2.length);
    if (minLen < 2) return false;

    // Check last 2-3 characters
    const suffix1 = word1.slice(-Math.min(3, minLen));
    const suffix2 = word2.slice(-Math.min(3, minLen));
    
    return suffix1 === suffix2 && word1 !== word2;
  }

  /**
   * Count syllables in a word
   */
  private countSyllables(word: string): number {
    try {
      return syllable(word) || 1;
    } catch {
      // Fallback syllable counting
      const vowels = 'aeiouy';
      let count = 0;
      let prevWasVowel = false;

      for (let i = 0; i < word.length; i++) {
        const isVowel = vowels.includes(word[i].toLowerCase());
        if (isVowel && !prevWasVowel) {
          count++;
        }
        prevWasVowel = isVowel;
      }

      // Adjust for silent 'e'
      if (word.toLowerCase().endsWith('e') && count > 1) {
        count--;
      }

      return Math.max(1, count);
    }
  }

  /**
   * Analyze sentiment using multiple methods
   */
  private analyzeSentiment(text: string): LyricAnalysis['sentiment'] {
    const tokens = this.tokenizer.tokenize(text.toLowerCase()) || [];
    
    // VADER-style sentiment (simplified)
    const positiveWords = ['love', 'happy', 'joy', 'good', 'great', 'amazing', 'wonderful', 'beautiful'];
    const negativeWords = ['hate', 'sad', 'pain', 'bad', 'terrible', 'awful', 'horrible', 'ugly'];
    
    const positiveCount = tokens.filter((word: string) => positiveWords.includes(word)).length;
    const negativeCount = tokens.filter((word: string) => negativeWords.includes(word)).length;
    const totalWords = tokens.length;

    const vaderPositive = positiveCount / totalWords;
    const vaderNegative = negativeCount / totalWords;
    const vaderNeutral = 1 - vaderPositive - vaderNegative;
    const vaderCompound = vaderPositive - vaderNegative;

    // TextBlob-style sentiment (simplified)
    const textblobPolarity = vaderCompound;
    const textblobSubjectivity = Math.random() * 0.5 + 0.3; // Placeholder

    return {
      vader_compound: vaderCompound,
      vader_positive: vaderPositive,
      vader_negative: vaderNegative,
      vader_neutral: vaderNeutral,
      textblob_polarity: textblobPolarity,
      textblob_subjectivity: textblobSubjectivity
    };
  }

  /**
   * Detect themes in lyrics
   */
  private detectThemes(text: string): Array<{ theme: string; confidence: number }> {
    const words = new Set(this.tokenizer.tokenize(text.toLowerCase()) || []);
    const themeScores: Array<{ theme: string; confidence: number }> = [];

    for (const [theme, keywords] of Object.entries(this.themeKeywords)) {
      const matches = keywords.filter(keyword => words.has(keyword)).length;
      const score = matches / keywords.length;
      
      if (score > 0) {
        themeScores.push({
          theme,
          confidence: Math.min(1.0, score * 2)
        });
      }
    }

    return themeScores
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  /**
   * Detect poetic devices
   */
  private detectPoeticDevices(text: string): string[] {
    const devices: string[] = [];

    for (const [device, pattern] of Object.entries(this.poeticPatterns)) {
      if (pattern.test(text)) {
        devices.push(device);
      }
    }

    return devices;
  }

  /**
   * Analyze flow and rhythm
   */
  private analyzeFlow(lines: string[]): LyricAnalysis['flow_analysis'] {
    const syllableCounts = lines.map(line => 
      line.split(/\s+/).reduce((sum, word) => sum + this.countSyllables(word), 0)
    );

    // Calculate rhythm consistency
    const avgSyllables = syllableCounts.reduce((a, b) => a + b, 0) / syllableCounts.length;
    const variance = syllableCounts.reduce((sum, count) => 
      sum + Math.pow(count - avgSyllables, 2), 0) / syllableCounts.length;
    const rhythmConsistency = Math.max(0, 1 - (variance / Math.pow(avgSyllables, 2)));

    // Cadence variety (based on syllable pattern variation)
    const uniquePatterns = new Set(syllableCounts.map(c => c.toString())).size;
    const cadenceVariety = Math.min(1, uniquePatterns / syllableCounts.length);

    // Breath control (based on average syllables per line)
    const breathControl = Math.max(0, Math.min(1, 1 - Math.abs(avgSyllables - 12) / 12));

    return {
      rhythm_consistency: rhythmConsistency,
      cadence_variety: cadenceVariety,
      breath_control: breathControl
    };
  }

  /**
   * Calculate vocabulary complexity
   */
  private analyzeVocabulary(text: string): LyricAnalysis['vocabulary_analysis'] {
    const words = this.tokenizer.tokenize(text.toLowerCase()) || [];
    const uniqueWords = new Set(words);
    
    // Complexity based on word length and uniqueness
    const avgWordLength = words.reduce((sum: number, word: string) => sum + word.length, 0) / words.length;
    const lexicalDiversity = uniqueWords.size / words.length;
    const complexityScore = (avgWordLength / 10) * lexicalDiversity;

    const poeticDevices = this.detectPoeticDevices(text);
    
    // Imagery score based on sensory words
    const imageryWords = /\b(see|look|watch|feel|touch|hear|sound|smell|taste|bright|dark|warm|cold)\b/gi;
    const imageryMatches = (text.match(imageryWords) || []).length;
    const imageryScore = Math.min(1, imageryMatches / words.length * 10);

    return {
      complexity_score: Math.min(1, complexityScore),
      poetic_devices: poeticDevices,
      imagery_score: imageryScore
    };
  }

  /**
   * Calculate quality score
   */
  private calculateQualityScore(
    rhymeScheme: string[],
    syllableCounts: number[],
    sentiment: LyricAnalysis['sentiment'],
    lexicalDiversity: number,
    flow: LyricAnalysis['flow_analysis'],
    vocabulary: LyricAnalysis['vocabulary_analysis']
  ): number {
    // Rhyme consistency (0-15 points)
    const rhymeVariety = new Set(rhymeScheme).size / rhymeScheme.length;
    const rhymeScore = (1 - rhymeVariety) * 15;

    // Syllable consistency (0-15 points)
    const syllableStd = Math.sqrt(syllableCounts.reduce((sum, count) => 
      sum + Math.pow(count - (syllableCounts.reduce((a, b) => a + b, 0) / syllableCounts.length), 2), 0) / syllableCounts.length);
    const syllableScore = Math.max(0, 15 - syllableStd);

    // Sentiment strength (0-10 points)
    const sentimentScore = Math.abs(sentiment.vader_compound) * 10;

    // Lexical diversity (0-10 points)
    const diversityScore = lexicalDiversity * 10;

    // Flow and rhythm (0-25 points)
    const flowScore = (flow.rhythm_consistency + flow.cadence_variety + flow.breath_control) * 8.33;

    // Vocabulary and poetic devices (0-25 points)
    const vocabScore = (vocabulary.complexity_score + vocabulary.imagery_score) * 12.5 + 
                       vocabulary.poetic_devices.length * 2;

    const totalScore = rhymeScore + syllableScore + sentimentScore + 
                      diversityScore + flowScore + vocabScore;

    return Math.min(100, Math.max(0, totalScore));
  }

  /**
   * Analyze lyrics with comprehensive metrics
   */
  public analyzeLyrics(lyrics: string): LyricAnalysis {
    if (!lyrics.trim()) {
      throw new Error("Empty lyrics provided");
    }

    const cleanedLyrics = this.cleanText(lyrics);
    const lines = lyrics.split('\n').filter(line => line.trim());
    const words = this.tokenizer.tokenize(cleanedLyrics) || [];
    const sentences = lyrics.match(/[^.!?]+[.!?]+/g) || [];

    // Basic statistics
    const basicStats = {
      line_count: lines.length,
      word_count: words.length,
      unique_word_count: new Set(words).size,
      sentence_count: sentences.length,
      avg_words_per_line: words.length / lines.length,
      avg_syllables_per_line: 0
    };

    // Rhyme scheme
    const rhymeScheme = this.getRhymeScheme(lines);

    // Syllable analysis
    const syllableCounts = lines.map(line => 
      line.split(/\s+/).reduce((sum, word) => sum + this.countSyllables(word), 0)
    );
    basicStats.avg_syllables_per_line = syllableCounts.reduce((a, b) => a + b, 0) / syllableCounts.length;

    const syllableAnalysis = {
      avg_syllables: basicStats.avg_syllables_per_line,
      syllable_counts: syllableCounts,
      syllable_pattern: syllableCounts.join('-')
    };

    // Sentiment analysis
    const sentiment = this.analyzeSentiment(cleanedLyrics);

    // Lexical diversity
    const lexicalDiversity = basicStats.unique_word_count / basicStats.word_count;

    // Flow analysis
    const flowAnalysis = this.analyzeFlow(lines);

    // Vocabulary analysis
    const vocabularyAnalysis = this.analyzeVocabulary(cleanedLyrics);

    // Theme detection
    const themes = this.detectThemes(cleanedLyrics);

    // Quality score
    const qualityScore = this.calculateQualityScore(
      rhymeScheme,
      syllableCounts,
      sentiment,
      lexicalDiversity,
      flowAnalysis,
      vocabularyAnalysis
    );

    return {
      basic_stats: basicStats,
      rhyme_scheme: rhymeScheme.join(''),
      syllable_analysis: syllableAnalysis,
      sentiment,
      lexical_diversity: lexicalDiversity,
      quality_score: qualityScore,
      themes,
      flow_analysis: flowAnalysis,
      vocabulary_analysis: vocabularyAnalysis
    };
  }

  /**
   * Enhance analysis with AI insights
   */
  public async enhanceWithAI(
    analysis: LyricAnalysis,
    lyrics: string,
    genre: string = 'unknown'
  ): Promise<AIEnhancedAnalysis> {
    
    try {
      const prompt = `As a professional music producer and vocal coach, analyze these lyrics and provide detailed insights:

LYRICS:
${lyrics}

CURRENT ANALYSIS:
- Quality Score: ${analysis.quality_score}/100
- Rhyme Scheme: ${analysis.rhyme_scheme}
- Themes: ${analysis.themes.map(t => t.theme).join(', ')}
- Sentiment: ${analysis.sentiment.vader_compound > 0 ? 'Positive' : 'Negative'}
- Genre: ${genre}

Provide a comprehensive analysis in JSON format:
{
  "vocal_delivery": "Describe ideal vocal delivery style (aggressive, melodic, laid-back, etc.)",
  "musical_suggestions": ["3-4 specific musical suggestions for instrumentation"],
  "production_notes": ["2-3 production tips for mixing/mastering"],
  "genre_recommendations": ["2-3 genres that would fit these lyrics"],
  "improvement_areas": [
    {
      "area": "Specific area needing improvement",
      "priority": "high|medium|low",
      "suggestion": "Concrete suggestion for improvement"
    }
  ]
}

Focus on actionable, professional advice that would help an artist improve and produce these lyrics.`;

      const response = await makeAICall([
        {
          role: 'system',
          content: 'You are a Grammy-winning music producer and vocal coach with 20+ years of experience. Provide detailed, actionable advice for artists.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        response_format: { type: "json_object" },
        temperature: 0.7
      });

      const aiContent = response.choices[0].message.content || "{}";
      
      // Parse AI response
      let aiInsights;
      try {
        aiInsights = JSON.parse(aiContent);
      } catch {
        // Fallback to regex extraction if strict JSON fails (though makeAICall asks for JSON)
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        aiInsights = jsonMatch ? JSON.parse(jsonMatch[0]) : this.getDefaultAIInsights();
      }

      return {
        ...analysis,
        ai_insights: aiInsights,
        overall_rating: {
          score: analysis.quality_score,
          strengths: this.identifyStrengths(analysis),
          weaknesses: this.identifyWeaknesses(analysis),
          commercial_potential: Math.min(10, analysis.quality_score / 10 + 
            (aiInsights.musical_suggestions?.length || 0) * 0.5)
        }
      };

    } catch (error) {
      console.error('AI enhancement failed:', error);
      // Fallback to basic analysis without AI
      return {
        ...analysis,
        ai_insights: this.getDefaultAIInsights(),
        overall_rating: {
          score: analysis.quality_score,
          strengths: this.identifyStrengths(analysis),
          weaknesses: this.identifyWeaknesses(analysis),
          commercial_potential: Math.min(10, analysis.quality_score / 10)
        }
      };
    }
  }


  private identifyStrengths(analysis: LyricAnalysis): string[] {
    const strengths: string[] = [];
    
    if (analysis.quality_score >= 80) strengths.push("Overall high quality lyrics");
    if (analysis.lexical_diversity >= 0.7) strengths.push("Rich vocabulary and word choice");
    if (analysis.flow_analysis.rhythm_consistency >= 0.8) strengths.push("Consistent rhythm and flow");
    if (analysis.themes.length >= 2) strengths.push("Strong thematic development");
    if (analysis.vocabulary_analysis.poetic_devices.length >= 3) strengths.push("Creative use of poetic devices");
    if (Math.abs(analysis.sentiment.vader_compound) >= 0.5) strengths.push("Strong emotional expression");
    
    return strengths;
  }

  private identifyWeaknesses(analysis: LyricAnalysis): string[] {
    const weaknesses: string[] = [];
    
    if (analysis.quality_score < 50) weaknesses.push("Overall quality needs improvement");
    if (analysis.lexical_diversity < 0.4) weaknesses.push("Limited vocabulary variety");
    if (analysis.flow_analysis.rhythm_consistency < 0.5) weaknesses.push("Inconsistent rhythm and flow");
    if (analysis.themes.length === 0) weaknesses.push("Unclear or missing themes");
    if (analysis.vocabulary_analysis.poetic_devices.length === 0) weaknesses.push("Could benefit from more poetic devices");
    if (Math.abs(analysis.sentiment.vader_compound) < 0.2) weaknesses.push("Weak emotional expression");
    
    return weaknesses;
  }

  private getDefaultAIInsights() {
    return {
      vocal_delivery: "Versatile delivery that matches the emotional content",
      musical_suggestions: [
        "Add dynamic instrumentation to match lyrical themes",
        "Consider tempo changes to emphasize key sections",
        "Use melodic hooks to enhance memorability"
      ],
      production_notes: [
        "Ensure vocal clarity in the mix",
        "Balance instrumental levels to support vocals"
      ],
      genre_recommendations: ["Pop", "R&B"],
      improvement_areas: []
    };
  }
}

export const advancedLyricAnalyzer = new AdvancedLyricAnalyzer();
export type { LyricAnalysis, AIEnhancedAnalysis };
