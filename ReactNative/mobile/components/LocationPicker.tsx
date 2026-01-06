import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Modal, ActivityIndicator, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useWindowDimensions } from 'react-native';
import { useTheme } from '@/lib/theme';

type PlacePrediction = {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
};

type LocationPickerProps = {
  label: string;
  value: string;
  onChange: (location: string) => void;
  placeholder?: string;
  required?: boolean;
  googleApiKey?: string;
};

export default function LocationPicker({
  label,
  value,
  onChange,
  placeholder = 'Search for an address',
  required,
  googleApiKey,
}: LocationPickerProps) {
  const [searchText, setSearchText] = useState(value);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { height: screenHeight } = useWindowDimensions();
  const { colors } = useTheme();

  useEffect(() => {
    setSearchText(value);
  }, [value]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!searchText.trim() || searchText.length < 3) {
      setPredictions([]);
      return;
    }

    if (!googleApiKey) {
      // If no API key, just allow manual input
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
            searchText
          )}&key=${googleApiKey}&types=address`
        );
        const data = await response.json();
        if (data.predictions) {
          setPredictions(data.predictions);
        }
      } catch (error) {
        console.error('Error fetching places:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchText, googleApiKey]);

  const handleSelectPlace = (prediction: PlacePrediction) => {
    setSearchText(prediction.description);
    onChange(prediction.description);
    setPredictions([]);
  };

  const handleUseCurrentLocation = async () => {
    try {
      // Try to use expo-location if available
      let Location: any = null;
      try {
        const expoLocation = require('expo-location');
        Location = expoLocation.Location || expoLocation;
      } catch {
        // expo-location not installed, skip location feature
        Alert.alert('Info', 'Location feature requires expo-location package. Please install it or enter address manually.');
        return;
      }
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this feature');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      if (googleApiKey) {
        // Reverse geocode to get address
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleApiKey}`
        );
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const address = data.results[0].formatted_address;
          setSearchText(address);
          onChange(address);
        }
      } else {
        setSearchText(`${latitude}, ${longitude}`);
        onChange(`${latitude}, ${longitude}`);
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to get current location');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text }]}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <View style={[styles.inputContainer, { 
        backgroundColor: colors.inputBackground || colors.card,
        borderColor: colors.border
      }]}>
        <TextInput
          style={[styles.input, { color: colors.inputText }]}
          value={searchText}
          onChangeText={(text) => {
            setSearchText(text);
            onChange(text);
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
        />
        {googleApiKey && (
          <TouchableOpacity
            style={[styles.locationButton, { borderLeftColor: colors.border }]}
            onPress={handleUseCurrentLocation}
          >
            <Ionicons name="locate-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {predictions.length > 0 && (
        <View style={[styles.predictionsContainer, {
          backgroundColor: colors.card,
          borderColor: colors.border
        }]}>
          {predictions.map((item, index) => (
            <TouchableOpacity
              key={item.place_id}
              style={[
                styles.predictionItem,
                index === predictions.length - 1 && styles.predictionItemLast,
                { borderBottomColor: colors.border }
              ]}
              onPress={() => handleSelectPlace(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="location-outline" size={18} color={colors.icon} style={styles.predictionIcon} />
              <View style={styles.predictionText}>
                <Text style={[styles.predictionMain, { color: colors.text }]}>
                  {item.structured_formatting?.main_text || item.description}
                </Text>
                {item.structured_formatting?.secondary_text && (
                  <Text style={[styles.predictionSecondary, { color: colors.textSecondary }]}>
                    {item.structured_formatting.secondary_text}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    position: 'relative',
    zIndex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  required: {
    color: '#d92d20',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  locationButton: {
    padding: 12,
    borderLeftWidth: 1,
  },
  predictionsContainer: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  predictionItemLast: {
    borderBottomWidth: 0,
  },
  predictionIcon: {
    marginRight: 12,
  },
  predictionText: {
    flex: 1,
  },
  predictionMain: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  predictionSecondary: {
    fontSize: 13,
  },
  loadingContainer: {
    padding: 8,
    alignItems: 'center',
  },
});

