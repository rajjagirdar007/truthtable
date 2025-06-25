// server.js - Enhanced Express backend with AI capabilities using Gemini
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai'); // + GEMINI

const app = express();
const PORT = process.env.PORT || 3001;

// + GEMINI Initialize Gemini Client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" }); // Or "gemini-pro" for more complex tasks

const generationConfig = {
    temperature: 0.7,
    topK: 1,
    topP: 1,
    maxOutputTokens: 2048,
    // responseMimeType: "application/json", // Consider if you *always* expect JSON and model supports it reliably
};

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];


app.use(cors());
app.use(express.json());

// Enhanced caching system
const cache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Enhanced scoring weights with fine-tuned values
const SCORING_WEIGHTS = {
  rating: 0.25,
  reviewCount: 0.20,
  recency: 0.15,
  consistency: 0.15,
  priceValue: 0.10,
  distance: 0.10,
  uniqueness: 0.05
};

// Enhanced fake review detection patterns
const FAKE_REVIEW_PATTERNS = {
  suspiciousPatterns: [
    /amazing|excellent|perfect|fantastic/gi,
    /worst|terrible|awful|horrible/gi,
    /highly recommend|must try|definitely worth/gi
  ],
  spamIndicators: [
    /same day|today|yesterday/gi,
    /first time|never been|will come back/gi
  ],
  genericPhrases: [
    /good food|nice place|great service/gi,
    /bad experience|poor service|not recommended/gi
  ]
};

// Enhanced cuisine classification with regional specificity
const ENHANCED_CUISINE_KEYWORDS = {
  'authentic': ['traditional', 'family', 'authentic', 'abuela', 'casa', 'familia', 'home-made', 'generational'],
  'upscale': ['cocina', 'cantina', 'contemporary', 'modern', 'craft', 'artisanal', 'chef-driven'],
  'casual': ['taqueria', 'grill', 'truck', 'spot', 'joint', 'hole-in-wall', 'neighborhood'],
  'fusion': ['fusion', 'modern', 'contemporary', 'nuevo', 'innovative', 'creative'],
  'regional': {
    'mexican': ['mexican', 'mexicana', 'guadalajara', 'oaxaca', 'puebla', 'yucatan'],
    'tex-mex': ['tex-mex', 'southwestern', 'border', 'austin', 'san-antonio'],
    'peruvian': ['peruvian', 'lima', 'ceviche', 'inca', 'pisco'],
    'spanish': ['spanish', 'tapas', 'paella', 'andaluz', 'barcelona']
  }
};

// Enhanced theme analysis keywords with sentiment context
const ENHANCED_THEME_KEYWORDS = {
  food: {
    positive: ['delicious', 'flavorful', 'fresh', 'authentic', 'perfect', 'amazing', 'excellent', 'tasty', 'incredible'],
    negative: ['bland', 'stale', 'overcooked', 'undercooked', 'tasteless', 'terrible', 'awful', 'disgusting'],
    neutral: ['food', 'dish', 'meal', 'cuisine', 'menu', 'plate', 'order', 'ingredients']
  },
  service: {
    positive: ['friendly', 'attentive', 'helpful', 'professional', 'quick', 'excellent', 'outstanding'],
    negative: ['rude', 'slow', 'inattentive', 'unprofessional', 'terrible', 'awful', 'horrible'],
    neutral: ['service', 'staff', 'waiter', 'server', 'waitress', 'host', 'manager']
  },
  ambiance: {
    positive: ['cozy', 'romantic', 'beautiful', 'charming', 'intimate', 'lovely', 'perfect'],
    negative: ['loud', 'crowded', 'dirty', 'uncomfortable', 'noisy', 'cramped'],
    neutral: ['atmosphere', 'ambiance', 'decor', 'music', 'lighting', 'setting', 'environment']
  },
  value: {
    positive: ['affordable', 'reasonable', 'worth', 'great-deal', 'bargain', 'cheap', 'budget-friendly'],
    negative: ['expensive', 'overpriced', 'costly', 'not-worth', 'too-much', 'rip-off'],
    neutral: ['price', 'cost', 'value', 'money', 'bill', 'check', 'payment']
  }
};

// Utility functions with enhanced error handling
function getCachedData(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCachedData(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

function validateSearchParams(query, location) {
  if (!query || query.trim().length < 2) {
    throw new Error('Query must be at least 2 characters long');
  }
  if (!location || location.trim().length < 3) {
    throw new Error('Location must be at least 3 characters long');
  }
}

function logRequest(endpoint, params, responseTime) {
  console.log(`[${new Date().toISOString()}] ${endpoint} - ${JSON.stringify(params)} - ${responseTime}ms`);
}

// + GEMINI AI HELPER FUNCTIONS

/**
 * Calls Gemini API for text generation with structured output.
 * @param {string} prompt The prompt to send to Gemini.
 * @param {boolean} expectJson Whether to expect JSON output and parse it.
 * @returns {Promise<object|string|null>} Parsed JSON object, string, or null if error.
 */
/**
 * Calls Gemini API for text generation with structured output.
 * @param {string} prompt The prompt to send to Gemini.
 * @param {boolean} expectJson Whether to expect JSON output and parse it.
 * @returns {Promise<object|string|null>} Parsed JSON object, string, or null if error.
 */
async function callGemini(prompt, expectJson = false) {
    try {
      const result = await geminiModel.generateContentStream({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig,
          safetySettings,
      });
      
      let text = '';
      for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          text += chunkText;
      }
  
      if (expectJson) {
        try {
          // More robust JSON extraction
          let cleanedJsonString = text.trim();
          
          // Remove markdown code blocks - handle multiple variations
          cleanedJsonString = cleanedJsonString.replace(/^```(?:json|JSON)?\s*/gm, '');
          cleanedJsonString = cleanedJsonString.replace(/\s*```\s*$/gm, '');
          
          // Try to find JSON object boundaries if there's extra text
          const jsonStart = cleanedJsonString.indexOf('{');
          const jsonEnd = cleanedJsonString.lastIndexOf('}');
          
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            cleanedJsonString = cleanedJsonString.substring(jsonStart, jsonEnd + 1);
          }
          
          // Remove any trailing non-JSON content after the last }
          const lines = cleanedJsonString.split('\n');
          let jsonLines = [];
          let braceCount = 0;
          let foundStart = false;
          
          for (const line of lines) {
            for (const char of line) {
              if (char === '{') {
                braceCount++;
                foundStart = true;
              } else if (char === '}') {
                braceCount--;
              }
            }
            
            if (foundStart) {
              jsonLines.push(line);
            }
            
            // Stop when we've closed all braces
            if (foundStart && braceCount === 0) {
              break;
            }
          }
          
          cleanedJsonString = jsonLines.join('\n').trim();
          
          const parsedJson = JSON.parse(cleanedJsonString);
          return parsedJson;
        } catch (e) {
          console.error("Gemini JSON parsing error:", e);
          console.error("Raw text received (first 1000 chars):\n", text.substring(0, 1000));
          console.error("Attempted to parse:\n", cleanedJsonString?.substring(0, 500) || 'undefined');
          
          // Last resort: try to extract JSON using a different approach
          try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const extractedJson = jsonMatch[0];
              console.log("Attempting alternative JSON extraction...");
              return JSON.parse(extractedJson);
            }
          } catch (fallbackError) {
            console.error("Fallback JSON parsing also failed:", fallbackError);
          }
          
          return null;
        }
      }
      return text;
    } catch (error) {
      console.error('Gemini API call error:', error);
      if (error.message && error.message.includes('SAFETY')) {
          console.warn("Gemini content blocked due to safety settings for prompt (first 200 chars):", prompt.substring(0, 200) + "...");
      } else if (error.message && error.message.includes('quota')) {
          console.error("Gemini API quota exceeded. Please check your quota and billing.");
      }
      return null;
    }
  }

/**
 * Generates an AI-powered summary and insights from a list of reviews.
 * @param {Array<object>} reviews Array of review objects ({ text: string, rating: number }).
 * @param {string} restaurantName Name of the restaurant.
 * @returns {Promise<object|null>} AI insights object or null.
 */
async function generateAiReviewInsights(reviews, restaurantName) {
  if (!reviews || reviews.length === 0) {
    return {
      summary: "No reviews available for AI analysis.",
      overallSentiment: "Neutral",
      keyPositiveThemes: [],
      keyNegativeThemes: [],
      standoutPositiveMentions: [],
      areasForImprovementMentions: []
    };
  }

  const reviewTexts = reviews
    .slice(0, 25) // Limit to ~25 most relevant reviews to keep prompt concise
    .map(r => `Rating: ${r.rating || 'N/A'}/5 - "${r.text || ''}"`)
    .join("\n---\n");

  const prompt = `
    You are a sophisticated restaurant review analyzer. For the restaurant "${restaurantName}",
    analyze the following customer reviews:
    ---
    ${reviewTexts}
    ---
    Provide your analysis strictly in the following JSON format. Do not add any explanatory text, comments, or markdown formatting outside the JSON structure.
    The JSON should be a single object.
    {
      "summary": "A concise, engaging overall summary of the restaurant based on these reviews (2-3 sentences).",
      "overallSentiment": "Positive | Mostly Positive | Neutral | Mixed | Mostly Negative | Negative",
      "keyPositiveThemes": [
        {"theme": "e.g., Food Quality", "details": "Briefly describe why this is positive, citing examples if possible.", "keywords": ["keyword1", "keyword2"]},
        {"theme": "e.g., Ambiance", "details": "Briefly describe positive aspects of ambiance.", "keywords": ["cozy", "romantic"]}
      ],
      "keyNegativeThemes": [
        {"theme": "e.g., Service Speed", "details": "Briefly describe why this is negative, citing examples if possible.", "keywords": ["slow", "wait_time"]},
        {"theme": "e.g., Price", "details": "Mention if price is a concern.", "keywords": ["expensive", "overpriced"]}
      ],
      "standoutPositiveMentions": ["Specific dish or aspect mentioned positively, e.g., 'The tacos al pastor were amazing'", "Another positive mention"],
      "areasForImprovementMentions": ["Specific dish or aspect mentioned negatively, e.g., 'The music was too loud'", "Another area for improvement"]
    }

    Focus on the most prominent and recurring themes. If a category (like keyPositiveThemes or keyNegativeThemes) has no significant findings, use an empty array [].
    Ensure the 'keywords' array contains 2-3 relevant keywords for each theme.
    Be objective and base your analysis solely on the provided reviews.
  `;

  return callGemini(prompt, true);
}

/**
 * Generates more realistic synthetic reviews using AI.
 * @param {object} business Yelp business object.
 * @param {number} count Number of synthetic reviews to generate.
 * @returns {Promise<Array<object>>} Array of AI-generated review objects.
 */
async function generateAiSyntheticReviews(business, count = 3) {
  const categories = business.categories?.map(c => c.title).join(', ') || 'restaurant';
  const prompt = `
    You are a creative review writer. Generate ${count} realistic-sounding customer reviews for a Yelp-like platform
    for a restaurant named "${business.name}" which is a "${categories}" with an average rating of ${business.rating || 4.0}/5.
    The reviews should vary in length (30-100 words), tone, and specific details mentioned.
    The ratings should generally align with the business's average rating but can vary slightly (e.g., if average is 4.2, generate reviews with ratings 3, 4, 5).
    Do not make them all sound the same. Mention specific (but plausible generic) food items or experiences.
    Provide the output strictly as a JSON array of objects, where each object has the following structure:
    {
      "rating": 4,
      "text": "Review text here. Mention something specific like 'The fish tacos were fresh and flavorful.' or 'Service was a bit slow during peak hours, but the food made up for it.'",
      "author": "Simulated User",
      "time_created": "${new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()}",
      "authenticity_score": ${parseFloat((0.7 + Math.random() * 0.1).toFixed(2))}
    }
    Do not add any commentary, markdown, or text before or after the JSON array.
  `;
  const aiReviews = await callGemini(prompt, true);
  return Array.isArray(aiReviews) ? aiReviews : [];
}

/**
 * Generates an AI-powered summary for search insights.
 * @param {object} insights Your existing searchInsights object.
 * @param {string} query The original search query.
 * @returns {Promise<string|null>} AI-generated summary string or null.
 */
async function generateAiSearchInsightsSummary(insights, query) {
    const topCuisinesString = insights.cuisineTypes ? Object.entries(insights.cuisineTypes).sort(([,a],[,b]) => b-a).slice(0,3).map(([k,v])=> `${k} (${v})`).join(', ') : 'N/A';
    const topFeaturesString = insights.topFeatures ? Object.entries(insights.topFeatures).sort(([,a],[,b]) => b-a).slice(0,3).map(([k,v])=> `${k} (${v})`).join(', ') : 'N/A';

    const prompt = `
    Given the following search insights for a restaurant query "${query}":
    - Total restaurants found: ${insights.totalRestaurants}
    - Average rating: ${insights.averageRating || 'N/A'}
    - Price distribution: ${JSON.stringify(insights.priceDistribution)}
    - Top cuisine types: ${topCuisinesString || 'Varied cuisines'}
    - Top features mentioned: ${topFeaturesString || 'Various features'}
    - Verification rate (cross-platform): ${insights.verificationRate || 'N/A'}%

    Write a concise (1-2 sentences, max 40 words) human-readable summary of these search results. Be engaging and informative.
    Example: "Your search for '${query}' yielded ${insights.totalRestaurants} spots, highlighting many ${topCuisinesString.split(' ')[0] || 'diverse'} options, often praised for ${topFeaturesString.split(' ')[0] || 'their quality'}."
    Output only the summary sentence itself, without any introductory phrases like "Here's a summary:".
  `;
  return callGemini(prompt);
}


// Enhanced Google Places API endpoints
app.get('/api/google-places', async (req, res) => {
  const startTime = Date.now();
  try {
    const { query, location } = req.query;
    validateSearchParams(query, location);
    
    const cacheKey = `google-places-${query}-${location}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      logRequest('/api/google-places', req.query, Date.now() - startTime);
      return res.json(cached);
    }

    const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
      params: {
        query: `${query} restaurant in ${location}`, // Made location more explicit
        key: process.env.GOOGLE_PLACES_API_KEY
      },
      timeout: 10000
    });

    const restaurants = response.data.results.map(place => ({
      id: place.place_id,
      name: place.name,
      address: place.formatted_address,
      rating: place.rating,
      priceLevel: place.price_level ? '$'.repeat(place.price_level) : null, // Handle undefined price_level
      cuisine: extractCuisineFromTypes(place.types),
      location: place.geometry.location,
      photoReference: place.photos?.[0]?.photo_reference,
      totalRatings: place.user_ratings_total || 0,
      businessStatus: place.business_status,
      permanentlyClosedFactor: place.permanently_closed ? 0 : 1
    }));

    const result = { results: restaurants };
    setCachedData(cacheKey, result);
    logRequest('/api/google-places', req.query, Date.now() - startTime);
    res.json(result);
  } catch (error) {
    console.error('Google Places API error:', error.response?.data || error.message);
    const responseTime = Date.now() - startTime;
    logRequest('/api/google-places', req.query, responseTime);
    res.status(error.response?.status || 500).json({ error: 'Failed to fetch Google Places data', details: error.message });
  }
});

app.get('/api/google-reviews', async (req, res) => {
  const startTime = Date.now();
  try {
    const { place_id } = req.query;
    if (!place_id) {
      return res.status(400).json({ error: 'place_id is required' });
    }
    
    const cacheKey = `google-reviews-${place_id}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      logRequest('/api/google-reviews', req.query, Date.now() - startTime);
      return res.json(cached);
    }

    const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: {
        place_id,
        fields: 'reviews,rating,user_ratings_total,name',
        key: process.env.GOOGLE_PLACES_API_KEY
      },
      timeout: 10000
    });
    
    const resultData = response.data.result || {}; // Handle case where result might be undefined

    const reviews = resultData.reviews?.map(review => ({
      rating: review.rating,
      text: review.text,
      author: review.author_name,
      time: review.time, // This is a Unix timestamp
      relative_time: review.relative_time_description,
      authenticity_score: calculateAuthenticityScore(review)
    })) || [];

    const result = { 
      reviews: reviews.filter(review => review.authenticity_score > 0.3),
      rating: resultData.rating,
      total_ratings: resultData.user_ratings_total,
      restaurant_name: resultData.name
    };
    
    setCachedData(cacheKey, result);
    logRequest('/api/google-reviews', req.query, Date.now() - startTime);
    res.json(result);
  } catch (error) {
    console.error('Google Reviews API error:', error.response?.data || error.message);
    const responseTime = Date.now() - startTime;
    logRequest('/api/google-reviews', req.query, responseTime);
    res.status(error.response?.status || 500).json({ error: 'Failed to fetch Google reviews', details: error.message });
  }
});

// Enhanced Yelp API endpoints
app.get('/api/yelp-search', async (req, res) => {
  const startTime = Date.now();
  try {
    const { term, location } = req.query;
    validateSearchParams(term, location);
    
    const cacheKey = `yelp-search-${term}-${location}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      logRequest('/api/yelp-search', req.query, Date.now() - startTime);
      return res.json(cached);
    }

    const response = await axios.get('https://api.yelp.com/v3/businesses/search', {
      headers: {
        'Authorization': `Bearer ${process.env.YELP_API_KEY}`
      },
      params: {
        term: `${term} restaurant`,
        location,
        categories: 'restaurants', // Ensure it's plural as per Yelp docs
        limit: 20
      },
      timeout: 10000
    });

    const businesses = response.data.businesses.map(business => ({
      id: business.id,
      name: business.name,
      address: business.location.display_address.join(', '),
      rating: business.rating,
      priceLevel: business.price || '$',
      cuisine: business.categories?.[0]?.title || 'Restaurant',
      location: business.coordinates,
      imageUrl: business.image_url,
      reviewCount: business.review_count,
      isChain: detectChainRestaurant(business.name),
      yelpVerified: !business.is_claimed ? 0.7 : 1.0 // Note: is_claimed is boolean
    }));

    const result = { businesses };
    setCachedData(cacheKey, result);
    logRequest('/api/yelp-search', req.query, Date.now() - startTime);
    res.json(result);
  } catch (error) {
    console.error('Yelp Search API error:', error.response?.data || error.message);
    const responseTime = Date.now() - startTime;
    logRequest('/api/yelp-search', req.query, responseTime);
    res.status(error.response?.status || 500).json({ error: 'Failed to fetch Yelp data', details: error.message });
  }
});

app.get('/api/yelp-reviews', async (req, res) => {
  const startTime = Date.now();
  try {
    const { business_id } = req.query;
    if (!business_id) {
      return res.status(400).json({ error: 'business_id is required' });
    }
    
    const cacheKey = `yelp-reviews-${business_id}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      logRequest('/api/yelp-reviews', req.query, Date.now() - startTime);
      return res.json(cached);
    }

    try {
      const response = await axios.get(`https://api.yelp.com/v3/businesses/${business_id}/reviews`, {
        headers: {
          'Authorization': `Bearer ${process.env.YELP_API_KEY}`
        },
        timeout: 10000
      });

      const reviews = response.data.reviews.map(review => ({
        rating: review.rating,
        text: review.text,
        author: review.user.name,
        time: review.time_created,
        authenticity_score: calculateAuthenticityScore(review),
        user_review_count: review.user.review_count || 0
      }));

      const result = { 
        reviews: reviews.filter(review => review.authenticity_score > 0.3)
      };
      
      setCachedData(cacheKey, result);
      logRequest('/api/yelp-reviews', req.query, Date.now() - startTime);
      res.json(result);
    } catch (reviewError) {
      console.log(`Yelp reviews not available for ${business_id}, attempting AI synthetic or business data fallback.`);
      
      const businessResponse = await axios.get(`https://api.yelp.com/v3/businesses/${business_id}`, {
        headers: {
          'Authorization': `Bearer ${process.env.YELP_API_KEY}`
        },
        timeout: 5000 // Shorter timeout for fallback
      });

      const business = businessResponse.data;
      let syntheticReviews = [];
      let aiUsed = false;

      // + GEMINI: Attempt to generate AI synthetic reviews
      const aiGeneratedReviews = await generateAiSyntheticReviews(business, 3);
      if (aiGeneratedReviews && aiGeneratedReviews.length > 0) {
          syntheticReviews = aiGeneratedReviews.map(r => ({
              ...r,
              author: r.author || `AI Customer ${Math.floor(Math.random() * 1000)}`,
              authenticity_score: r.authenticity_score || parseFloat((0.7 + Math.random() * 0.1).toFixed(2))
          }));
          aiUsed = true;
          console.log(`Generated ${syntheticReviews.length} AI synthetic reviews for ${business.name}`);
      } else {
          syntheticReviews = generateEnhancedContextualReviews(business); // Your existing fallback
          console.log(`Fell back to template-based synthetic reviews for ${business.name} after AI attempt.`);
      }

      const result = { 
        reviews: syntheticReviews,
        synthetic: true,
        ai_synthetic: aiUsed, // + GEMINI: Flag if AI was used
        business_rating: business.rating,
        business_review_count: business.review_count 
      };
      
      setCachedData(cacheKey, result);
      logRequest('/api/yelp-reviews', req.query, Date.now() - startTime);
      res.json(result);
    }
  } catch (error) {
    console.error('Yelp API error (outer):', error.response?.data || error.message);
    const responseTime = Date.now() - startTime;
    logRequest('/api/yelp-reviews', req.query, responseTime);
    // Fallback to empty reviews if even business details fetch fails
    res.json({ 
      reviews: [],
      error: 'Yelp data temporarily unavailable or business not found.',
      synthetic: true,
      ai_synthetic: false,
      details: error.message
    });
  }
});

// ENHANCED: Intelligent restaurant search with advanced scoring
app.get('/api/search-restaurants', async (req, res) => {
  const startTime = Date.now();
  try {
    const { 
      query, 
      location = 'Boston,MA', // Default location
      priceRange,
      minRating,
      cuisine,
      sortBy = 'smart',
      userLat,
      userLng
    } = req.query;
    
    validateSearchParams(query, location);
    
    const cacheKey = `search-${query}-${location}-${priceRange || 'all'}-${minRating || 'all'}-${sortBy}-${userLat || 'na'}-${userLng || 'na'}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      logRequest('/api/search-restaurants', req.query, Date.now() - startTime);
      return res.json(cached);
    }
    
    const searchPromises = [
      searchGooglePlaces(query, location),
      searchYelpBusinesses(query, location)
    ];

    const [googleResponse, yelpResponse] = await Promise.allSettled(searchPromises);
    
    const googleRestaurants = googleResponse.status === 'fulfilled' ? googleResponse.value.data || [] : [];
    const yelpRestaurants = yelpResponse.status === 'fulfilled' ? yelpResponse.value.data || [] : [];

    console.log(`Found ${googleRestaurants.length} Google results, ${yelpRestaurants.length} Yelp results for query: ${query} in ${location}`);

    const mergedRestaurants = intelligentMergeRestaurants(googleRestaurants, yelpRestaurants);
    
    let filteredRestaurants = applyEnhancedFilters(mergedRestaurants, {
      priceRange,
      minRating,
      cuisine
    });

    const scoredRestaurants = calculateIntelligentScores(filteredRestaurants, {
      userLat: userLat ? parseFloat(userLat) : undefined,
      userLng: userLng ? parseFloat(userLng) : undefined,
      query,
      sortBy
    });

    scoredRestaurants.sort((a, b) => (b.intelligentScore || 0) - (a.intelligentScore || 0));

    const restaurantsWithReasons = addEnhancedRecommendationReasons(scoredRestaurants);

    const searchInsightsData = generateEnhancedSearchInsights(restaurantsWithReasons, query);

    // + GEMINI: Generate AI summary for search insights
    const aiSummaryText = await generateAiSearchInsightsSummary(searchInsightsData, query);
    if (aiSummaryText) {
        searchInsightsData.aiSummary = aiSummaryText;
    }

    const result = { 
      restaurants: restaurantsWithReasons.slice(0, 12),
      totalFound: mergedRestaurants.length,
      filteredCount: filteredRestaurants.length, // Renamed from 'filtered' for clarity
      searchInsights: searchInsightsData, // + GEMINI: Potentially includes aiSummary
      sourceCounts: { // Renamed for clarity
        google: googleRestaurants.length,
        yelp: yelpRestaurants.length
      }
    };
    
    setCachedData(cacheKey, result);
    logRequest('/api/search-restaurants', req.query, Date.now() - startTime);
    res.json(result);
  } catch (error) {
    console.error('Enhanced search error:', error.message, error.stack);
    const responseTime = Date.now() - startTime;
    logRequest('/api/search-restaurants', req.query, responseTime);
    res.status(500).json({ error: 'Failed to search restaurants', details: error.message });
  }
});

// ENHANCED: Restaurant analysis with balanced review sourcing
app.get('/api/restaurant-analysis', async (req, res) => {
  const startTime = Date.now();
  try {
    const { google_id, yelp_id, name } = req.query; // 'name' is used for AI prompt if IDs are missing
    
    if (!google_id && !yelp_id && !name) {
      return res.status(400).json({ error: 'At least one identifier (google_id, yelp_id, or name) is required' });
    }
    
    const cacheKey = `analysis-${google_id || 'none'}-${yelp_id || 'none'}-${name || 'none'}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      logRequest('/api/restaurant-analysis', req.query, Date.now() - startTime);
      return res.json(cached);
    }
    
    const reviewPromises = [];
    if (google_id) reviewPromises.push(getGoogleReviews(google_id));
    if (yelp_id) reviewPromises.push(getYelpReviews(yelp_id));

    const reviewsData = await Promise.allSettled(reviewPromises);
    const successfulReviews = reviewsData
      .filter(result => result.status === 'fulfilled' && result.value && result.value.data)
      .map(result => result.value);
    
    let restaurantNameForAI = name;
    if (!restaurantNameForAI) {
        const googleData = successfulReviews.find(sr => sr.platform === 'google')?.data;
        if (googleData && googleData.restaurant_name) {
            restaurantNameForAI = googleData.restaurant_name;
        } else {
            const yelpData = successfulReviews.find(sr => sr.platform === 'yelp')?.data;
            // Yelp review endpoint doesn't directly give restaurant name, this would need business details
            // For simplicity, if only Yelp ID is provided and no name, AI prompt might be less specific
            if (yelpData && yelp_id && !restaurantNameForAI) {
                // Potentially fetch Yelp business details here to get name if needed
                // For now, we'll rely on 'name' query param or Google's name
                 console.warn("Restaurant name for AI prompt might be missing if only yelp_id is provided without name param.");
            }
        }
    }
    
    let analysis = performAdvancedAnalysisWithBalancing(successfulReviews, restaurantNameForAI || "this restaurant");

    // + GEMINI: Perform AI-enhanced analysis
    const allPlatformReviews = successfulReviews.reduce((acc, curr) => {
        if (curr.data && curr.data.reviews) {
            return acc.concat(curr.data.reviews.map(r => ({...r, platformSource: curr.platform }))); // Add source
        }
        return acc;
    }, []);
    
    if (allPlatformReviews.length > 0) {
        const aiInsights = await generateAiReviewInsights(allPlatformReviews, restaurantNameForAI || analysis.restaurant_name || 'this restaurant');
        if (aiInsights) {
            analysis.aiPoweredInsights = aiInsights;
        } else {
            analysis.aiPoweredInsights = {
                summary: "AI analysis could not be generated at this time.",
                overallSentiment: analysis.sentimentAnalysis?.positive > 60 ? "Positive" : (analysis.sentimentAnalysis?.negative > 40 ? "Negative" : "Neutral"),
                keyPositiveThemes: [], keyNegativeThemes: [], standoutPositiveMentions: [], areasForImprovementMentions: []
            };
        }
    } else {
         analysis.aiPoweredInsights = {
            summary: "Not enough review data for AI analysis.",
            overallSentiment: "Neutral",
            keyPositiveThemes: [], keyNegativeThemes: [], standoutPositiveMentions: [], areasForImprovementMentions: []
        };
    }

    setCachedData(cacheKey, analysis);
    logRequest('/api/restaurant-analysis', req.query, Date.now() - startTime);
    res.json(analysis);
    console.log(analysis);
  } catch (error) {
    console.error('Restaurant analysis error:', error.message, error.stack);
    const responseTime = Date.now() - startTime;
    logRequest('/api/restaurant-analysis', req.query, responseTime);
    res.status(500).json({ error: 'Failed to analyze restaurant', details: error.message });
  }
});


// ENHANCED HELPER FUNCTIONS (Your existing extensive helper functions)

function extractCuisineFromTypes(types) {
  if (!types || types.length === 0) return 'Restaurant';
  const priorityCuisines = ['mexican', 'italian', 'chinese', 'japanese', 'indian', 'thai', 'french', 'spanish', 'greek', 'vietnamese', 'korean', 'sushi'];
  for (const cuisine of priorityCuisines) {
      if (types.some(type => type.toLowerCase().includes(cuisine))) return cuisine.charAt(0).toUpperCase() + cuisine.slice(1);
  }
  const generalTerms = types.filter(type =>
    !['point_of_interest', 'establishment'].includes(type)
  );
  return generalTerms.length > 0 ? generalTerms[0].replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Restaurant';
}

function calculateAuthenticityScore(review) {
  let score = 1.0;
  const text = (review.text || '').toLowerCase();
  
  let suspiciousMatches = 0;
  FAKE_REVIEW_PATTERNS.suspiciousPatterns.forEach(pattern => {
    if (pattern.test(text)) suspiciousMatches++;
  });
  if (suspiciousMatches > 1) score -= 0.3 * (suspiciousMatches - 1); // More penalty for more matches
  
  FAKE_REVIEW_PATTERNS.spamIndicators.forEach(pattern => {
    if (pattern.test(text)) score -= 0.2;
  });
  
  let genericMatches = 0;
  FAKE_REVIEW_PATTERNS.genericPhrases.forEach(pattern => {
    if (pattern.test(text)) genericMatches++;
  });
  if (genericMatches > 0) score -= 0.15 * genericMatches;
  
  if (text.length < 25) score -= 0.3; // Increased minimum length
  else if (text.length < 50) score -= 0.1;
  if (text.length > 500) score += 0.05; // Slight bonus for very detailed
  
  if (review.user_review_count !== undefined) { // Check for Yelp specifically
    if (review.user_review_count < 3) score -= 0.2;
    else if (review.user_review_count < 10) score -= 0.1;
    if (review.user_review_count > 50) score += 0.1;
  }
  
  // Check for excessive capitalization or punctuation
  if (text.length > 0 && (text.match(/[A-Z]/g)?.length || 0) / text.length > 0.5) score -= 0.2; // More than 50% caps
  if (text.split('!').length -1 > 3) score -= 0.1; // More than 3 exclamation marks

  return Math.max(0.1, Math.min(1.0, parseFloat(score.toFixed(2))));
}

function detectChainRestaurant(name) {
  const chainIndicators = ['mcdonald\'s', 'burger king', 'subway', 'starbucks', 'chipotle', 'pizza hut', 'domino\'s', 'kfc', 'taco bell', 'wendy\'s', 'panda express'];
  const nameLower = name.toLowerCase();
  return chainIndicators.some(chain => nameLower.includes(chain));
}

async function searchGooglePlaces(query, location) {
  try {
    // Using the direct endpoint call from within the same server
    const response = await axios.get(`http://localhost:${PORT}/api/google-places`, {
        params: { query, location },
        timeout: 10000 // Added timeout for internal call
    });
    return { platform: 'google', data: response.data.results || [] };
  } catch (error) {
    console.error('Internal Google search failed:', error.message);
    return { platform: 'google', data: [] }; // Ensure data is always an array
  }
}

async function searchYelpBusinesses(query, location) {
  try {
    // Using the direct endpoint call from within the same server
    const response = await axios.get(`http://localhost:${PORT}/api/yelp-search`, {
        params: { term: query, location },
        timeout: 10000 // Added timeout for internal call
    });
    return { platform: 'yelp', data: response.data.businesses || [] };
  } catch (error) {
    console.error('Internal Yelp search failed:', error.message);
    return { platform: 'yelp', data: [] }; // Ensure data is always an array
  }
}

function intelligentMergeRestaurants(googleRestaurants, yelpRestaurants) {
  const merged = new Map(); // Use Map for easier ID-based merging

  (googleRestaurants || []).forEach(g => {
    const enhanced = enhanceRestaurantData({ ...g, platform: 'google', source: 'Google Places', googleId: g.id });
    merged.set(normalizeRestaurantName(g.name) + normalizeAddress(g.address), enhanced); // Key by name+address
  });

  (yelpRestaurants || []).forEach(y => {
    let bestMatchKey = null;
    let highestScore = 0.60; // Minimum score to consider a match

    merged.forEach((gData, key) => {
        // If gData already has a yelpId, it's likely already merged via a previous Yelp iteration or direct match
        if (gData.yelpId) return;

        // Create a temporary Google-like object from Yelp data for comparison if needed
        // Or directly compare y.name, y.address with gData.name, gData.address
        const score = calculateMatchScore(
            { name: gData.name, address: gData.address, location: gData.location },
            { name: y.name, address: y.address, location: y.location }
        );

        if (score > highestScore) {
            highestScore = score;
            bestMatchKey = key;
        }
    });

    if (bestMatchKey) {
        const gData = merged.get(bestMatchKey);
        gData.yelpId = y.id;
        gData.yelpRating = y.rating;
        gData.yelpReviewCount = y.reviewCount;
        gData.yelpImageUrl = y.imageUrl;
        gData.source += ' + Yelp';
        gData.crossPlatformVerified = true;
        gData.platformConsistency = calculatePlatformConsistency(
            { rating: gData.rating, totalRatings: gData.totalRatings },
            { rating: y.rating, reviewCount: y.reviewCount }
        );
        // Prefer Yelp's price if Google's is missing
        if (!gData.priceLevel && y.priceLevel) gData.priceLevel = y.priceLevel;
        // Merge categories/cuisine if one is generic and other specific
        if (gData.cuisine === 'Restaurant' && y.cuisine !== 'Restaurant') gData.cuisine = y.cuisine;

    } else {
        // If no match, add Yelp restaurant as a new entry
        const key = normalizeRestaurantName(y.name) + normalizeAddress(y.address);
        if (!merged.has(key)) { // Avoid adding if a very similar Google one (no Yelp match) already exists
             merged.set(key, enhanceRestaurantData({ ...y, platform: 'yelp', source: 'Yelp', yelpId: y.id }));
        }
    }
  });
  return Array.from(merged.values());
}


function normalizeAddress(address) {
    if (!address) return '';
    return address.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}


function findBestYelpMatch(googleRestaurant, yelpRestaurants) {
  let bestMatch = null;
  let bestScore = 0.65; // Increased threshold for a good match
  
  yelpRestaurants.forEach(yelpRestaurant => {
    const score = calculateMatchScore(googleRestaurant, yelpRestaurant);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = yelpRestaurant;
    }
  });
  
  return bestMatch;
}

function calculateMatchScore(r1, r2) {
  if (!r1 || !r2) return 0;
  const nameSim = advancedStringSimilarity(normalizeRestaurantName(r1.name || ''), normalizeRestaurantName(r2.name || '')) * 0.55;
  const addrSim = calculateAddressSimilarity(r1.address || '', r2.address || '') * 0.35;
  const geoSim = calculateGeoSimilarity(r1.location, r2.location) * 0.10;
  return nameSim + addrSim + geoSim;
}

function normalizeRestaurantName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\b(restaurant|grill|bar|cafe|kitchen|house|place|diner|eatery|bistro|pub|inn|lounge|shop|store)\b/g, '') // More common words
    .trim()
    .replace(/\s+/g, ' '); // Normalize spaces
}

function advancedStringSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const levenshteinDist = levenshteinDistance(s1, s2);
  const levenshteinSim = 1 - (levenshteinDist / Math.max(len1, len2));
  
  const tokens1 = s1.split(' ').filter(token => token.length > 1);
  const tokens2 = s2.split(' ').filter(token => token.length > 1);
  if (tokens1.length === 0 || tokens2.length === 0) return levenshteinSim; // Fallback if no significant tokens

  const intersection = tokens1.filter(token => tokens2.includes(token));
  const tokenSimilarity = (2 * intersection.length) / (tokens1.length + tokens2.length);
  
  return (levenshteinSim * 0.6) + (tokenSimilarity * 0.4);
}

function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];

  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}


function calculateAddressSimilarity(addr1, addr2) {
  if (!addr1 || !addr2) return 0;
  const normAddr1 = normalizeAddress(addr1);
  const normAddr2 = normalizeAddress(addr2);

  // Simple similarity for now, can be enhanced with street number/name extraction
  return advancedStringSimilarity(normAddr1.split(',')[0], normAddr2.split(',')[0]); // Compare first part of address (street)
}

function calculateGeoSimilarity(loc1, loc2) {
  if (!loc1 || !loc2) return 0;
  
  const lat1 = loc1.lat ?? loc1.latitude;
  const lng1 = loc1.lng ?? loc1.longitude;
  const lat2 = loc2.lat ?? loc2.latitude;
  const lng2 = loc2.lng ?? loc2.longitude;
  
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return 0;
  
  const distance = calculateDistance(lat1, lng1, lat2, lng2); // in km
  if (distance < 0.05) return 1.0; // Very close ~50m
  if (distance < 0.2) return 0.8;  // Close ~200m
  if (distance < 0.5) return 0.5;  // Nearby ~500m
  return 0;
}

function enhanceRestaurantData(restaurant) {
  const cuisine = restaurant.cuisine || (restaurant.categories?.[0]?.title) || 'Restaurant';
  return {
    ...restaurant,
    // id: restaurant.id || restaurant.place_id, // Consolidate ID if needed, careful with Yelp vs Google
    cuisineType: classifyEnhancedCuisineType(restaurant.name, cuisine),
    priceCategory: categorizePriceLevel(restaurant.priceLevel || (restaurant.price || '$')),
    estimatedWaitTime: estimateWaitTime(restaurant),
    specialFeatures: identifyEnhancedSpecialFeatures(restaurant),
    crossPlatformVerified: restaurant.crossPlatformVerified || false, // Default
    platformConsistency: restaurant.platformConsistency || 1.0, // Default
    // authenticityScore: 1.0 // This would be an aggregate, not for individual restaurant data here
  };
}

function classifyEnhancedCuisineType(name, cuisine) {
  const nameLower = (name || '').toLowerCase();
  const cuisineLower = (cuisine || '').toLowerCase();
  const combinedText = nameLower + " " + cuisineLower;

  for (const [region, keywords] of Object.entries(ENHANCED_CUISINE_KEYWORDS.regional)) {
    if (keywords.some(keyword => combinedText.includes(keyword))) {
      return `${region.charAt(0).toUpperCase() + region.slice(1)} Regional`;
    }
  }
  for (const [style, keywords] of Object.entries(ENHANCED_CUISINE_KEYWORDS)) {
    if (style !== 'regional' && keywords.some(keyword => combinedText.includes(keyword))) {
      return style.charAt(0).toUpperCase() + style.slice(1);
    }
  }
  return cuisine !== 'Restaurant' ? cuisine : 'Standard'; // Fallback to original cuisine if not 'Restaurant'
}

function categorizePriceLevel(priceLevelString) {
  const level = priceLevelString ? priceLevelString.length : 1; // Default to 1 if null/undefined
  if (level >= 4) return 'Luxury';
  if (level === 3) return 'Expensive';
  if (level === 2) return 'Moderate';
  return 'Budget';
}

function identifyEnhancedSpecialFeatures(restaurant) {
  const features = new Set(); // Use Set to avoid duplicates
  const name = (restaurant.name || '').toLowerCase();
  const cuisine = (restaurant.cuisine || '').toLowerCase();
  const types = restaurant.types || []; // For Google Places data

  if (name.includes('tequila') || name.includes('mezcal') || name.includes('cocktail bar')) features.add('Craft Cocktails');
  if (name.includes('rooftop') || name.includes('patio') || name.includes('garden') || types.includes('rooftop_seating') || types.includes('outdoor_seating')) features.add('Outdoor Seating');
  if (name.includes('24 hour') || name.includes('late night') || name.includes('midnight')) features.add('Late Night');
  if (cuisine.includes('vegan') || cuisine.includes('vegetarian') || name.includes('plant-based') || types.includes('vegan_restaurant') || types.includes('vegetarian_restaurant')) features.add('Plant-Based Options');
  if (name.includes('family') || name.includes('kids menu') || name.includes('children')) features.add('Family-Friendly');
  if (name.includes('wine bar') || name.includes('wine list') || name.includes('sommelier')) features.add('Extensive Wine List');
  if (name.includes('chef\'s table') || name.includes('tasting menu') || cuisine.includes('fine dining')) features.add('Chef-Driven / Fine Dining');
  
  if (restaurant.rating && restaurant.rating >= 4.7) features.add('Highly-Rated');
  const reviewCount = restaurant.reviewCount || restaurant.totalRatings || 0;
  if (restaurant.rating && restaurant.rating >= 4.5 && reviewCount > 10 && reviewCount < 100) features.add('Hidden Gem');
  
  if (detectChainRestaurant(restaurant.name)) features.add('Chain Restaurant');
  if (restaurant.source && restaurant.source.includes('Yelp') && restaurant.source.includes('Google')) features.add('Cross-Platform Verified');

  return Array.from(features);
}

function applyEnhancedFilters(restaurants, filters) {
  return restaurants.filter(restaurant => {
    if (filters.priceRange) {
      const acceptedPrices = filters.priceRange.split(',');
      if (!restaurant.priceLevel || !acceptedPrices.includes(restaurant.priceLevel)) return false;
    }
    if (filters.minRating) {
      const minRating = parseFloat(filters.minRating);
      if (!restaurant.rating || restaurant.rating < minRating) return false;
    }
    if (filters.cuisine) {
      const cuisineLower = filters.cuisine.toLowerCase();
      const matches = (restaurant.cuisine || '').toLowerCase().includes(cuisineLower) ||
                      (restaurant.name || '').toLowerCase().includes(cuisineLower) ||
                      (restaurant.cuisineType || '').toLowerCase().includes(cuisineLower);
      if (!matches) return false;
    }
    if (restaurant.permanentlyClosedFactor === 0) return false;
    if (restaurant.businessStatus && restaurant.businessStatus !== 'OPERATIONAL') return false;
    
    return true;
  });
}

function calculateIntelligentScores(restaurants, context) {
  return restaurants.map(restaurant => {
    const scores = {
      rating: calculateEnhancedRatingScore(restaurant),
      reviewCount: calculateEnhancedVolumeScore(restaurant),
      recency: calculateEnhancedRecencyScore(restaurant), // This is still a placeholder
      consistency: restaurant.platformConsistency || 0.8, // Default if not cross-platform
      priceValue: calculateEnhancedPriceValueScore(restaurant),
      distance: calculateDistanceScore(restaurant, context.userLat, context.userLng),
      uniqueness: calculateEnhancedUniquenessScore(restaurant, context.query)
    };
    
    const intelligentScore = Object.keys(SCORING_WEIGHTS).reduce((total, factor) => {
      return total + ((scores[factor] || 0) * SCORING_WEIGHTS[factor]);
    }, 0);
    
    return {
      ...restaurant,
      intelligentScore: parseFloat(intelligentScore.toFixed(3)),
      scoreBreakdown: scores
    };
  });
}

function calculateEnhancedRatingScore(restaurant) {
  if (!restaurant.rating) return 0.5; // Neutral if no rating
  let score = (restaurant.rating - 1) / 4; // Normalize 1-5 to 0-1
  
  if (restaurant.crossPlatformVerified) score = Math.min(1, score * 1.1);
  if (restaurant.specialFeatures?.includes('Chain Restaurant')) score *= 0.9;
  // Consider authenticity score of reviews if we had an aggregate restaurant authenticity
  return Math.max(0, Math.min(1, score));
}

function calculateEnhancedVolumeScore(restaurant) {
  const totalReviews = (restaurant.totalRatings || 0) + (restaurant.yelpReviewCount || 0);
  if (totalReviews === 0) return 0.1; // Low score if no reviews
  // Logarithmic scale, 1000 reviews approaches 1.0
  let score = Math.log10(totalReviews + 1) / 3; // (log10(1001) / 3) approx 1
  return Math.min(1, score);
}

function calculateEnhancedRecencyScore(restaurant) {
  // This is a placeholder as actual review recency isn't easily available at restaurant list level
  // A more advanced approach would fetch latest review dates or use business update times
  let score = 0.6;
  if (restaurant.businessStatus === 'OPERATIONAL') score += 0.2;
  // If we had info on recent positive reviews, this could be improved
  return Math.min(1, score);
}

function calculateEnhancedPriceValueScore(restaurant) {
  const priceLevelNum = restaurant.priceLevel ? restaurant.priceLevel.length : 2; // 1 to 4, default 2
  const rating = restaurant.rating || 3.0; // Default 3.0 if no rating
  if (priceLevelNum === 0) return 0.5; // Should not happen with default

  // Higher rating for lower price is better.
  // Example: 5 stars at price 1 = 5. 3 stars at price 3 = 1.
  let valueRatio = rating / priceLevelNum;

  // Normalize: Max possible is 5/1=5. Min practical around 1/4=0.25.
  // Map [0.25, 5] to [0, 1]. (valueRatio - 0.25) / (5 - 0.25)
  let score = (valueRatio - 0.25) / 4.75;
  
  const reviewCount = (restaurant.totalRatings || 0) + (restaurant.yelpReviewCount || 0);
  if (reviewCount < 10) score *= 0.8; // Less confidence in value if few reviews

  return Math.max(0, Math.min(1, score));
}

function calculateDistanceScore(restaurant, userLat, userLng) {
  if (userLat == null || userLng == null || !restaurant.location) return 0.3; // Low score if no user/restaurant location
  
  const restLat = restaurant.location.lat ?? restaurant.location.latitude;
  const restLng = restaurant.location.lng ?? restaurant.location.longitude;
  if (restLat == null || restLng == null) return 0.3;
  
  const distance = calculateDistance(userLat, userLng, restLat, restLng); // In km
  
  if (distance <= 1) return 1.0;    // <1km
  if (distance <= 3) return 0.8;    // 1-3km
  if (distance <= 5) return 0.6;    // 3-5km
  if (distance <= 10) return 0.3;   // 5-10km
  return 0.1;                       // >10km
}

function calculateEnhancedUniquenessScore(restaurant, query) {
  let score = 0.3; // Base
  const features = restaurant.specialFeatures || [];
  
  if (features.includes('Hidden Gem')) score += 0.3;
  if (features.includes('Chef-Driven / Fine Dining')) score += 0.2;
  if (features.includes('Craft Cocktails') || features.includes('Extensive Wine List')) score += 0.15;
  if (features.includes('Authentic Cuisine') || restaurant.cuisineType?.includes('Regional')) score += 0.1; // From your old code
  if (features.includes('Chain Restaurant')) score -= 0.3;

  if (query) {
    const queryLower = query.toLowerCase();
    if ((restaurant.name || '').toLowerCase().includes(queryLower)) score += 0.1;
    if ((restaurant.cuisine || '').toLowerCase().includes(queryLower) || (restaurant.cuisineType || '').toLowerCase().includes(queryLower)) score += 0.05;
  }
  
  return Math.max(0, Math.min(1, score));
}

function addEnhancedRecommendationReasons(restaurants) {
  return restaurants.map(restaurant => {
    const reasons = new Set(); // Use Set to avoid duplicate reasons
    const scores = restaurant.scoreBreakdown || {};
    const features = restaurant.specialFeatures || [];

    if (scores.rating > 0.85) reasons.add('Exceptional ratings');
    else if (scores.rating > 0.7) reasons.add('Excellent ratings');

    if (scores.reviewCount > 0.8) reasons.add('Very popular (many reviews)');
    else if (scores.reviewCount > 0.6) reasons.add('Well-reviewed');
    
    if (restaurant.crossPlatformVerified) reasons.add('Verified on multiple platforms');

    if (scores.priceValue > 0.8) reasons.add('Great value for money');
    else if (scores.priceValue > 0.65) reasons.add('Good value');

    if (scores.distance > 0.9) reasons.add('Very close by');
    else if (scores.distance > 0.7) reasons.add('Nearby');

    if (features.includes('Hidden Gem')) reasons.add('Local favorite (Hidden Gem)');
    if (features.includes('Chef-Driven / Fine Dining')) reasons.add('Unique culinary experience');
    if (features.includes('Craft Cocktails')) reasons.add('Known for craft cocktails');
    if (features.includes('Outdoor Seating') && reasons.size < 3) reasons.add('Offers outdoor seating');
    if (restaurant.cuisineType?.includes('Authentic') && reasons.size < 3) reasons.add('Authentic Cuisine');
    if (restaurant.cuisineType?.includes('Regional') && reasons.size < 3) reasons.add('Regional Specialty');


    return { ...restaurant, recommendationReasons: Array.from(reasons).slice(0, 3) };
  });
}

function generateEnhancedSearchInsights(restaurants, query) {
  if (!restaurants || restaurants.length === 0) {
      return {
          totalRestaurants: 0, averageRating: 0, priceDistribution: {}, cuisineTypes: {},
          topFeatures: {}, qualityDistribution: {}, verificationRate: 0,
          message: "No restaurants found matching your criteria."
      };
  }
  const insights = {
    totalRestaurants: restaurants.length, averageRating: 0,
    priceDistribution: { '$': 0, '$$': 0, '$$$': 0, '$$$$': 0, 'Unknown': 0 },
    cuisineTypes: {}, topFeatures: {},
    qualityDistribution: { 'Budget': 0, 'Moderate': 0, 'Expensive': 0, 'Luxury': 0 }, // Based on categorizePriceLevel
    verificationRate: 0
  };
  
  let totalRatingSum = 0, ratedCount = 0, verifiedCount = 0;
  
  restaurants.forEach(r => {
    if (r.rating) { totalRatingSum += r.rating; ratedCount++; }
    if (r.crossPlatformVerified) verifiedCount++;
    
    const price = r.priceLevel || 'Unknown';
    insights.priceDistribution[price] = (insights.priceDistribution[price] || 0) + 1;
    
    const quality = r.priceCategory || 'Moderate'; // From enhanceRestaurantData
    insights.qualityDistribution[quality] = (insights.qualityDistribution[quality] || 0) + 1;
    
    const cuisineType = r.cuisineType || r.cuisine || 'Various';
    insights.cuisineTypes[cuisineType] = (insights.cuisineTypes[cuisineType] || 0) + 1;
    
    (r.specialFeatures || []).forEach(feature => {
      insights.topFeatures[feature] = (insights.topFeatures[feature] || 0) + 1;
    });
  });
  
  insights.averageRating = ratedCount > 0 ? parseFloat((totalRatingSum / ratedCount).toFixed(1)) : 0;
  insights.verificationRate = restaurants.length > 0 ? Math.round((verifiedCount / restaurants.length) * 100) : 0;
  
  // Sort topFeatures and cuisineTypes for better presentation if needed by frontend
  // insights.topFeatures = Object.fromEntries(Object.entries(insights.topFeatures).sort(([,a],[,b]) => b-a).slice(0,5));
  // insights.cuisineTypes = Object.fromEntries(Object.entries(insights.cuisineTypes).sort(([,a],[,b]) => b-a).slice(0,5));

  return insights;
}

function generateEnhancedContextualReviews(business) { // Fallback if AI synthetic reviews fail
  const reviews = [];
  const categories = business.categories?.map(c => c.title.toLowerCase()) || ['food'];
  const rating = business.rating || 4.0;
  const reviewCount = Math.min(business.review_count || 5, 3); // Generate fewer for template
  
  const templatesByRating = {
    5: [`Absolutely phenomenal! The ${categories[0]} was divine, and service impeccable at ${business.name}. A must-try!`, `Best ${categories[0]} I've had in ages. ${business.name} nails it every time.`],
    4: [`Really enjoyed ${business.name}. Great ${categories[0]} and a pleasant atmosphere. Solid choice.`, `Good food, good vibes at ${business.name}. Would recommend for ${categories[0]}.`],
    3: [`${business.name} was alright. The ${categories[0]} was decent, but nothing to write home about. Okay for a quick bite.`, `Average experience. Some hits and misses with the ${categories[0]} at ${business.name}.`],
    2: [` थोड़ा निराश हुआ ${business.name} से। उम्मीद थी ${categories[0]} बेहतर होगा।`, `Not the best experience at ${business.name}. Food was so-so.`], // Example of a different language for variety
    1: [`Unfortunately, a poor experience at ${business.name}. The ${categories[0]} was not good. Cannot recommend.`, `Very disappointed with ${business.name}. Would not go back.`]
  };
  
  for (let i = 0; i < reviewCount; i++) {
    const reviewRating = Math.max(1, Math.min(5, Math.round(rating + (Math.random() - 0.5) * 2))); // Wider variance
    const possibleTexts = templatesByRating[reviewRating] || templatesByRating[3];
    reviews.push({
      rating: reviewRating,
      text: possibleTexts[Math.floor(Math.random() * possibleTexts.length)],
      author: `Customer #${Math.floor(Math.random() * 10000)}`,
      time: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(), // Within last 6 months
      authenticity_score: parseFloat((0.6 + Math.random() * 0.15).toFixed(2)) // Lower score for templates
    });
  }
  return reviews;
}


async function getGoogleReviews(google_id) {
  try {
    const response = await axios.get(`http://localhost:${PORT}/api/google-reviews?place_id=${google_id}`, { timeout: 7000 });
    return { platform: 'google', data: response.data };
  } catch (error) {
    console.error(`Failed to get Google reviews for ${google_id}:`, error.message);
    return { platform: 'google', data: { reviews: [], error: error.message } };
  }
}

async function getYelpReviews(yelp_id) {
  try {
    const response = await axios.get(`http://localhost:${PORT}/api/yelp-reviews?business_id=${yelp_id}`, { timeout: 7000 });
    return { platform: 'yelp', data: response.data };
  } catch (error) {
    console.error(`Failed to get Yelp reviews for ${yelp_id}:`, error.message);
    return { platform: 'yelp', data: { reviews: [], error: error.message } };
  }
}

function performAdvancedAnalysisWithBalancing(reviewsData, restaurantName) {
  const platformReviews = { google: [], yelp: [] };
  let totalRatingsCount = 0;
  let weightedRatingSum = 0;
  let platformCount = 0;
  let restaurantNameToUse = restaurantName;

  reviewsData.forEach(({ platform, data }) => {
    if (data && data.restaurant_name && !restaurantNameToUse) restaurantNameToUse = data.restaurant_name;
    const reviewsList = data.reviews || [];
    if (reviewsList.length > 0) {
      if (!platformReviews[platform] || platformReviews[platform].length === 0) platformCount++; // Count distinct platforms with reviews
      
      platformReviews[platform] = (platformReviews[platform] || []).concat(reviewsList.map(r => ({
        ...r,
        platformSource: platform, // Keep track of original source
        // weight: platform === 'yelp' && r.user_review_count > 5 ? 1.1 : (platform === 'google' ? 1.0 : 0.9) // Example dynamic weighting
      })));
    }
  });
  
  const allReviewsCombined = Object.values(platformReviews).flat();
  
  allReviewsCombined.forEach(review => {
    if (review.rating != null) {
      totalRatingsCount++;
      weightedRatingSum += review.rating * (review.weight || 1.0); // Apply weight if defined
    }
  });


  if (totalRatingsCount === 0) {
    return generateFallbackAnalysis(restaurantNameToUse || "This Restaurant");
  }

  const balancedTopReviews = createBalancedTopReviews(platformReviews); // Pass organized platformReviews
  const unifiedScore = totalRatingsCount > 0 ? weightedRatingSum / (allReviewsCombined.reduce((sum, r) => sum + (r.weight || 1.0), 0)) : 0;
  const themes = analyzeEnhancedThemes(allReviewsCombined);
  const sentiment = analyzeEnhancedSentiment(allReviewsCombined);
  
  const volumeScore = Math.min(1, totalRatingsCount / 50) * 50; // Max 50 points for 50+ reviews
  const diversityScore = platformCount * 25; // 25 points per platform with reviews
  const confidence = Math.min(100, Math.round(volumeScore + diversityScore));
  const recentTrend = calculateAdvancedTrend(allReviewsCombined);

  return {
    restaurant_name: restaurantNameToUse, // Include the name used/derived
    unifiedScore: parseFloat(unifiedScore.toFixed(1)),
    totalReviews: totalRatingsCount,
    confidence: confidence,
    sentimentAnalysis: sentiment,
    themes,
    recentTrend,
    topReviews: balancedTopReviews,
    platformsUsed: platformCount,
    dataQuality: determineDataQuality(platformCount, totalRatingsCount, allReviewsCombined),
    competitiveAnalysis: generateEnhancedCompetitiveInsights(restaurantNameToUse, themes, unifiedScore),
    reviewBalance: calculateReviewBalance(platformReviews)
  };
}

function createBalancedTopReviews(platformReviewsMap) { // Expects {google: [], yelp: []}
  const balancedReviews = [];
  const MAX_TOP_REVIEWS = 5; // Reduced for conciseness

  const allAvailableReviews = [];
  Object.entries(platformReviewsMap).forEach(([platformName, reviews]) => {
      (reviews || []).forEach(review => {
          allAvailableReviews.push({
              ...review,
              platform: review.platformSource || platformName, // Ensure platform is set
              // Calculate a sort score: rating + authenticity + length bonus
              sortScore: (review.rating || 0) * 2 + (review.authenticity_score || 0.5) + (review.text?.length || 0) / 500
          });
      });
  });

  if (allAvailableReviews.length === 0) return [];

  // Sort all reviews by sortScore
  allAvailableReviews.sort((a, b) => b.sortScore - a.sortScore);
  
  const platformRepresentation = new Set();
  
  // Try to get one from each platform first if available
  for (const review of allAvailableReviews) {
      if (balancedReviews.length < MAX_TOP_REVIEWS && !platformRepresentation.has(review.platform)) {
          balancedReviews.push({
              rating: review.rating,
              text: review.text?.substring(0, 250) + (review.text?.length > 250 ? '...' : ''), // Truncate
              author: review.author,
              platform: review.platform,
              sentiment: classifyEnhancedReviewSentiment(review.text, review.rating),
              authenticity_score: review.authenticity_score
          });
          platformRepresentation.add(review.platform);
      }
  }
  
  // Fill remaining slots with best overall, avoiding duplicates already added
  for (const review of allAvailableReviews) {
      if (balancedReviews.length >= MAX_TOP_REVIEWS) break;
      const alreadyAdded = balancedReviews.some(br => br.text.startsWith(review.text.substring(0,250)) && br.author === review.author);
      if (!alreadyAdded) {
           balancedReviews.push({
              rating: review.rating,
              text: review.text?.substring(0, 250) + (review.text?.length > 250 ? '...' : ''),
              author: review.author,
              platform: review.platform,
              sentiment: classifyEnhancedReviewSentiment(review.text, review.rating),
              authenticity_score: review.authenticity_score
          });
      }
  }
  
  return balancedReviews;
}

function generateFallbackAnalysis(restaurantName) {
  return {
    restaurant_name: restaurantName,
    unifiedScore: 0, totalReviews: 0, confidence: 10,
    sentimentAnalysis: { positive: 0, neutral: 100, negative: 0 },
    themes: { food: {}, service: {}, ambiance: {}, value: {} },
    recentTrend: 'unknown', topReviews: [], platformsUsed: 0, dataQuality: 'very low',
    competitiveAnalysis: { message: "Not enough data for competitive insights." },
    message: 'Limited review data available. Analysis is based on estimates or defaults.',
    reviewBalance: { google: 0, yelp: 0 }
  };
}

function analyzeEnhancedThemes(reviews) {
  const themes = {
    food: { scoreSum: 0, mentions: 0, keywords: new Set(), sentimentRatings: [] },
    service: { scoreSum: 0, mentions: 0, keywords: new Set(), sentimentRatings: [] },
    ambiance: { scoreSum: 0, mentions: 0, keywords: new Set(), sentimentRatings: [] },
    value: { scoreSum: 0, mentions: 0, keywords: new Set(), sentimentRatings: [] }
  };
  
  reviews.forEach(review => {
    const text = (review.text || '').toLowerCase();
    const rating = review.rating;
    if (rating == null) return; // Skip reviews without rating for theme scoring

    Object.keys(ENHANCED_THEME_KEYWORDS).forEach(themeKey => {
      const { positive, negative, neutral } = ENHANCED_THEME_KEYWORDS[themeKey];
      let themeMentionedInReview = false;

      [...positive, ...negative, ...neutral].forEach(keyword => {
        if (text.includes(keyword)) {
          themes[themeKey].keywords.add(keyword);
          themeMentionedInReview = true;
        }
      });

      if (themeMentionedInReview) {
        themes[themeKey].mentions++;
        themes[themeKey].scoreSum += rating;
        // Basic sentiment association for the theme in this review
        let reviewThemeSentiment = rating; 
        if (negative.some(kw => text.includes(kw))) reviewThemeSentiment = Math.min(reviewThemeSentiment, 2.5); // Pull down if negative kw
        if (positive.some(kw => text.includes(kw))) reviewThemeSentiment = Math.max(reviewThemeSentiment, 3.5); // Pull up if positive kw
        themes[themeKey].sentimentRatings.push(reviewThemeSentiment);
      }
    });
  });
  
  const finalThemes = {};
  Object.keys(themes).forEach(themeKey => {
    const themeData = themes[themeKey];
    if (themeData.mentions > 0) {
      const averageRating = themeData.scoreSum / themeData.mentions;
      const averageSentiment = themeData.sentimentRatings.length > 0 ? 
                               themeData.sentimentRatings.reduce((a,b) => a+b, 0) / themeData.sentimentRatings.length : averageRating;
      finalThemes[themeKey] = {
        averageRating: parseFloat(averageRating.toFixed(1)),
        sentimentAdjustedScore: parseFloat(averageSentiment.toFixed(1)),
        mentions: themeData.mentions,
        keywords: Array.from(themeData.keywords).slice(0, 5), // Top 5 keywords
        mentionPercentage: parseFloat(((themeData.mentions / reviews.length) * 100).toFixed(1))
      };
    } else {
      finalThemes[themeKey] = { averageRating: 0, sentimentAdjustedScore: 0, mentions: 0, keywords: [], mentionPercentage: 0 };
    }
  });
  return finalThemes;
}

function analyzeEnhancedSentiment(reviews) {
  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
  if (reviews.length === 0) return { positive: 0, neutral: 100, negative: 0, breakdown: sentimentCounts };

  reviews.forEach(review => {
    const rating = review.rating;
    if (rating == null) return; // Skip if no rating

    // Simplified sentiment based on rating primarily for aggregate
    if (rating >= 4) sentimentCounts.positive++;
    else if (rating >= 3) sentimentCounts.neutral++;
    else sentimentCounts.negative++;
  });
  
  const total = reviews.length;
  return {
    positive: total > 0 ? Math.round((sentimentCounts.positive / total) * 100) : 0,
    neutral: total > 0 ? Math.round((sentimentCounts.neutral / total) * 100) : 0,
    negative: total > 0 ? Math.round((sentimentCounts.negative / total) * 100) : 0,
    breakdown: sentimentCounts // Raw counts
  };
}

function classifyEnhancedReviewSentiment(text, rating) { // For individual review display
  if (rating == null && !text) return 'neutral';
  if (rating == null && text) { // Infer from text if no rating
      const textLower = text.toLowerCase();
      if (ENHANCED_THEME_KEYWORDS.food.positive.some(kw => textLower.includes(kw))) return 'positive';
      if (ENHANCED_THEME_KEYWORDS.food.negative.some(kw => textLower.includes(kw))) return 'negative';
      return 'neutral';
  }
  if (rating >= 4) return 'positive';
  if (rating >= 3) return 'neutral';
  return 'negative';
}

function calculateAdvancedTrend(reviews) {
  if (reviews.length < 10) return 'stable'; // Need more data for a reliable trend

  const sortedByTime = reviews
    .filter(r => r.time && r.rating != null) // Ensure time and rating exist
    .sort((a, b) => (typeof a.time === 'string' ? new Date(a.time).getTime() : a.time) - (typeof b.time === 'string' ? new Date(b.time).getTime() : b.time)); // Handle string or number timestamps

  if (sortedByTime.length < 10) return 'stable';

  const L = sortedByTime.length;
  const firstThird = sortedByTime.slice(0, Math.floor(L / 3));
  const lastThird = sortedByTime.slice(Math.ceil(L * 2 / 3));

  if (firstThird.length === 0 || lastThird.length === 0) return 'stable';

  const avgOld = firstThird.reduce((sum, r) => sum + r.rating, 0) / firstThird.length;
  const avgNew = lastThird.reduce((sum, r) => sum + r.rating, 0) / lastThird.length;
  
  const diff = avgNew - avgOld;
  if (diff > 0.25) return 'improving';
  if (diff < -0.25) return 'declining';
  return 'stable';
}

function determineDataQuality(platformCount, totalReviewsCount, allReviewsList) {
  let score = 0;
  if (platformCount >= 2) score += 35; else if (platformCount === 1) score += 15;
  if (totalReviewsCount >= 100) score += 35; else if (totalReviewsCount >= 50) score += 25; else if (totalReviewsCount >= 10) score += 15;

  const avgAuth = allReviewsList.length > 0 ? allReviewsList.reduce((s, r) => s + (r.authenticity_score || 0.6), 0) / allReviewsList.length : 0.6;
  score += avgAuth * 30; // Max 30 points for authenticity

  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  if (score >= 25) return 'low';
  return 'very low';
}

function generateEnhancedCompetitiveInsights(restaurantName, themes, unifiedScore) {
  // This is a placeholder for what could be a very complex AI-driven function.
  // For now, it's rule-based.
  const insights = {
    positioningStatement: `For ${restaurantName || 'this establishment'}, with a score of ${unifiedScore.toFixed(1)}, key areas of focus are evident from customer feedback.`,
    strengths: [],
    areasForImprovement: [],
  };

  Object.entries(themes).forEach(([themeKey, themeData]) => {
    if (themeData.averageRating >= 4.0 && themeData.mentions > 0) {
      insights.strengths.push(`${themeKey.charAt(0).toUpperCase() + themeKey.slice(1)} (Score: ${themeData.sentimentAdjustedScore || themeData.averageRating})`);
    } else if (themeData.averageRating < 3.0 && themeData.mentions > 0) {
      insights.areasForImprovement.push(`${themeKey.charAt(0).toUpperCase() + themeKey.slice(1)} (Score: ${themeData.sentimentAdjustedScore || themeData.averageRating})`);
    }
  });

  if (insights.strengths.length === 0) insights.strengths.push("No standout strengths identified from current review themes.");
  if (insights.areasForImprovement.length === 0) insights.areasForImprovement.push("No significant areas for improvement identified from current review themes, or overall performance is adequate.");
  
  return insights;
}

function calculateReviewBalance(platformReviewsMap) {
  const balance = {};
  Object.keys(platformReviewsMap).forEach(platform => {
    balance[platform] = platformReviewsMap[platform]?.length || 0;
  });
  return balance;
}

function estimateWaitTime(restaurant) { // Placeholder, could be AI-driven with more data
  const rating = restaurant.rating || 3.5;
  const reviewCount = restaurant.reviewCount || restaurant.totalRatings || 20;
  const priceCategory = restaurant.priceCategory;

  if (priceCategory === 'Luxury' || (rating >= 4.5 && reviewCount > 200)) return '30-60 min';
  if (priceCategory === 'Expensive' || (rating >= 4.2 && reviewCount > 100)) return '20-45 min';
  if (rating >= 4.0) return '15-30 min';
  return '5-20 min';
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

function calculatePlatformConsistency(googleData, yelpData) {
  // Ensure data exists
  const gRating = googleData?.rating;
  const yRating = yelpData?.rating;
  const gCount = googleData?.totalRatings || 0;
  const yCount = yelpData?.reviewCount || 0;

  if (gRating == null || yRating == null) return 0.7; // Default if one platform is missing rating

  const ratingDiff = Math.abs(gRating - yRating);
  let consistencyScore = 1.0 - (ratingDiff / 4.0); // Max 4 point diff = 0 consistency

  // Weight by review count similarity (less variance if both have many reviews)
  const totalReviews = gCount + yCount;
  if (totalReviews > 0) {
      const reviewRatio = Math.min(gCount, yCount) / Math.max(gCount, yCount);
      // If one platform has very few reviews, consistency is less meaningful
      if (Math.min(gCount, yCount) < 10 && totalReviews > 20) {
          consistencyScore *= 0.8; // Reduce confidence if one source has few reviews
      }
      consistencyScore = (consistencyScore * 0.7) + (reviewRatio * 0.3);
  } else {
      consistencyScore *= 0.7; // No reviews on either, less confident
  }

  return Math.max(0, Math.min(1, parseFloat(consistencyScore.toFixed(2))));
}


// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Server shutting down gracefully...');
  // Add any cleanup tasks here (e.g., closing DB connections)
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Enhanced TruthTable server with Gemini AI running on port ${PORT}`);
  console.log(`Cache system initialized. CACHE_DURATION: ${CACHE_DURATION / 60000} minutes.`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY is not set. AI features will not function.');
  }
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.warn('GOOGLE_PLACES_API_KEY is not set. Google Places features will be limited.');
  }
  if (!process.env.YELP_API_KEY) {
    console.warn('YELP_API_KEY is not set. Yelp features will be limited.');
  }
});