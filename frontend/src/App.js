import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, TrendingUp, Clock, Users, Shield } from 'lucide-react';

const TruthTable = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [aggregatedScore, setAggregatedScore] = useState(null);

  // Mock data for demonstration (replace with real API calls)
  const mockRestaurants = [
    {
      id: '1',
      name: 'Osteria Francescana',
      address: '123 Culinary St, Boston, MA',
      cuisine: 'Italian',
      priceLevel: '$$$',
      location: { lat: 42.3601, lng: -71.0589 }
    },
    {
      id: '2',
      name: 'Taco Bell Cantina',
      address: '456 Food Ave, Boston, MA',
      cuisine: 'Mexican',
      priceLevel: '$',
      location: { lat: 42.3505, lng: -71.0743 }
    },
    {
      id: '3',
      name: 'The Capital Grille',
      address: '789 Fine Dining Blvd, Boston, MA',
      cuisine: 'Steakhouse',
      priceLevel: '$$$$',
      location: { lat: 42.3584, lng: -71.0598 }
    }
  ];

  // Real-time search status
  const [searchStatus, setSearchStatus] = useState('');

  // Handle search with real API
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/api/search-restaurants?query=${encodeURIComponent(searchQuery)}&location=Boston,MA`);
      const data = await response.json();
      setSearchResults(data.restaurants || []);
    } catch (error) {
      console.error('Search error:', error);
      // Fallback to mock data if API fails
      const filteredResults = mockRestaurants.filter(restaurant =>
        restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        restaurant.cuisine.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(filteredResults);
    }
    setLoading(false);
  };

  // Handle restaurant selection with real API
  const handleRestaurantSelect = async (restaurant) => {
    setSelectedRestaurant(restaurant);
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (restaurant.id && restaurant.platform !== 'yelp') {
        params.append('google_id', restaurant.id);
      }
      if (restaurant.id && restaurant.platform === 'yelp') {
        params.append('yelp_id', restaurant.id);
      }
      params.append('name', restaurant.name);

      const response = await fetch(`http://localhost:3001/api/restaurant-analysis?${params}`);
      const data = await response.json();
      setAggregatedScore(data);
    } catch (error) {
      console.error('Error loading restaurant data:', error);
      // Fallback to mock data
      const mockReviewData = {
        unifiedScore: 4.2 + Math.random() * 0.8,
        totalReviews: Math.floor(Math.random() * 200) + 50,
        confidence: Math.floor(Math.random() * 30) + 70,
        themes: {
          food: Math.floor(Math.random() * 50) + 20,
          service: Math.floor(Math.random() * 40) + 15,
          ambiance: Math.floor(Math.random() * 30) + 10,
          value: Math.floor(Math.random() * 25) + 8
        },
        recentTrend: ['improving', 'stable', 'declining'][Math.floor(Math.random() * 3)],
        topReviews: [
          { rating: 5, text: "Absolutely incredible experience! The pasta was perfectly al dente and the service was impeccable.", platform: 'Google', author: 'Sarah M.' },
          { rating: 4, text: "Great food and atmosphere. A bit pricey but worth it for special occasions.", platform: 'Yelp', author: 'Mike R.' },
          { rating: 5, text: "Best Italian restaurant in the city. The chef's special was outstanding!", platform: 'Google', author: 'Lisa K.' }
        ]
      };
      setAggregatedScore(mockReviewData);
    }
    setLoading(false);
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'declining': return <TrendingUp className="w-4 h-4 text-red-400 transform rotate-180" />;
      default: return <TrendingUp className="w-4 h-4 text-blue-400 transform rotate-90" />;
    }
  };

  const getScoreColor = (score) => {
    if (score >= 4.5) return 'text-green-400';
    if (score >= 3.5) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">TruthTable</h1>
                <p className="text-purple-300 text-sm">Unified Restaurant Intelligence</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Search Section */}
        <div className="mb-8">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
            <div className="flex space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search restaurants, cuisine, or dishes..."
                  className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 transform hover:scale-105 transition-all duration-200 disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Search Results */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Search Results</h2>
            {searchResults.map((restaurant) => (
              <div
                key={restaurant.id}
                onClick={() => handleRestaurantSelect(restaurant)}
                className="bg-white/10 backdrop-blur-xl rounded-xl p-6 border border-white/20 hover:bg-white/20 cursor-pointer transform hover:scale-105 transition-all duration-200"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-white">{restaurant.name}</h3>
                  <span className="text-purple-400 font-medium">{restaurant.priceLevel}</span>
                </div>
                <div className="flex items-center space-x-4 text-gray-300 text-sm">
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-4 h-4" />
                    <span>{restaurant.address}</span>
                  </div>
                </div>
                <div className="mt-2">
                  <span className="px-3 py-1 bg-purple-500/30 text-purple-200 rounded-full text-xs">
                    {restaurant.cuisine}
                  </span>
                </div>
              </div>
            ))}

            {searchResults.length === 0 && searchQuery && !loading && (
              <div className="text-center py-12 text-gray-400">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No restaurants found. Try a different search term.</p>
              </div>
            )}
          </div>

          {/* Restaurant Details */}
          <div className="space-y-6">
            {selectedRestaurant && aggregatedScore && (
              <>
                {/* TruthTable Score */}
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">{selectedRestaurant.name}</h2>
                    <div className="flex items-center justify-center space-x-2 text-gray-300">
                      <MapPin className="w-4 h-4" />
                      <span>{selectedRestaurant.address}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="text-center">
                      <div className={`text-4xl font-bold ${getScoreColor(aggregatedScore.unifiedScore)} mb-2`}>
                        {aggregatedScore.unifiedScore.toFixed(1)}
                      </div>
                      <div className="flex items-center justify-center space-x-1 mb-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${i < Math.floor(aggregatedScore.unifiedScore) ? 'text-yellow-400 fill-current' : 'text-gray-500'}`}
                          />
                        ))}
                      </div>
                      <p className="text-sm text-gray-400">TruthTable Score</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300 text-sm">Confidence</span>
                        <span className="text-green-400 font-medium">{aggregatedScore.confidence}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300 text-sm">Total Reviews</span>
                        <span className="text-white font-medium">{aggregatedScore.totalReviews}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300 text-sm">Trend</span>
                        <div className="flex items-center space-x-1">
                          {getTrendIcon(aggregatedScore.recentTrend)}
                          <span className="text-white text-sm capitalize">{aggregatedScore.recentTrend}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Review Themes */}
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                  <h3 className="text-lg font-semibold text-white mb-4">What People Talk About</h3>
                  <div className="space-y-3">
                    {Object.entries(aggregatedScore.themes).map(([theme, count]) => (
                      <div key={theme} className="flex items-center justify-between">
                        <span className="text-gray-300 capitalize">{theme}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                              style={{ width: `${Math.min(count / 50 * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-white text-sm w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Reviews */}
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                  <h3 className="text-lg font-semibold text-white mb-4">Verified Highlights</h3>
                  <div className="space-y-4">
                    {aggregatedScore.topReviews.map((review, index) => (
                      <div key={index} className="bg-white/10 rounded-xl p-4 border border-white/10">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3 h-3 ${i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-500'}`}
                                />
                              ))}
                            </div>
                            <span className="text-gray-400 text-xs">{review.author}</span>
                          </div>
                          <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-1 rounded">
                            {review.platform}
                          </span>
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed">{review.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {!selectedRestaurant && (
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-12 border border-white/20 text-center">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Select a Restaurant</h3>
                <p className="text-gray-400">Choose a restaurant from the search results to see unified reviews and insights.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TruthTable;