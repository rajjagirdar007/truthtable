// server.js - Express backend
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Google Places API endpoints
app.get('/api/google-places', async (req, res) => {
    try {
        const { query, location } = req.query;
        const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
            params: {
                query: `${query} restaurant ${location}`,
                key: process.env.GOOGLE_PLACES_API_KEY
            }
        });

        const restaurants = response.data.results.map(place => ({
            id: place.place_id,
            name: place.name,
            address: place.formatted_address,
            rating: place.rating,
            priceLevel: '$'.repeat(place.price_level || 1),
            cuisine: place.types.find(type =>
                ['restaurant', 'food', 'meal_takeaway'].includes(type)
            ) || 'Restaurant',
            location: place.geometry.location,
            photoReference: place.photos?.[0]?.photo_reference
        }));

        res.json({ results: restaurants });
    } catch (error) {
        console.error('Google Places API error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch Google Places data' });
    }
});

app.get('/api/google-reviews', async (req, res) => {
    try {
        const { place_id } = req.query;
        const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
            params: {
                place_id,
                fields: 'reviews,rating,user_ratings_total',
                key: process.env.GOOGLE_PLACES_API_KEY
            }
        });

        const reviews = response.data.result.reviews?.map(review => ({
            rating: review.rating,
            text: review.text,
            author: review.author_name,
            time: review.time,
            relative_time: review.relative_time_description
        })) || [];

        res.json({
            reviews,
            rating: response.data.result.rating,
            total_ratings: response.data.result.user_ratings_total
        });
    } catch (error) {
        console.error('Google Reviews API error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch Google reviews' });
    }
});

// Yelp API endpoints
app.get('/api/yelp-search', async (req, res) => {
    try {
        const { term, location } = req.query;
        const response = await axios.get('https://api.yelp.com/v3/businesses/search', {
            headers: {
                'Authorization': `Bearer ${process.env.YELP_API_KEY}`
            },
            params: {
                term: `${term} restaurant`,
                location,
                categories: 'restaurants',
                limit: 20
            }
        });

        const businesses = response.data.businesses.map(business => ({
            id: business.id,
            name: business.name,
            address: business.location.display_address.join(', '),
            rating: business.rating,
            priceLevel: business.price || '$',
            cuisine: business.categories[0]?.title || 'Restaurant',
            location: business.coordinates,
            imageUrl: business.image_url,
            reviewCount: business.review_count
        }));

        res.json({ businesses });
    } catch (error) {
        console.error('Yelp Search API error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch Yelp data' });
    }
});

app.get('/api/yelp-reviews', async (req, res) => {
    try {
        const { business_id } = req.query;
        const response = await axios.get(`https://api.yelp.com/v3/businesses/${business_id}/reviews`, {
            headers: {
                'Authorization': `Bearer ${process.env.YELP_API_KEY}`
            }
        });

        const reviews = response.data.reviews.map(review => ({
            rating: review.rating,
            text: review.text,
            author: review.user.name,
            time: review.time_created
        }));

        res.json({ reviews });
    } catch (error) {
        console.error('Yelp Reviews API error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch Yelp reviews' });
    }
});

// Combined search endpoint that merges results
app.get('/api/search-restaurants', async (req, res) => {
    try {
        const { query, location = 'Boston,MA' } = req.query;

        // Search both platforms simultaneously
        const [googleResponse, yelpResponse] = await Promise.all([
            axios.get(`http://localhost:${PORT}/api/google-places?query=${encodeURIComponent(query)}&location=${location}`),
            axios.get(`http://localhost:${PORT}/api/yelp-search?term=${encodeURIComponent(query)}&location=${location}`)
        ]);

        const googleRestaurants = googleResponse.data.results || [];
        const yelpRestaurants = yelpResponse.data.businesses || [];

        // Merge and deduplicate results based on name similarity
        const allRestaurants = [...googleRestaurants];

        yelpRestaurants.forEach(yelpRestaurant => {
            const isDuplicate = googleRestaurants.some(googleRestaurant =>
                similarity(googleRestaurant.name.toLowerCase(), yelpRestaurant.name.toLowerCase()) > 0.8
            );

            if (!isDuplicate) {
                allRestaurants.push({
                    ...yelpRestaurant,
                    platform: 'yelp'
                });
            }
        });

        res.json({ restaurants: allRestaurants });
    } catch (error) {
        console.error('Combined search error:', error.message);
        res.status(500).json({ error: 'Failed to search restaurants' });
    }
});

// Get aggregated reviews for a restaurant
app.get('/api/restaurant-analysis', async (req, res) => {
    try {
        const { google_id, yelp_id, name } = req.query;

        const reviewPromises = [];

        if (google_id) {
            reviewPromises.push(
                axios.get(`http://localhost:${PORT}/api/google-reviews?place_id=${google_id}`)
                    .then(response => ({ platform: 'google', data: response.data }))
                    .catch(() => ({ platform: 'google', data: { reviews: [] } }))
            );
        }

        if (yelp_id) {
            reviewPromises.push(
                axios.get(`http://localhost:${PORT}/api/yelp-reviews?business_id=${yelp_id}`)
                    .then(response => ({ platform: 'yelp', data: response.data }))
                    .catch(() => ({ platform: 'yelp', data: { reviews: [] } }))
            );
        }

        const reviewsData = await Promise.all(reviewPromises);

        // Process and analyze reviews
        const allReviews = [];
        let totalRatings = 0;
        let weightedSum = 0;

        reviewsData.forEach(({ platform, data }) => {
            const platformReviews = data.reviews || [];
            const weight = platform === 'yelp' ? 0.8 : 0.6; // Yelp generally has better moderation

            platformReviews.forEach(review => {
                allReviews.push({
                    ...review,
                    platform,
                    weight
                });
                totalRatings++;
                weightedSum += review.rating * weight;
            });
        });

        // Calculate unified score
        const unifiedScore = totalRatings > 0 ? weightedSum / totalRatings : 0;

        // Analyze review themes
        const themes = analyzeReviewThemes(allReviews);

        // Calculate confidence based on review volume and platform diversity
        const confidence = Math.min((totalRatings / 20) * 100, 100);

        // Determine trend (simplified)
        const recentTrend = calculateTrend(allReviews);

        res.json({
            unifiedScore: Math.round(unifiedScore * 10) / 10,
            totalReviews: totalRatings,
            confidence: Math.round(confidence),
            themes,
            recentTrend,
            topReviews: allReviews
                .sort((a, b) => b.rating - a.rating)
                .slice(0, 3)
                .map(review => ({
                    rating: review.rating,
                    text: review.text,
                    author: review.author,
                    platform: review.platform
                }))
        });

    } catch (error) {
        console.error('Restaurant analysis error:', error.message);
        res.status(500).json({ error: 'Failed to analyze restaurant' });
    }
});

// Helper functions
function similarity(s1, s2) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s2.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s1.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (s1.charAt(j - 1) !== s2.charAt(i - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[s1.length] = lastValue;
    }
    return costs[s1.length];
}

function analyzeReviewThemes(reviews) {
    const themes = { food: 0, service: 0, ambiance: 0, value: 0 };

    reviews.forEach(review => {
        const text = (review.text || '').toLowerCase();

        // Food-related keywords
        if (text.match(/\b(food|taste|delicious|flavor|dish|meal|cuisine|chef|cook)\b/g)) {
            themes.food++;
        }

        // Service-related keywords
        if (text.match(/\b(service|staff|waiter|server|friendly|rude|slow|fast|attentive)\b/g)) {
            themes.service++;
        }

        // Ambiance-related keywords
        if (text.match(/\b(atmosphere|ambiance|decor|music|loud|quiet|romantic|cozy)\b/g)) {
            themes.ambiance++;
        }

        // Value-related keywords
        if (text.match(/\b(price|expensive|cheap|value|worth|cost|affordable|overpriced)\b/g)) {
            themes.value++;
        }
    });

    return themes;
}

function calculateTrend(reviews) {
    if (reviews.length < 10) return 'stable';

    // Sort by time (most recent first)
    const sortedReviews = reviews
        .filter(r => r.time)
        .sort((a, b) => new Date(b.time) - new Date(a.time));

    if (sortedReviews.length < 10) return 'stable';

    const recentAvg = sortedReviews.slice(0, 5).reduce((sum, r) => sum + r.rating, 0) / 5;
    const olderAvg = sortedReviews.slice(-5).reduce((sum, r) => sum + r.rating, 0) / 5;

    if (recentAvg > olderAvg + 0.3) return 'improving';
    if (recentAvg < olderAvg - 0.3) return 'declining';
    return 'stable';
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});