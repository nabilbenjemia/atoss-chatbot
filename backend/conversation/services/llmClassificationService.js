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
            const prompt = `You are an expert classifier for support queries regarding the ATOSS workforce management system at TUM Klinikum. Analyze this user query and extract relevant keywords and the correct category.

Query: "${query}"

Respond ONLY with valid JSON in this exact format:
{
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "category": "category_name"
}

Instructions:
1. Extract 2-4 relevant keywords from the query.
2. CLASSIFY the query into exactly ONE of the following categories based on the definitions below. Do not invent new categories.

ALLOWED CATEGORIES:
- "Technisch": For technical issues, bugs, login errors/password resets, interface errors, or app/browser functionality issues (Incidents).
- "Anwendung": For functional questions on HOW to use the system (e.g., "How do I create a roster?", "How do I enter leave?", "How do I change working time profiles?"), or handling error messages caused by incorrect usage.
- "Zeitwirtschaft/Abrechnung": For questions regarding time valuation, payroll/salary transfer, balances, surcharges, or calculation rules.
- "Dienstplanung": For planning logic, staffing rules, qualifications in planning, shift proposals, or missing working time models (e.g., "Why isn't a shift being suggested to me?", "How do I change staffing rules?", "How can I take qualifications into account in the schedule?", "We have a new work schedule model, why isn't it showing up for me?").
- "Benutzer/Rollen": For questions about access rights, permissions, user profiles, or data visibility.
- "Prozessfragen": For organizational questions not caused by technical faults (e.g., "How do I report sick?", "Approval workflows", "What is the vacation approval process?", "How does internal shift swapping work?").
- "Schulung/Doku": For requests regarding missing manuals, tutorials, or training needs (e.g., "Where can I find instructions for...?", "Can someone show me how... works?").
- "Sonstiges": For queries that do not fit into any of the above categories.

3. Respond only with the JSON object.`;

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
            if (!jsonMatch) {
                throw new Error('Failed to extract JSON from LLM response');
            }
            
            const result = JSON.parse(jsonMatch[0]);
            
            // Validate and clean keywords
            const keywords = Array.isArray(result.keywords) 
                ? result.keywords.slice(0, 5).map(k => String(k).toLowerCase().trim())
                : [];
            
            const category = result.category;
            if (!category) {
                throw new Error('LLM did not return a valid category');
            }
            
            return { keywords, category };
            
        } catch (error) {
            console.error('LLM analysis error:', error.message);
            throw new Error(`Failed to analyze query: ${error.message}`);
        }
    }
}


module.exports = new LLMClassificationService();



