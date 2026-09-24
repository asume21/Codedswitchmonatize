// Extracted from server/routes.ts — order and behavior preserved.
import { Router } from "express";
import { getAIClient } from "../services/grok";

export function createSecurityScanRoutes() {
  const router = Router();
  // Vulnerability Scanner endpoint
  router.post('/api/security/scan', async (req, res) => {
    try {
      const { code, language, aiProvider } = req.body;

      if (!code || !language) {
        return res.status(400).json({ error: 'Code and language are required' });
      }

      // Get AI client for analysis
      const aiClient = getAIClient();
      
      if (!aiClient) {
        return res.status(503).json({ error: 'AI service unavailable' });
      }
      
      const prompt = `Analyze the following ${language} code for security vulnerabilities. Please identify:
1. Common security vulnerabilities (SQL injection, XSS, CSRF, etc.)
2. Code quality issues that could lead to security problems
3. Best practices violations
4. Potential security improvements

Provide your analysis in JSON format with the following structure:
{
  "vulnerabilities": [
    {
      "type": "vulnerability_type",
      "severity": "low|medium|high|critical",
      "line": line_number,
      "description": "description of the issue",
      "recommendation": "how to fix it"
    }
  ],
  "securityScore": 0-100,
  "summary": "overall security assessment"
}

Code to analyze:
\`\`\`${language}
${code}
\`\`\``;

      const response = await aiClient.chat.completions.create({
        model: aiProvider === 'grok' ? 'grok-3' : 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No response from AI');
      }

      // Try to parse JSON response
      let scanResult;
      try {
        // Extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          scanResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        // Fallback if JSON parsing fails
        scanResult = {
          vulnerabilities: [
            {
              type: 'parse_error',
              severity: 'low',
              line: 0,
              description: 'Could not parse AI response properly',
              recommendation: 'Manual review recommended'
            }
          ],
          securityScore: 75,
          summary: content.substring(0, 500) + '...'
        };
      }

      res.json(scanResult);
    } catch (error) {
      console.error('Security scan error:', error);
      
      // Fallback response if AI analysis fails
      const fallbackResult = {
        vulnerabilities: [
          {
            type: 'analysis_error',
            severity: 'medium',
            line: 0,
            description: 'AI analysis failed',
            recommendation: 'Try again or use manual security review'
          }
        ],
        securityScore: 50,
        summary: 'Security scan could not be completed due to an error. Please try again.'
      };

      res.json(fallbackResult);
    }
  });

  return router;
}
