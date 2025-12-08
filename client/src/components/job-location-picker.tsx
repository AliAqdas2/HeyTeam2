import React from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { loadGoogleMapsApi } from "@/lib/googleMapsLoader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

type LatLngLiteral = { lat: number; lng: number };

type ExtendedWindow = Window & {
  __GOOGLE_API_KEY__?: string;
};

type JobLocationPickerProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  id?: string;
  placeholder?: string;
  className?: string;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
};

const DEFAULT_CENTER: LatLngLiteral = { lat: 51.509865, lng: -0.118092 }; // London
const DEFAULT_ZOOM = 5;
const FOCUSED_ZOOM = 14;

const getApiKey = () => {
  if (typeof window !== "undefined") {
    const globalKey = (window as ExtendedWindow).__GOOGLE_API_KEY__;
    if (globalKey) {
      return globalKey;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (import.meta as any).env ?? {};
  return env.VITE_GOOGLE_API_KEY ?? env.GOOGLE_API_KEY ?? "";
};

export function JobLocationPicker({
  value,
  onChange,
  onBlur,
  id,
  placeholder = "Search for an address",
  className,
  inputProps,
}: JobLocationPickerProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const mapNodeRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<any | null>(null);
  const mapsApiRef = React.useRef<any>();
  const markerRef = React.useRef<any | null>(null);
  const geocoderRef = React.useRef<any | null>(null);
  const mapClickListenerRef = React.useRef<any | null>(null);
  const locateControlRef = React.useRef<HTMLDivElement | null>(null);
  const zoomControlRef = React.useRef<HTMLDivElement | null>(null);
  const handleLocateUserRef = React.useRef<() => void>();
  const [isReady, setIsReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = React.useState<LatLngLiteral | null>(null);
  const [userLocation, setUserLocation] = React.useState<LatLngLiteral | null>(null);
  const lastResolvedValueRef = React.useRef<string>("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<Array<{ placeId: string; description: string }>>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const searchDebounceRef = React.useRef<number | null>(null);
  const [suggestionRect, setSuggestionRect] = React.useState<DOMRect | null>(null);

  const updateSuggestionRect = React.useCallback(() => {
    if (!inputRef.current) {
      setSuggestionRect(null);
      return;
    }
    const rect = inputRef.current.getBoundingClientRect();
    setSuggestionRect(rect);
  }, []);

  React.useEffect(() => {
    if (!suggestions.length && !isSearching) {
      setSuggestionRect(null);
      return;
    }

    updateSuggestionRect();
    const handle = () => updateSuggestionRect();
    window.addEventListener("scroll", handle, true);
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("scroll", handle, true);
      window.removeEventListener("resize", handle);
    };
  }, [isSearching, suggestions.length, updateSuggestionRect]);

  const updateMarkerPosition = React.useCallback((position: LatLngLiteral | null) => {
    if (!mapsApiRef.current || !mapRef.current) {
      return;
    }

    if (!position) {
      markerRef.current?.setMap(null);
      return;
    }

    if (!markerRef.current) {
      markerRef.current = new mapsApiRef.current.Marker({
        map: mapRef.current,
        position,
      });
    } else {
      markerRef.current.setMap(mapRef.current);
      markerRef.current.setPosition(position);
    }
  }, []);

  const focusMap = React.useCallback((position: LatLngLiteral) => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    map.panTo(position);
    if ((map.getZoom() ?? DEFAULT_ZOOM) < FOCUSED_ZOOM) {
      map.setZoom(FOCUSED_ZOOM);
    }
  }, []);

  const requestUserLocation = React.useCallback(() => {
    return new Promise<LatLngLiteral>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          resolve({ lat: latitude, lng: longitude });
        },
        (error) => {
          reject(error);
        },
        { maximumAge: 60_000, timeout: 5_000, enableHighAccuracy: true },
      );
    });
  }, []);

  const resolveAddressFromLatLng = React.useCallback(
    async (location: LatLngLiteral) => {
      if (!geocoderRef.current) return;
      try {
        const response = await geocoderRef.current.geocode({ location });
        const results = response?.results;
        const formatted = results?.[0]?.formatted_address ?? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
        lastResolvedValueRef.current = formatted;
        onChange(formatted);
        setSuggestions([]);
        setIsSearching(false);
      } catch (err) {
        console.error("Failed to reverse geocode location", err);
        const fallback = `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
        lastResolvedValueRef.current = fallback;
        onChange(fallback);
        setSuggestions([]);
        setIsSearching(false);
      }
    },
    [onChange],
  );

  const initializeMap = React.useCallback(
    (maps: any) => {
      if (!mapNodeRef.current) {
        console.log("[JobLocationPicker] Cannot initialize map: mapNodeRef.current is null");
        return;
      }
      
      if (mapRef.current) {
        console.log("[JobLocationPicker] Map already initialized, skipping");
        return;
      }

      console.log("[JobLocationPicker] Initializing map...");
      const map = new maps.Map(mapNodeRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        zoomControl: true,
      });
      console.log("[JobLocationPicker] Map instance created:", map);

      type MapClickEvent = {
        latLng?: {
          toJSON: () => LatLngLiteral;
        };
      };

      mapClickListenerRef.current = map.addListener("click", (event: MapClickEvent) => {
        const latLng = event.latLng?.toJSON();
        if (!latLng) return;
        setSelectedPosition(latLng);
        updateMarkerPosition(latLng);
        focusMap(latLng);
        void resolveAddressFromLatLng(latLng);
      });

      if (!locateControlRef.current) {
        const controlDiv = document.createElement("div");
        controlDiv.style.padding = "10px";

        const button = document.createElement("button");
        button.type = "button";
        button.style.background = "#fff";
        button.style.border = "1px solid #dadce0";
        button.style.borderRadius = "50%";
        button.style.boxShadow = "0 1px 4px rgba(0,0,0,0.3)";
        button.style.width = "40px";
        button.style.height = "40px";
        button.style.cursor = "pointer";
        button.style.display = "flex";
        button.style.alignItems = "center";
        button.style.justifyContent = "center";
        button.style.padding = "0";

        const icon = document.createElement("span");
        icon.style.border = "2px solid #4285f4";
        icon.style.borderRadius = "50%";
        icon.style.width = "18px";
        icon.style.height = "18px";
        icon.style.display = "block";
        icon.style.position = "relative";

        const innerDot = document.createElement("span");
        innerDot.style.backgroundColor = "#4285f4";
        innerDot.style.borderRadius = "50%";
        innerDot.style.width = "6px";
        innerDot.style.height = "6px";
        innerDot.style.position = "absolute";
        innerDot.style.top = "50%";
        innerDot.style.left = "50%";
        innerDot.style.transform = "translate(-50%, -50%)";

        icon.appendChild(innerDot);
        button.appendChild(icon);

        button.addEventListener("click", (event: MouseEvent) => {
          event.preventDefault();
          handleLocateUserRef.current?.();
        });

        button.title = "Use current location";
        controlDiv.appendChild(button);
        map.controls[maps.ControlPosition.RIGHT_BOTTOM].push(controlDiv);
        locateControlRef.current = controlDiv;
      }

      // Custom zoom controls (+ / -) near the locate control
      if (!zoomControlRef.current) {
        const zoomDiv = document.createElement("div");
        zoomDiv.style.padding = "10px";

        const container = document.createElement("div");
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.background = "#fff";
        container.style.border = "1px solid #dadce0";
        container.style.borderRadius = "8px";
        container.style.boxShadow = "0 1px 4px rgba(0,0,0,0.3)";
        container.style.overflow = "hidden";

        const makeZoomButton = (label: string, delta: number) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = label;
          btn.style.border = "none";
          btn.style.background = "transparent";
          btn.style.width = "32px";
          btn.style.height = "32px";
          btn.style.cursor = "pointer";
          btn.style.fontSize = "18px";
          btn.style.display = "flex";
          btn.style.alignItems = "center";
          btn.style.justifyContent = "center";

          btn.addEventListener("click", (event: MouseEvent) => {
            event.preventDefault();
            const currentZoom = map.getZoom() ?? DEFAULT_ZOOM;
            map.setZoom(currentZoom + delta);
          });

          return btn;
        };

        const zoomIn = makeZoomButton("+", 1);
        const zoomOut = makeZoomButton("−", -1);

        container.appendChild(zoomIn);
        container.appendChild(zoomOut);
        zoomDiv.appendChild(container);

        map.controls[maps.ControlPosition.RIGHT_BOTTOM].push(zoomDiv);
        zoomControlRef.current = zoomDiv;
      }

      mapRef.current = map;
    },
    [focusMap, resolveAddressFromLatLng, updateMarkerPosition],
  );

  const geocodeAddressValue = React.useCallback(
    async (address: string) => {
      if (!geocoderRef.current || !address) return;
      try {
        const geocodeResponse = await geocoderRef.current.geocode({ address });
        const results = geocodeResponse?.results;
        const bestMatch = results?.[0];
        if (!bestMatch) return;

        const location = bestMatch?.geometry?.location?.toJSON?.() as LatLngLiteral | undefined;
        if (!location) return;
        setSelectedPosition(location);
        updateMarkerPosition(location);
        focusMap(location);

        if (bestMatch.formatted_address && bestMatch.formatted_address !== value) {
          lastResolvedValueRef.current = bestMatch.formatted_address;
          onChange(bestMatch.formatted_address);
          setSuggestions([]);
          setIsSearching(false);
        } else {
          lastResolvedValueRef.current = address;
        }
      } catch (err) {
        console.error("Failed to geocode address", err);
      }
    },
    [focusMap, onChange, updateMarkerPosition, value],
  );

  React.useEffect(() => {
    const apiKey = getApiKey();

    if (!apiKey) {
      setError("GOOGLE_API_KEY is not configured. Please add it to your environment.");
      return;
    }

    let cancelled = false;

    loadGoogleMapsApi({ apiKey, libraries: ["places"] })
      .then((maps) => {
        if (cancelled) return;
        mapsApiRef.current = maps;
        geocoderRef.current = new maps.Geocoder();

        setIsReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load Google Maps API", err);
        setError(err instanceof Error ? err.message : "Failed to load Google Maps API");
      });

    return () => {
      cancelled = true;
      mapClickListenerRef.current?.remove();
      markerRef.current?.setMap(null);
      if (locateControlRef.current && mapRef.current && mapsApiRef.current) {
        const controls = mapRef.current.controls[mapsApiRef.current.ControlPosition.RIGHT_BOTTOM];
        const index = controls.getArray().indexOf(locateControlRef.current);
        if (index > -1) {
          controls.removeAt(index);
        }
        locateControlRef.current.remove();
        locateControlRef.current = null;
      }
      mapRef.current = null;
      geocoderRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (!mapsApiRef.current || !isDialogOpen) {
      console.log("[JobLocationPicker] Dialog effect skipped:", { 
        hasMapsApi: !!mapsApiRef.current, 
        isDialogOpen 
      });
      return;
    }
    
    console.log("[JobLocationPicker] Dialog opened, scheduling map initialization...");
    // Wait for the dialog to render the map container in the DOM
    const timer = window.setTimeout(() => {
      console.log("[JobLocationPicker] Timer fired, checking refs:", {
        hasMapNode: !!mapNodeRef.current,
        hasMapRef: !!mapRef.current,
      });

      // If we don't yet have a selected position but have a typed value, try to geocode it
      if (!selectedPosition && value) {
        void geocodeAddressValue(value);
      }

      if (mapNodeRef.current && !mapRef.current) {
        initializeMap(mapsApiRef.current);
      }
    }, 100);
    
    return () => window.clearTimeout(timer);
  }, [geocodeAddressValue, initializeMap, isDialogOpen, selectedPosition, value]);

  React.useEffect(() => {
    if (!isDialogOpen) return;
    const target = selectedPosition ?? userLocation ?? DEFAULT_CENTER;
    focusMap(target);
  }, [focusMap, isDialogOpen, selectedPosition, userLocation]);

  // When the dialog closes, tear down the existing map instance so it can be
  // cleanly re‑created the next time the user opens "Choose on map".
  React.useEffect(() => {
    if (isDialogOpen) {
      return;
    }

    if (!mapRef.current || !mapsApiRef.current) {
      return;
    }

    try {
      mapClickListenerRef.current?.remove();
      mapClickListenerRef.current = null;

      markerRef.current?.setMap(null);
      markerRef.current = null;

      if (locateControlRef.current) {
        const controls = mapRef.current.controls[mapsApiRef.current.ControlPosition.RIGHT_BOTTOM];
        const index = controls.getArray().indexOf(locateControlRef.current);
        if (index > -1) {
          controls.removeAt(index);
        }
        locateControlRef.current.remove();
        locateControlRef.current = null;
      }

      if (zoomControlRef.current) {
        const controls = mapRef.current.controls[mapsApiRef.current.ControlPosition.RIGHT_BOTTOM];
        const index = controls.getArray().indexOf(zoomControlRef.current);
        if (index > -1) {
          controls.removeAt(index);
        }
        zoomControlRef.current.remove();
        zoomControlRef.current = null;
      }
    } catch (err) {
      console.warn("[JobLocationPicker] Error cleaning up map on dialog close:", err);
    } finally {
      mapRef.current = null;
    }
  }, [isDialogOpen]);

  React.useEffect(() => {
    if (!isDialogOpen || !mapsApiRef.current || !mapRef.current) return;
    const maps = mapsApiRef.current;
    const map = mapRef.current;
    const handle = window.setTimeout(() => {
      maps.event?.trigger?.(map, "resize");
      const target = selectedPosition ?? userLocation ?? DEFAULT_CENTER;
      map.setCenter?.(target);
      if (selectedPosition || userLocation) {
        if ((map.getZoom?.() ?? DEFAULT_ZOOM) < FOCUSED_ZOOM) {
          map.setZoom?.(FOCUSED_ZOOM);
        }
      } else {
        map.setZoom?.(DEFAULT_ZOOM);
      }
    }, 75);

    return () => window.clearTimeout(handle);
  }, [focusMap, isDialogOpen, selectedPosition, userLocation]);

  React.useEffect(() => {
    if (!value) {
      setSelectedPosition(null);
      updateMarkerPosition(null);
      lastResolvedValueRef.current = "";
      mapRef.current?.setCenter?.(DEFAULT_CENTER);
      mapRef.current?.setZoom?.(DEFAULT_ZOOM);
      return;
    }

    if (value === lastResolvedValueRef.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void geocodeAddressValue(value);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [geocodeAddressValue, updateMarkerPosition, value]);

  React.useEffect(() => {
    if (!isReady || userLocation) return;

    requestUserLocation()
      .then((coords) => {
        setUserLocation(coords);
        // Don't auto-fill the address, just set the location for map centering
        if (!selectedPosition && !value) {
          setSelectedPosition(coords);
          updateMarkerPosition(coords);
          focusMap(coords);
        }
      })
      .catch(() => {
        // Ignore if user denies permission.
      });
  }, [focusMap, isReady, requestUserLocation, selectedPosition, updateMarkerPosition, userLocation, value]);

  const handleLocateUser = React.useCallback(() => {
    requestUserLocation()
      .then((coords) => {
        setUserLocation(coords);
        setSelectedPosition(coords);
        updateMarkerPosition(coords);
        focusMap(coords);
        void resolveAddressFromLatLng(coords);
        setSuggestions([]);
        setIsSearching(false);
      })
      .catch((err) => {
        console.error("Unable to retrieve current location", err);
      });
  }, [focusMap, requestUserLocation, resolveAddressFromLatLng, updateMarkerPosition]);

  React.useEffect(() => {
    handleLocateUserRef.current = handleLocateUser;
  }, [handleLocateUser]);

  React.useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  const { className: inputClassName, onBlur: inputOnBlur, onChange: inputOnChange, ...restInputProps } = inputProps ?? {};

  if (error) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            ref={inputRef}
            id={id}
            value={value}
            placeholder={placeholder}
            onChange={(event) => {
              lastResolvedValueRef.current = "";
              onChange(event.target.value);
              inputOnChange?.(event);
            }}
            onBlur={(event) => {
              onBlur?.();
              inputOnBlur?.(event);
            }}
            className={cn("sm:flex-1", inputClassName)}
            {...restInputProps}
          />
          <Button type="button" variant="outline" disabled>
            Choose on map
          </Button>
        </div>
        <p className="text-sm text-destructive">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative sm:flex-1">
          <Input
            ref={inputRef}
            id={id}
            value={value}
            placeholder={placeholder}
            onChange={(event) => {
              const text = event.target.value;
              lastResolvedValueRef.current = "";
              onChange(text);
              inputOnChange?.(event);

              if (searchDebounceRef.current) {
                window.clearTimeout(searchDebounceRef.current);
              }

              if (!text) {
                setSuggestions([]);
                setIsSearching(false);
                return;
              }

              if (!mapsApiRef.current?.places?.AutocompleteSuggestion) {
                setSuggestionRect(null);
                return;
              }

              setIsSearching(true);
              updateSuggestionRect();
              searchDebounceRef.current = window.setTimeout(async () => {
                try {
                  // Use the new AutocompleteSuggestion API
                  const { suggestions: results } = await mapsApiRef.current.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
                    input: text,
                    includedPrimaryTypes: ["geocode", "street_address", "route", "locality"],
                  });

                  const formattedSuggestions = results.map((suggestion: any) => ({
                    placeId: suggestion.placePrediction?.placeId ?? "",
                    description: suggestion.placePrediction?.text?.toString() ?? text,
                  }));

                  setSuggestions(formattedSuggestions);
                  updateSuggestionRect();
                  setIsSearching(false);
                } catch (err) {
                  console.error("Autocomplete error:", err);
                  setSuggestions([]);
                  setIsSearching(false);
                }
              }, 250);
            }}
            onBlur={(event) => {
              onBlur?.();
              inputOnBlur?.(event);
              const text = event.target.value.trim();
              window.setTimeout(() => {
                setSuggestions([]);
                setIsSearching(false);
                setSuggestionRect(null);
              }, 150);
              if (text) {
                void geocodeAddressValue(text);
              }
            }}
            onFocus={() => {
              if ((suggestions.length > 0 || isSearching) && !suggestionRect) {
                updateSuggestionRect();
              }
            }}
            className={cn("sm:flex-1", inputClassName)}
            {...restInputProps}
          />

          {(!!suggestions.length || isSearching) &&
            suggestionRect &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                className="z-[9999] overflow-hidden rounded-md border bg-background shadow-md"
                style={{
                  position: "fixed",
                  top: suggestionRect.bottom + 4,
                  left: suggestionRect.left,
                  width: suggestionRect.width,
                }}
              >
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.placeId || suggestion.description}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    onMouseDown={(event: React.MouseEvent<HTMLButtonElement>) => {
                      event.preventDefault();
                    }}
                    onClick={async () => {
                      setSuggestions([]);
                      lastResolvedValueRef.current = suggestion.description;
                      onChange(suggestion.description);
                      
                      if (!mapsApiRef.current?.places?.Place || !suggestion.placeId) {
                        setSuggestionRect(null);
                        return;
                      }

                      try {
                        // Use the new Place API to fetch place details
                        const place = new mapsApiRef.current.places.Place({
                          id: suggestion.placeId,
                        });

                        await place.fetchFields({
                          fields: ["displayName", "formattedAddress", "location"],
                        });

                        const location = place.location?.toJSON?.();
                        if (location) {
                          setSelectedPosition(location);
                          updateMarkerPosition(location);
                          focusMap(location);
                        }

                        const formattedAddr = place.formattedAddress ?? suggestion.description;
                        lastResolvedValueRef.current = formattedAddr;
                        onChange(formattedAddr);
                        setSuggestions([]);
                        setIsSearching(false);
                        updateSuggestionRect();
                      } catch (err) {
                        console.error("Error fetching place details:", err);
                        setSuggestions([]);
                        setIsSearching(false);
                      }
                    }}
                  >
                    {suggestion.description}
                  </button>
                ))}
                {isSearching && (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Searching...
                  </div>
                )}
              </div>,
              document.body,
            )}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSuggestions([]);
            setIsSearching(false);
            setIsDialogOpen(true);
          }}
        >
          Choose on map
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Start typing to search the address or choose a spot directly on the map.
      </p>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen} modal={false}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Select location on map</DialogTitle>
            <DialogDescription>
              Search for a place or click anywhere on the map to set the job location. We’ll fill the address into the field automatically.
            </DialogDescription>
          </DialogHeader>

          <div
            ref={mapNodeRef}
            className={cn(
              "h-[420px] w-full overflow-hidden rounded-md border border-input bg-muted",
              !isReady && "animate-pulse",
            )}
          />

          <DialogFooter className="gap-2">
            <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => setIsDialogOpen(false)}
              disabled={!selectedPosition && !value}
            >
              Use this location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

