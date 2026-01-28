const axios = require('axios');

/**
 * Service for LLM-powered keyword extraction and categorization
 */
class LLMClassificationService {
    constructor() {
        this.ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
        this.model = 'qwen2.5:3b-instruct-q4_0'; // Smaller model for classification
    }

    /**
     * Extract keywords and category from user query using small LLM
     * @param {string} query 
     */
    async analyzeQuery(query) {
        try {
            const prompt = `Analyze this user query and extract keywords and category.
Query: "${query}"

Respond ONLY with valid JSON in this exact format:
{
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "category": "category_name"
}

Instructions:
1. Extract 2-4 relevant keywords.
2. Create an appropriate category based on the query intent (e.g., "login_issue", "billing_inquiry", "python_error").
3. Keep the category short, descriptive, and use snake_case.
4. Respond only with the JSON object.`;

            const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
                model: this.model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.3,
                    num_predict: 150
                }
            }, { timeout: 10000 });

            // Parse LLM response
            const text = response.data.response.trim();
            
            // Extract JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                
                // Validate and clean keywords
                const keywords = Array.isArray(result.keywords) 
                    ? result.keywords.slice(0, 5).map(k => String(k).toLowerCase().trim())
                    : [];
                
                const category = result.category || 'other';
                
                return { keywords, category };
            }
            
            return this.fallbackAnalysis(query);
            
        } catch (error) {
            console.error('LLM analysis error:', error.message);
            return this.fallbackAnalysis(query);
        }
    }

    /**
     * Fallback keyword extraction without LLM
     */
    fallbackAnalysis(query) {
        const stopWords = ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'how', 'what', 'when', 'where', 'why', 'can', 'could', 'would', 'should'];
        
        const words = query.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3 && !stopWords.includes(word));
        
        const keywords = [...new Set(words)].slice(0, 5);
        
        return {
            keywords,
            category: 'general_question'
        };
    }
}

module.exports = new LLMClassificationService();

