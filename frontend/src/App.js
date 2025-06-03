import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, TrendingUp, Clock, Users, Shield, Award, Target, Lightbulb, ThumbsUp, Meh, ThumbsDown, CheckCircle, AlertCircle, Info, Navigation } from 'lucide-react';

const TruthTable = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [aggregatedScore, setAggregatedScore] = useState(null);
  const [searchInsights, setSearchInsights] = useState(null);
  const [filters, setFilters] = useState({
    priceRange: '',
    minRating: '',
    sortBy: 'smart'
  });

  // Auto-detect user's location on component mount
  useEffect(() => {
    detectUserLocation();
  }, []);

  // Detect user's current location
  const detectUserLocation = async () => {
    setLocationLoading(true);
    
    // Try browser geolocation first
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            // Reverse geocode to get city, state
            const response = await fetch(
              `https://api.opencagedata.com/geocode/v1/json?q=${position.coords.latitude}+${position.coords.longitude}&key=YOUR_API_KEY`
            );
            const data = await response.json();
            
            if (data.results && data.results[0]) {
              const result = data.results[0];
              const city = result.components.city || result.components.town || result.components.village;
              const state = result.components.state_code || result.components.state;
              const country = result.components.country_code;
              
              if (city && state && country === 'US') {
                setLocation(`${city}, ${state}`);
              } else if (city && country) {
                setLocation(`${city}, ${country}`);
              }
            }
          } catch (error) {
            console.error('Reverse geocoding failed:', error);
            // Fallback to default
            setLocation('Boston, MA');
          }
          setLocationLoading(false);
        },
        (error) => {
          console.error('Geolocation failed:', error);
          setLocation('Boston, MA');
          setLocationLoading(false);
        },
        { timeout: 10000 }
      );
    } else {
      // Fallback to IP-based location
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        if (data.city && data.region_code) {
          setLocation(`${data.city}, ${data.region_code}`);
        } else {
          setLocation('Boston, MA');
        }
      } catch (error) {
        console.error('IP location failed:', error);
        setLocation('Boston, MA');
      }
      setLocationLoading(false);
    }
  };

  // Handle search with user's location
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    // Prompt for location if not set
    if (!location.trim()) {
      const userLocation = prompt('Please enter your location (e.g., "New York, NY" or "San Francisco, CA"):');
      if (userLocation) {
        setLocation(userLocation.trim());
      } else {
        alert('Location is required for accurate search results.');
        return;
      }
    }

    setLoading(true);
    setSearchResults([]);
    setSearchInsights(null);
    
    try {
      const params = new URLSearchParams({
        query: searchQuery,
        location: location, // Now uses user's location
        sortBy: filters.sortBy
      });
      
      if (filters.priceRange) params.append('priceRange', filters.priceRange);
      if (filters.minRating) params.append('minRating', filters.minRating);

      const response = await fetch(`http://localhost:3001/api/search-restaurants?${params}`);
      const data = await response.json();
      
      setSearchResults(data.restaurants || []);
      setSearchInsights(data.searchInsights || null);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    }
    setLoading(false);
  };

  // Handle restaurant selection with enhanced API
  const handleRestaurantSelect = async (restaurant) => {
    setSelectedRestaurant(restaurant);
    setAnalysisLoading(true);
    setAggregatedScore(null);

    try {
      const params = new URLSearchParams();
      
      // Handle different ID types from merged data
      if (restaurant.id && restaurant.platform === 'google') {
        params.append('google_id', restaurant.id);
      } else if (restaurant.id && restaurant.platform === 'yelp') {
        params.append('yelp_id', restaurant.id);
      } else if (restaurant.id) {
        // For merged restaurants, try to determine the best ID to use
        params.append('google_id', restaurant.id);
      }
      
      if (restaurant.yelpId) {
        params.append('yelp_id', restaurant.yelpId);
      }
      
      params.append('name', restaurant.name);
      params.append('location', location); // Include location for context

      const response = await fetch(`http://localhost:3001/api/restaurant-analysis?${params}`);
      const data = await response.json();
      setAggregatedScore(data);
    } catch (error) {
      console.error('Error loading restaurant data:', error);
      setAggregatedScore({
        unifiedScore: 0,
        totalReviews: 0,
        confidence: 0,
        message: 'Unable to load restaurant analysis'
      });
    }
    setAnalysisLoading(false);
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
    if (score >= 4.0) return 'text-green-300';
    if (score >= 3.5) return 'text-yellow-400';
    if (score >= 3.0) return 'text-orange-400';
    return 'text-red-400';
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 80) return 'text-green-400';
    if (confidence >= 60) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getPriceColor = (priceLevel) => {
    const level = typeof priceLevel === 'string' ? priceLevel.length : priceLevel;
    switch (level) {
      case 1: return 'text-green-400';
      case 2: return 'text-yellow-400';
      case 3: return 'text-orange-400';
      case 4: return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const renderSentimentAnalysis = (sentiment) => {
    if (!sentiment) return null;
    
    return (
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <ThumbsUp className="w-5 h-5 mr-2" />
          Customer Sentiment
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ThumbsUp className="w-4 h-4 text-green-400" />
              <span className="text-gray-300">Positive</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-32 h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-400 rounded-full"
                  style={{ width: `${sentiment.positive}%` }}
                />
              </div>
              <span className="text-green-400 font-medium w-12 text-right">{sentiment.positive}%</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Meh className="w-4 h-4 text-yellow-400" />
              <span className="text-gray-300">Neutral</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-32 h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400 rounded-full"
                  style={{ width: `${sentiment.neutral}%` }}
                />
              </div>
              <span className="text-yellow-400 font-medium w-12 text-right">{sentiment.neutral}%</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ThumbsDown className="w-4 h-4 text-red-400" />
              <span className="text-gray-300">Negative</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-32 h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-400 rounded-full"
                  style={{ width: `${sentiment.negative}%` }}
                />
              </div>
              <span className="text-red-400 font-medium w-12 text-right">{sentiment.negative}%</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCompetitiveAnalysis = (analysis) => {
    if (!analysis) return null;
    
    return (
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Target className="w-5 h-5 mr-2" />
          Market Position
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Category</span>
            <span className="text-purple-400 font-medium">{analysis.category}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Position</span>
            <span className="text-white font-medium">{analysis.marketPosition}</span>
          </div>
          
          <div>
            <p className="text-gray-300 text-sm mb-2">Strengths</p>
            <div className="flex flex-wrap gap-2">
              {analysis.strengths?.map((strength, idx) => (
                <span key={idx} className="px-2 py-1 bg-green-500/20 text-green-300 rounded-full text-xs">
                  {strength}
                </span>
              ))}
            </div>
          </div>
          
          <div>
            <p className="text-gray-300 text-sm mb-2">Opportunities</p>
            <div className="flex flex-wrap gap-2">
              {analysis.opportunities?.map((opportunity, idx) => (
                <span key={idx} className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded-full text-xs">
                  {opportunity}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">TruthTable</h1>
                <p className="text-purple-300 text-sm">Intelligent Restaurant Discovery</p>
              </div>
            </div>
            {location && (
              <div className="flex items-center space-x-2 text-purple-300">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">Searching in {location}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Enhanced Search Section with Location */}
        <div className="mb-8">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
            {/* Location Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Search Location
              </label>
              <div className="flex space-x-3">
                <div className="flex-1 relative">
                  <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Enter city, state (e.g., New York, NY)"
                    className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={locationLoading}
                  />
                  {locationLoading && (
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin h-4 w-4 border-2 border-purple-500 border-t-transparent rounded-full"></div>
                    </div>
                  )}
                </div>
                <button
                  onClick={detectUserLocation}
                  disabled={locationLoading}
                  className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-purple-300 hover:bg-white/20 transition-colors duration-200 disabled:opacity-50"
                  title="Detect my location"
                >
                  <Navigation className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="flex space-x-4 mb-4">
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
                disabled={loading || !location.trim()}
                className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:transform-none"
                title={!location.trim() ? "Please enter a location first" : ""}
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
            
            {/* Filters */}
            <div className="flex space-x-4 text-sm">
              <select
                value={filters.priceRange}
                onChange={(e) => setFilters({...filters, priceRange: e.target.value})}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Any Price</option>
                <option value="$">$ - Budget</option>
                <option value="$$">$$ - Moderate</option>
                <option value="$$$">$$$ - Expensive</option>
                <option value="$$$$">$$$$ - Luxury</option>
              </select>
              
              <select
                value={filters.minRating}
                onChange={(e) => setFilters({...filters, minRating: e.target.value})}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Any Rating</option>
                <option value="4.0">4.0+ Stars</option>
                <option value="4.5">4.5+ Stars</option>
              </select>
              
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters({...filters, sortBy: e.target.value})}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="smart">Smart Ranking</option>
                <option value="rating">Highest Rated</option>
                <option value="distance">Nearest</option>
                <option value="price">Best Value</option>
              </select>
            </div>

            {/* Location requirement notice */}
            {!location.trim() && (
              <div className="mt-4 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center text-yellow-300 text-sm">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Location is required for accurate restaurant search results
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search Insights */}
        {searchInsights && (
          <div className="mb-6 bg-white/10 backdrop-blur-xl rounded-xl p-4 border border-white/20">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4">
                <span className="text-gray-300">
                  Found {searchInsights.totalRestaurants} restaurants near {location}
                </span>
                <span className="text-gray-300">
                  Avg Rating: {searchInsights.averageRating}
                </span>
              </div>
              <div className="flex space-x-2">
                {Object.entries(searchInsights.priceDistribution).map(([price, count]) => (
                  count > 0 && (
                    <span key={price} className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs">
                      {price} ({count})
                    </span>
                  )
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Enhanced Search Results */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Search Results</h2>
            {searchResults.map((restaurant) => (
              <div
                key={`${restaurant.platform}-${restaurant.id}`}
                onClick={() => handleRestaurantSelect(restaurant)}
                className="bg-white/10 backdrop-blur-xl rounded-xl p-6 border border-white/20 hover:bg-white/20 cursor-pointer transform hover:scale-105 transition-all duration-200"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-white">{restaurant.name}</h3>
                  <div className="flex items-center space-x-2">
                    <span className={`font-medium ${getPriceColor(restaurant.priceLevel)}`}>
                      {restaurant.priceLevel}
                    </span>
                    {restaurant.crossPlatformVerified && (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-4 text-gray-300 text-sm mb-3">
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-4 h-4" />
                    <span>{restaurant.address}</span>
                  </div>
                  {restaurant.rating && (
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span>{restaurant.rating}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-purple-500/30 text-purple-200 rounded-full text-xs">
                      {restaurant.cuisine}
                    </span>
                    {restaurant.cuisineType && (
                      <span className="px-2 py-1 bg-blue-500/30 text-blue-200 rounded-full text-xs">
                        {restaurant.cuisineType}
                      </span>
                    )}
                    {restaurant.specialFeatures?.slice(0, 2).map((feature, idx) => (
                      <span key={idx} className="px-2 py-1 bg-green-500/30 text-green-200 rounded-full text-xs">
                        {feature.replace('-', ' ')}
                      </span>
                    ))}
                  </div>
                  
                  {restaurant.intelligentScore && (
                    <div className="text-right">
                      <div className="text-purple-400 font-medium">
                        Score: {restaurant.intelligentScore}
                      </div>
                    </div>
                  )}
                </div>
                
                {restaurant.recommendationReasons && restaurant.recommendationReasons.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <p className="text-xs text-gray-400 mb-1">Why recommended:</p>
                    <p className="text-xs text-gray-300">
                      {restaurant.recommendationReasons.join(' • ')}
                    </p>
                  </div>
                )}
              </div>
            ))}

            {searchResults.length === 0 && searchQuery && !loading && (
              <div className="text-center py-12 text-gray-400">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No restaurants found in {location}. Try a different search term or location.</p>
              </div>
            )}
          </div>

          {/* Enhanced Restaurant Details */}
          <div className="space-y-6">
            {selectedRestaurant && (
              <>
                {analysisLoading ? (
                  <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-12 border border-white/20 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Analyzing restaurant data...</p>
                  </div>
                ) : aggregatedScore ? (
                  <>
                    {/* Enhanced TruthTable Score */}
                    <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                      <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-white mb-2">{selectedRestaurant.name}</h2>
                        <div className="flex items-center justify-center space-x-2 text-gray-300 mb-2">
                          <MapPin className="w-4 h-4" />
                          <span>{selectedRestaurant.address}</span>
                        </div>
                        <div className="flex items-center justify-center space-x-2">
                          <span className="text-gray-400 text-sm">Data from {aggregatedScore.platformsUsed} platform(s)</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            aggregatedScore.dataQuality === 'high' ? 'bg-green-500/20 text-green-300' :
                            aggregatedScore.dataQuality === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                            'bg-orange-500/20 text-orange-300'
                          }`}>
                            {aggregatedScore.dataQuality} quality
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="text-center">
                          <div className={`text-4xl font-bold ${getScoreColor(aggregatedScore.unifiedScore)} mb-2`}>
                            {aggregatedScore.unifiedScore ? aggregatedScore.unifiedScore.toFixed(1) : 'N/A'}
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
                            <span className={`font-medium ${getConfidenceColor(aggregatedScore.confidence)}`}>
                              {aggregatedScore.confidence}%
                            </span>
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

                      {aggregatedScore.message && (
                        <div className="mt-4 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                          <div className="flex items-center text-yellow-300 text-sm">
                            <Info className="w-4 h-4 mr-2" />
                            {aggregatedScore.message}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Enhanced Review Themes */}
                    {aggregatedScore.themes && (
                      <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                        <h3 className="text-lg font-semibold text-white mb-4">What People Talk About</h3>
                        <div className="space-y-4">
                          {Object.entries(aggregatedScore.themes).map(([theme, data]) => {
                            const themeData = typeof data === 'object' ? data : { mentions: data, score: 0 };
                            const maxMentions = Math.max(...Object.values(aggregatedScore.themes).map(t => 
                              typeof t === 'object' ? t.mentions : t
                            ));
                            
                            return (
                              <div key={theme} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-300 capitalize">{theme}</span>
                                  <div className="flex items-center space-x-2">
                                    {themeData.score > 0 && (
                                      <span className={`text-sm ${getScoreColor(themeData.score)}`}>
                                        {themeData.score.toFixed(1)}★
                                      </span>
                                    )}
                                    <span className="text-white text-sm">
                                      {themeData.mentions} mentions
                                    </span>
                                  </div>
                                </div>
                                <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                                    style={{ width: `${(themeData.mentions / maxMentions) * 100}%` }}
                                  />
                                </div>
                                {themeData.keywords && themeData.keywords.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {themeData.keywords.slice(0, 3).map((keyword, idx) => (
                                      <span key={idx} className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded">
                                        {keyword}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Sentiment Analysis */}
                    {aggregatedScore.sentimentAnalysis && renderSentimentAnalysis(aggregatedScore.sentimentAnalysis)}

                    {/* Top Reviews */}
                    {aggregatedScore.topReviews && aggregatedScore.topReviews.length > 0 && (
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
                                  {review.sentiment && (
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                      review.sentiment === 'positive' ? 'bg-green-500/20 text-green-300' :
                                      review.sentiment === 'negative' ? 'bg-red-500/20 text-red-300' :
                                      'bg-yellow-500/20 text-yellow-300'
                                    }`}>
                                      {review.sentiment}
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-1 rounded">
                                  {review.platform}
                                </span>
                              </div>
                              <p className="text-gray-300 text-sm leading-relaxed line-clamp-4">
                                {review.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Competitive Analysis */}
                    {aggregatedScore.competitiveAnalysis && renderCompetitiveAnalysis(aggregatedScore.competitiveAnalysis)}
                  </>
                ) : null}
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