import React, { useState, useEffect, useCallback } from 'react';
import { Search, MapPin, Star, TrendingUp, Clock, Users, Shield, Award, Target, Lightbulb, ThumbsUp, Meh, ThumbsDown, CheckCircle, AlertCircle, Info, Navigation, RefreshCw, X, ChevronDown } from 'lucide-react';

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
  const [error, setError] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [filters, setFilters] = useState({
    priceRange: '',
    minRating: '',
    sortBy: 'smart'
  });
  const [showFilters, setShowFilters] = useState(false);

  // Configuration - make this environment-based in production
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  const OPENCAGE_API_KEY = process.env.REACT_APP_OPENCAGE_API_KEY;

  // Auto-detect user's location on component mount
  useEffect(() => {
    detectUserLocation();
  }, []);

  // Enhanced location detection with better error handling
  const detectUserLocation = useCallback(async () => {
    setLocationLoading(true);
    setLocationError(null);
    
    try {
      // Try browser geolocation first
      if (navigator.geolocation) {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { 
            timeout: 15000,
            enableHighAccuracy: true,
            maximumAge: 300000 // 5 minutes
          });
        });

        try {
          // Only attempt reverse geocoding if we have an API key
          if (OPENCAGE_API_KEY) {
            const response = await fetch(
              `https://api.opencagedata.com/geocode/v1/json?q=${position.coords.latitude}+${position.coords.longitude}&key=${OPENCAGE_API_KEY}&no_annotations=1&limit=1`
            );
            
            if (response.ok) {
              const data = await response.json();
              
              if (data.results && data.results[0]) {
                const result = data.results[0];
                const city = result.components.city || result.components.town || result.components.village;
                const state = result.components.state_code || result.components.state;
                const country = result.components.country_code;
                
                if (city && state && country === 'US') {
                  setLocation(`${city}, ${state}`);
                  return;
                } else if (city && country) {
                  setLocation(`${city}, ${country}`);
                  return;
                }
              }
            }
          }
          
          // Fallback: Use coordinates directly
          setLocation(`${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
        } catch (geocodeError) {
          console.warn('Reverse geocoding failed:', geocodeError);
          setLocation(`${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
        }
      } else {
        throw new Error('Geolocation not supported');
      }
    } catch (geolocationError) {
      console.warn('Geolocation failed:', geolocationError);
      
      // Try IP-based location as fallback
      try {
        const response = await fetch('https://ipapi.co/json/', { timeout: 10000 });
        if (response.ok) {
          const data = await response.json();
          if (data.city && data.region_code) {
            setLocation(`${data.city}, ${data.region_code}`);
            return;
          }
        }
      } catch (ipError) {
        console.warn('IP location failed:', ipError);
      }
      
      // Final fallback
      setLocationError('Unable to detect location automatically');
      setLocation('');
    } finally {
      setLocationLoading(false);
    }
  }, [OPENCAGE_API_KEY]);

  // Enhanced search with better error handling
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search term');
      return;
    }

    if (!location.trim()) {
      setError('Please enter a location for accurate search results');
      return;
    }

    setLoading(true);
    setError(null);
    setSearchResults([]);
    setSearchInsights(null);
    setSelectedRestaurant(null);
    setAggregatedScore(null);
    
    try {
      const params = new URLSearchParams({
        query: searchQuery.trim(),
        location: location.trim(),
        sortBy: filters.sortBy
      });
      
      if (filters.priceRange) params.append('priceRange', filters.priceRange);
      if (filters.minRating) params.append('minRating', filters.minRating);

      const response = await fetch(`${API_BASE_URL}/api/search-restaurants?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setSearchResults(data.restaurants || []);
      setSearchInsights(data.searchInsights || null);
      
      if (!data.restaurants || data.restaurants.length === 0) {
        setError(`No restaurants found for "${searchQuery}" in ${location}. Try a different search term or location.`);
      }
    } catch (error) {
      console.error('Search error:', error);
      setError(`Search failed: ${error.message}`);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced restaurant selection with better error handling
  const handleRestaurantSelect = async (restaurant) => {
    setSelectedRestaurant(restaurant);
    setAnalysisLoading(true);
    setAggregatedScore(null);
    setError(null);

    try {
      const params = new URLSearchParams();
      
      // Handle different ID types from merged data
      if (restaurant.id && restaurant.platform === 'google') {
        params.append('google_id', restaurant.id);
      } else if (restaurant.id && restaurant.platform === 'yelp') {
        params.append('yelp_id', restaurant.id);
      } else if (restaurant.id) {
        params.append('google_id', restaurant.id);
      }
      
      if (restaurant.yelpId) {
        params.append('yelp_id', restaurant.yelpId);
      }
      
      params.append('name', restaurant.name);
      params.append('location', location);

      const response = await fetch(`${API_BASE_URL}/api/restaurant-analysis?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setAggregatedScore(data);
    } catch (error) {
      console.error('Error loading restaurant analysis:', error);
      setAggregatedScore({
        unifiedScore: 0,
        totalReviews: 0,
        confidence: 0,
        dataQuality: 'unavailable',
        message: `Unable to load restaurant analysis: ${error.message}`
      });
    } finally {
      setAnalysisLoading(false);
    }
  };

  // Utility functions
  const getTrendIcon = (trend) => {
    switch (trend?.toLowerCase()) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'declining': return <TrendingUp className="w-4 h-4 text-red-400 transform rotate-180" />;
      case 'stable': return <TrendingUp className="w-4 h-4 text-blue-400 transform rotate-90" />;
      default: return <TrendingUp className="w-4 h-4 text-gray-400 transform rotate-90" />;
    }
  };

  const getScoreColor = (score) => {
    if (!score || isNaN(score)) return 'text-gray-400';
    if (score >= 4.5) return 'text-green-400';
    if (score >= 4.0) return 'text-green-300';
    if (score >= 3.5) return 'text-yellow-400';
    if (score >= 3.0) return 'text-orange-400';
    return 'text-red-400';
  };

  const getConfidenceColor = (confidence) => {
    if (!confidence || isNaN(confidence)) return 'text-gray-400';
    if (confidence >= 80) return 'text-green-400';
    if (confidence >= 60) return 'text-yellow-400';
    if (confidence >= 40) return 'text-orange-400';
    return 'text-red-400';
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

  const getDataQualityColor = (quality) => {
    switch (quality?.toLowerCase()) {
      case 'high': return 'bg-green-500/20 text-green-300';
      case 'medium': return 'bg-yellow-500/20 text-yellow-300';
      case 'low': return 'bg-orange-500/20 text-orange-300';
      default: return 'bg-gray-500/20 text-gray-300';
    }
  };

  // Enhanced sentiment analysis component
  const renderSentimentAnalysis = (sentiment) => {
    if (!sentiment || typeof sentiment !== 'object') return null;
    
    const { positive = 0, neutral = 0, negative = 0 } = sentiment;
    const total = positive + neutral + negative;
    
    if (total === 0) return null;
    
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
                  className="h-full bg-green-400 rounded-full transition-all duration-500"
                  style={{ width: `${positive}%` }}
                />
              </div>
              <span className="text-green-400 font-medium w-12 text-right">{positive}%</span>
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
                  className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                  style={{ width: `${neutral}%` }}
                />
              </div>
              <span className="text-yellow-400 font-medium w-12 text-right">{neutral}%</span>
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
                  className="h-full bg-red-400 rounded-full transition-all duration-500"
                  style={{ width: `${negative}%` }}
                />
              </div>
              <span className="text-red-400 font-medium w-12 text-right">{negative}%</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Enhanced competitive analysis component
  const renderCompetitiveAnalysis = (analysis) => {
    if (!analysis || typeof analysis !== 'object') return null;
    
    return (
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Target className="w-5 h-5 mr-2" />
          Market Position
        </h3>
        <div className="space-y-4">
          {analysis.category && (
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Category</span>
              <span className="text-purple-400 font-medium">{analysis.category}</span>
            </div>
          )}
          {analysis.marketPosition && (
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Position</span>
              <span className="text-white font-medium">{analysis.marketPosition}</span>
            </div>
          )}
          
          {analysis.strengths && analysis.strengths.length > 0 && (
            <div>
              <p className="text-gray-300 text-sm mb-2">Strengths</p>
              <div className="flex flex-wrap gap-2">
                {analysis.strengths.map((strength, idx) => (
                  <span key={idx} className="px-2 py-1 bg-green-500/20 text-green-300 rounded-full text-xs">
                    {strength}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {analysis.opportunities && analysis.opportunities.length > 0 && (
            <div>
              <p className="text-gray-300 text-sm mb-2">Opportunities</p>
              <div className="flex flex-wrap gap-2">
                {analysis.opportunities.map((opportunity, idx) => (
                  <span key={idx} className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded-full text-xs">
                    {opportunity}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Enhanced error display component
  const ErrorAlert = ({ message, onDismiss }) => (
    <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center text-red-300">
          <AlertCircle className="w-4 h-4 mr-2" />
          <span className="text-sm">{message}</span>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-red-300 hover:text-red-100">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

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
            <div className="flex items-center space-x-4">
              {location && (
                <div className="flex items-center space-x-2 text-purple-300">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">Searching in {location}</span>
                </div>
              )}
              {locationError && (
                <div className="flex items-center space-x-2 text-orange-300">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">Location detection failed</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Enhanced Search Section */}
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
                    className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
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
                  {locationLoading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Navigation className="w-5 h-5" />
                  )}
                </button>
              </div>
              {locationError && (
                <p className="text-orange-300 text-xs mt-2 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {locationError}
                </p>
              )}
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
                  className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={loading || !location.trim() || !searchQuery.trim()}
                className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:transform-none"
                title={!location.trim() ? "Please enter a location first" : !searchQuery.trim() ? "Please enter a search term" : ""}
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Searching...</span>
                  </div>
                ) : (
                  'Search'
                )}
              </button>
            </div>
            
            {/* Enhanced Filters */}
            <div className="space-y-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 text-purple-300 hover:text-purple-200 transition-colors duration-200"
              >
                <span className="text-sm">Advanced Filters</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
              </button>
              
              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Price Range</label>
                    <select
                      value={filters.priceRange}
                      onChange={(e) => setFilters({...filters, priceRange: e.target.value})}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200"
                    >
                      <option value="">Any Price</option>
                      <option value="$">$ - Budget</option>
                      <option value="$$">$$ - Moderate</option>
                      <option value="$$$">$$$ - Expensive</option>
                      <option value="$$$$">$$$$ - Luxury</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Minimum Rating</label>
                    <select
                      value={filters.minRating}
                      onChange={(e) => setFilters({...filters, minRating: e.target.value})}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200"
                    >
                      <option value="">Any Rating</option>
                      <option value="3.0">3.0+ Stars</option>
                      <option value="3.5">3.5+ Stars</option>
                      <option value="4.0">4.0+ Stars</option>
                      <option value="4.5">4.5+ Stars</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Sort By</label>
                    <select
                      value={filters.sortBy}
                      onChange={(e) => setFilters({...filters, sortBy: e.target.value})}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200"
                    >
                      <option value="smart">Smart Ranking</option>
                      <option value="rating">Highest Rated</option>
                      <option value="distance">Nearest</option>
                      <option value="price">Best Value</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Error Display */}
            {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}
          </div>
        </div>

        {/* Search Insights */}
        {searchInsights && (
          <div className="mb-6 bg-white/10 backdrop-blur-xl rounded-xl p-4 border border-white/20">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0 text-sm">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-gray-300">
                  Found {searchInsights.totalRestaurants} restaurants near {location}
                </span>
                {searchInsights.averageRating && (
                  <span className="text-gray-300">
                    Avg Rating: {searchInsights.averageRating}
                  </span>
                )}
              </div>
              {searchInsights.priceDistribution && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(searchInsights.priceDistribution).map(([price, count]) => (
                    count > 0 && (
                      <span key={price} className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs">
                        {price} ({count})
                      </span>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Enhanced Search Results */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Search Results</h2>
            {searchResults.map((restaurant, index) => (
              <div
                key={`${restaurant.platform}-${restaurant.id}-${index}`}
                onClick={() => handleRestaurantSelect(restaurant)}
                className={`bg-white/10 backdrop-blur-xl rounded-xl p-6 border border-white/20 hover:bg-white/20 cursor-pointer transform hover:scale-105 transition-all duration-200 ${
                  selectedRestaurant?.id === restaurant.id ? 'ring-2 ring-purple-500' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-white pr-4">{restaurant.name}</h3>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {restaurant.priceLevel && (
                      <span className={`font-medium ${getPriceColor(restaurant.priceLevel)}`}>
                        {restaurant.priceLevel}
                      </span>
                    )}
                    {restaurant.crossPlatformVerified && (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col space-y-2 text-gray-300 text-sm mb-3">
                  {restaurant.address && (
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{restaurant.address}</span>
                    </div>
                  )}
                  {restaurant.rating && (
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current flex-shrink-0" />
                      <span>{restaurant.rating}</span>
                      {restaurant.totalReviews && (
                        <span className="text-gray-400">({restaurant.totalReviews} reviews)</span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    {restaurant.cuisine && (
                      <span className="px-2 py-1 bg-purple-500/30 text-purple-200 rounded-full text-xs">
                        {restaurant.cuisine}
                      </span>
                    )}
                    {restaurant.cuisineType && restaurant.cuisineType !== restaurant.cuisine && (
                      <span className="px-2 py-1 bg-blue-500/30 text-blue-200 rounded-full text-xs">
                        {restaurant.cuisineType}
                      </span>
                    )}
                    {restaurant.specialFeatures?.slice(0, 2).map((feature, idx) => (
                      <span key={idx} className="px-2 py-1 bg-green-500/30 text-green-200 rounded-full text-xs">
                        {feature.replace(/[-_]/g, ' ')}
                      </span>
                    ))}
                  </div>
                  
                  {restaurant.intelligentScore && (
                    <div className="text-right">
                      <div className="text-purple-400 font-medium text-sm">
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

            {searchResults.length === 0 && searchQuery && !loading && !error && (
              <div className="text-center py-12 text-gray-400">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No restaurants found for "{searchQuery}" in {location}.</p>
                <p className="text-sm mt-2">Try a different search term or location.</p>
              </div>
            )}

            {!searchQuery && !loading && (
              <div className="text-center py-12 text-gray-400">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Enter a search term and location to find restaurants.</p>
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
                    <p className="text-gray-500 text-sm mt-2">This may take a few moments</p>
                  </div>
                ) : aggregatedScore ? (
                  <>
                    {/* Enhanced TruthTable Score */}
                    <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                      <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-white mb-2">{selectedRestaurant.name}</h2>
                        <div className="flex items-center justify-center space-x-2 text-gray-300 mb-2">
                          <MapPin className="w-4 h-4" />
                          <span className="text-sm">{selectedRestaurant.address}</span>
                        </div>
                        <div className="flex items-center justify-center space-x-3 text-sm">
                          <span className="text-gray-400">
                            Data from {aggregatedScore.platformsUsed || 1} platform(s)
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${getDataQualityColor(aggregatedScore.dataQuality)}`}>
                            {aggregatedScore.dataQuality || 'unknown'} quality
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
                                className={`w-4 h-4 ${i < Math.floor(aggregatedScore.unifiedScore || 0) ? 'text-yellow-400 fill-current' : 'text-gray-500'}`}
                              />
                            ))}
                          </div>
                          <p className="text-sm text-gray-400">TruthTable Score</p>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300 text-sm">Confidence</span>
                            <span className={`font-medium ${getConfidenceColor(aggregatedScore.confidence)}`}>
                              {aggregatedScore.confidence || 0}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300 text-sm">Total Reviews</span>
                            <span className="text-white font-medium">{aggregatedScore.totalReviews || 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300 text-sm">Trend</span>
                            <div className="flex items-center space-x-1">
                              {getTrendIcon(aggregatedScore.recentTrend)}
                              <span className="text-white text-sm capitalize">{aggregatedScore.recentTrend || 'stable'}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {aggregatedScore.message && (
                        <div className="mt-4 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                          <div className="flex items-start text-yellow-300 text-sm">
                            <Info className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                            <span>{aggregatedScore.message}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Enhanced Review Themes */}
                    {aggregatedScore.themes && Object.keys(aggregatedScore.themes).length > 0 && (
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
                                  <span className="text-gray-300 capitalize font-medium">{theme}</span>
                                  <div className="flex items-center space-x-3">
                                    {themeData.score > 0 && (
                                      <span className={`text-sm font-medium ${getScoreColor(themeData.score)}`}>
                                        {themeData.score.toFixed(1)}★
                                      </span>
                                    )}
                                    <span className="text-white text-sm">
                                      {themeData.mentions} mention{themeData.mentions !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                </div>
                                <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-700"
                                    style={{ width: `${(themeData.mentions / maxMentions) * 100}%` }}
                                  />
                                </div>
                                {themeData.keywords && themeData.keywords.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {themeData.keywords.slice(0, 4).map((keyword, idx) => (
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
                        <h3 className="text-lg font-semibold text-white mb-4">Featured Reviews</h3>
                        <div className="space-y-4">
                          {aggregatedScore.topReviews.slice(0, 10).map((review, index) => (
                            <div key={index} className="bg-white/10 rounded-xl p-4 border border-white/10">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center space-x-3">
                                  <div className="flex items-center">
                                    {[...Array(5)].map((_, i) => (
                                      <Star
                                        key={i}
                                        className={`w-3 h-3 ${i < (review.rating || 0) ? 'text-yellow-400 fill-current' : 'text-gray-500'}`}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-gray-400 text-sm">{review.author || 'Anonymous'}</span>
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
                                <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-1 rounded flex-shrink-0">
                                  {review.platform || 'Unknown'}
                                </span>
                              </div>
                              <p className="text-gray-300 text-sm leading-relaxed">
                                {review.text || 'No review text available'}
                              </p>
                              {review.authenticity_score && (
                                <div className="mt-2 text-xs text-gray-400">
                                  Authenticity: {(review.authenticity_score * 100).toFixed(0)}%
                                </div>
                              )}
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