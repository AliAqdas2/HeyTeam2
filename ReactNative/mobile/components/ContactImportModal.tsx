import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Contacts from 'expo-contacts';
import { apiFetch } from '@/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toast, useToast } from './Toast';

type UserMe = {
  type: 'user';
  countryCode?: string;
};

type DeviceContact = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phoneNumbers: string[];
  emails: string[];
};

type ParsedContact = {
  firstName: string;
  lastName: string;
  phone: string;
  countryCode: string;
  email?: string;
};

type ImportResults = {
  imported: number;
  skipped: number;
  errors: string[];
};

type ContactError = {
  contactName: string;
  phone: string;
  reason: string;
};

type ContactImportModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

// Country dial codes mapping (reverse lookup: dialCode -> countryCode)
const DIAL_CODE_TO_COUNTRY: Record<string, string> = {
  '+1': 'US',
  '+44': 'GB',
  '+61': 'AU',
  '+64': 'NZ',
  '+353': 'IE',
  '+91': 'IN',
  '+65': 'SG',
  '+52': 'MX',
  '+49': 'DE',
  '+33': 'FR',
  '+34': 'ES',
  '+39': 'IT',
};

// Common country codes for detection
const COMMON_COUNTRY_CODES = ['1', '33', '34', '39', '44', '49', '52', '61', '64', '65', '91', '353'];

/**
 * Parses a phone number and extracts countryCode and phone separately
 * @param phoneNumber - The phone number to parse (may include country code)
 * @param defaultCountryCode - The default country code to use if not found in phone number
 * @returns Object with countryCode and phone (separate fields)
 */
function parsePhoneNumber(phoneNumber: string, defaultCountryCode: string): { countryCode: string; phone: string } {
  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');

  // Handle international format without + (00...)
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }

  // If it starts with +, try to extract country code
  if (cleaned.startsWith('+')) {
    // Try to match known country codes (longest first)
    const sortedCodes = COMMON_COUNTRY_CODES.sort((a, b) => b.length - a.length);
    
    for (const code of sortedCodes) {
      const dialCode = '+' + code;
      if (cleaned.startsWith(dialCode)) {
        // Found country code
        const countryCode = DIAL_CODE_TO_COUNTRY[dialCode] || defaultCountryCode;
        let phone = cleaned.substring(dialCode.length);
        
        // Remove trunk prefix (leading 0) for most countries except Italy
        if (phone.startsWith('0') && countryCode !== 'IT') {
          phone = phone.substring(1);
        }
        
        return { countryCode, phone };
      }
    }
    
    // If we have a + but couldn't match, might be a different country
    // Try to extract first 1-3 digits as country code
    const match = cleaned.match(/^\+(\d{1,3})(.+)$/);
    if (match) {
      const dialCode = '+' + match[1];
      const countryCode = DIAL_CODE_TO_COUNTRY[dialCode] || defaultCountryCode;
      let phone = match[2];
      
      // Remove trunk prefix if present
      if (phone.startsWith('0') && countryCode !== 'IT') {
        phone = phone.substring(1);
      }
      
      return { countryCode, phone };
    }
  }

  // No country code found, use default
  // Remove leading 0 for most countries except Italy
  let phone = cleaned.replace(/\D/g, '');
  if (phone.startsWith('0') && defaultCountryCode !== 'IT') {
    phone = phone.substring(1);
  }

  return { countryCode: defaultCountryCode, phone };
}

export default function ContactImportModal({ visible, onClose, onSuccess }: ContactImportModalProps) {
  const [userCountryCode, setUserCountryCode] = useState<string>('GB');
  const [loading, setLoading] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [deviceContacts, setDeviceContacts] = useState<DeviceContact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResults | null>(null);
  const [contactErrors, setContactErrors] = useState<ContactError[]>([]);
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const toast = useToast();

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setDeviceContacts([]);
      setSelectedContactIds(new Set());
      setSearchQuery('');
      setResults(null);
      setContactErrors([]);
      toast.hide();
    }
  }, [visible]);

  // Fetch user's country code on mount
  useEffect(() => {
    if (visible) {
      fetchUserCountryCode();
    }
  }, [visible]);

  // On iOS, open native picker immediately when modal opens
  // On Android, load all contacts into custom picker
  useEffect(() => {
    if (visible && userCountryCode) {
      if (Platform.OS === 'ios') {
        openNativeContactPicker();
      } else {
        loadContacts();
      }
    }
  }, [visible, userCountryCode]);

  // iOS: Open native contact picker
  const openNativeContactPicker = async () => {
    try {
      setLoadingContacts(true);
      toast.hide();

      // Request permission first
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Please grant contacts permission to import contacts from your phone.');
        setLoadingContacts(false);
        return;
      }

      // Open native iOS contact picker
      const contact = await Contacts.presentContactPickerAsync();
      
      if (contact) {
        // User selected a contact - use firstName/lastName if available
        const deviceContact: DeviceContact = {
          id: contact.id || String(Date.now()),
          name: contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown',
          firstName: contact.firstName || undefined,
          lastName: contact.lastName || undefined,
          phoneNumbers: contact.phoneNumbers?.map((p) => p.number || '').filter(Boolean) || [],
          emails: contact.emails?.map((e) => e.email || '').filter(Boolean) || [],
        };

        if (deviceContact.phoneNumbers.length === 0) {
          toast.error('Selected contact does not have a phone number.');
          setLoadingContacts(false);
          return;
        }

        // Import the selected contact directly
        await importSelectedContacts([deviceContact]);
      } else {
        // User cancelled the picker - close modal
        onClose();
      }
    } catch (e: any) {
      // Check if user just cancelled
      if (e?.code === 'ERR_CANCELED' || e?.message?.includes('cancel')) {
        onClose();
        return;
      }
      toast.error(e?.message || 'Failed to open contact picker');
    } finally {
      setLoadingContacts(false);
    }
  };

  const fetchUserCountryCode = async () => {
    try {
      const me = await apiFetch<UserMe>('/api/mobile/auth/me');
      if (me?.countryCode) {
        setUserCountryCode(me.countryCode);
      }
    } catch (e) {
      console.error('Failed to fetch user country code:', e);
      // Default to GB if fetch fails
      setUserCountryCode('GB');
    }
  };

  const loadContacts = async () => {
    try {
      setLoadingContacts(true);
      toast.hide();
      
      // Request permission
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Please grant contacts permission to import contacts from your phone.');
        return;
      }

      // Fetch all contacts - handle pagination to get all contacts
      let allContacts: Contacts.Contact[] = [];
      let hasNextPage = true;
      let pageOffset = 0;
      const pageSize = 1000; // Fetch in batches

      while (hasNextPage) {
        const result = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
          pageSize,
          pageOffset,
        });

        if (!result.data || result.data.length === 0) {
          break;
        }

        allContacts = [...allContacts, ...result.data];
        
        // Check if there are more contacts
        hasNextPage = result.data.length === pageSize;
        pageOffset += pageSize;
        
        // Safety check to prevent infinite loop
        if (pageOffset > 100000) {
          console.warn('Contact pagination limit reached');
          break;
        }
      }

      // Transform contacts - include firstName/lastName for proper parsing
      const transformed: DeviceContact[] = allContacts
        .filter((contact) => contact.phoneNumbers && contact.phoneNumbers.length > 0)
        .map((contact) => ({
          id: contact.id,
          name: contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown',
          firstName: contact.firstName || undefined,
          lastName: contact.lastName || undefined,
          phoneNumbers: contact.phoneNumbers?.map((p) => p.number).filter(Boolean) as string[] || [],
          emails: contact.emails?.map((e) => e.email).filter(Boolean) as string[] || [],
        }));

      setDeviceContacts(transformed);
      setSelectedContactIds(new Set());
      setResults(null);
      setContactErrors([]);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load contacts');
    } finally {
      setLoadingContacts(false);
    }
  };

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return deviceContacts;
    const query = searchQuery.toLowerCase();
    return deviceContacts.filter(
      (contact) =>
        contact.name.toLowerCase().includes(query) ||
        contact.phoneNumbers.some((p) => p.includes(query)) ||
        contact.emails.some((e) => e.toLowerCase().includes(query))
    );
  }, [deviceContacts, searchQuery]);

  const toggleContact = (contactId: string) => {
    const newSelected = new Set(selectedContactIds);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContactIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedContactIds.size === filteredContacts.length) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(filteredContacts.map((c) => c.id)));
    }
  };

  const importSelectedContacts = async (contactsToImport: DeviceContact[]) => {
    try {
      setImporting(true);
      setResults(null);
      setContactErrors([]);
      toast.hide();

      // Parse contacts and create a map for error tracking
      const parsedContacts: ParsedContact[] = [];
      const contactMap = new Map<string, { name: string; phone: string }[]>();

      for (const contact of contactsToImport) {
        // Use firstName/lastName if available, otherwise parse from name
        let firstName: string;
        let lastName: string;
        
        if (contact.firstName || contact.lastName) {
          firstName = contact.firstName || 'Unknown';
          lastName = contact.lastName || '';
        } else {
          const nameParts = contact.name.split(' ');
          firstName = nameParts[0] || 'Unknown';
          lastName = nameParts.slice(1).join(' ') || '';
        }
        
        const email = contact.emails.length > 0 ? contact.emails[0] : undefined;

        // Create a contact entry for each phone number
        for (let i = 0; i < contact.phoneNumbers.length; i++) {
          const phoneNumber = contact.phoneNumbers[i];
          const { countryCode, phone } = parsePhoneNumber(phoneNumber, userCountryCode);

          // Skip if phone is empty after parsing
          if (!phone || phone.length < 7) {
            continue;
          }

          const contactEntry = {
            firstName,
            lastName: contact.phoneNumbers.length > 1 ? `${lastName} (${i + 1})` : lastName,
            phone,
            countryCode,
            email,
          };

          parsedContacts.push(contactEntry);

          // Track contact for error mapping
          if (!contactMap.has(contact.name)) {
            contactMap.set(contact.name, []);
          }
          contactMap.get(contact.name)!.push({ name: contact.name, phone });
        }
      }

      if (parsedContacts.length === 0) {
        toast.error('No valid phone numbers found in selected contacts');
        setImporting(false);
        return;
      }

      // Send to API
      const importResults = await apiFetch<ImportResults>('/api/contacts/bulk', {
        method: 'POST',
        body: { contacts: parsedContacts },
      });

      setResults(importResults);

      // Parse errors to map them to specific contacts
      const errors: ContactError[] = [];
      for (const error of importResults.errors) {
        // Error format: "Contact 1: Phone +441234567890 already exists"
        // or "Contact 1: Invalid phone number"
        const match = error.match(/Contact (\d+): (.+)/);
        if (match) {
          const contactIndex = parseInt(match[1], 10) - 1;
          const reason = match[2];
          
          if (contactIndex >= 0 && contactIndex < parsedContacts.length) {
            const contact = parsedContacts[contactIndex];
            errors.push({
              contactName: `${contact.firstName} ${contact.lastName}`,
              phone: contact.phone,
              reason: reason.includes('already exists') 
                ? 'This contact already exists' 
                : reason.includes('duplicate')
                ? 'Duplicate contact'
                : reason,
            });
          }
        } else {
          // Fallback for errors without contact index
          errors.push({
            contactName: 'Unknown',
            phone: '',
            reason: error,
          });
        }
      }

      setContactErrors(errors);

      if (importResults.imported > 0) {
        const message = `Successfully imported ${importResults.imported} contact${importResults.imported > 1 ? 's' : ''}${
          importResults.skipped > 0 ? `. ${importResults.skipped} skipped.` : ''
        }`;
        toast.success(message, 4000);
        
        // Auto-close after 3 seconds if all contacts imported successfully
        if (importResults.skipped === 0 && errors.length === 0) {
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 3000);
        }
      } else {
        // Show error message with details if contacts were skipped
        if (importResults.skipped > 0) {
          toast.warning(`No contacts imported. ${importResults.skipped} skipped.`, 5000);
        } else {
          toast.error('No contacts imported.');
        }
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to import contacts');
    } finally {
      setImporting(false);
      setLoadingContacts(false);
    }
  };

  const handleImport = async () => {
    if (selectedContactIds.size === 0) {
      toast.error('Please select at least one contact to import');
      return;
    }

    // Get selected contacts and import them
    const selectedContacts = deviceContacts.filter((c) => selectedContactIds.has(c.id));
    await importSelectedContacts(selectedContacts);
  };

  const selectedCount = selectedContactIds.size;
  const totalCount = filteredContacts.length;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { paddingTop: insets.top }]}>
        <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20), maxHeight: screenHeight * 0.95 }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Import from Phone</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#101828" />
            </TouchableOpacity>
          </View>

          {/* iOS: Show loading or pick another button */}
          {Platform.OS === 'ios' ? (
            <>
              {loadingContacts ? (
                <View style={styles.loaderContainer}>
                  <ActivityIndicator size="large" color="hsl(178, 60%, 50%)" />
                  <Text style={styles.loaderText}>Opening contact picker...</Text>
                </View>
              ) : (
                <View style={styles.iosPickerContainer}>
                  {!results && (
                    <Text style={styles.iosPickerText}>
                      The contact picker should open automatically. If it doesn't, tap the button below.
                    </Text>
                  )}
                  <TouchableOpacity
                    style={styles.pickAnotherButton}
                    onPress={openNativeContactPicker}
                    disabled={importing || loadingContacts}
                  >
                    {importing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="person-add-outline" size={20} color="#fff" />
                        <Text style={styles.pickAnotherText}>
                          {results ? 'Pick Another Contact' : 'Open Contact Picker'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <>
              {/* Android: Show search and contact list */}
              <View style={styles.searchContainer}>
                <Ionicons name="search-outline" size={18} color="#6b7280" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#98a2b3"
                />
              </View>

              <View style={styles.selectionInfo}>
                <TouchableOpacity onPress={toggleAll} style={styles.selectAllButton}>
                  <Text style={styles.selectAllText}>
                    {selectedCount === totalCount ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.countText}>
                  {selectedCount} of {totalCount} selected
                </Text>
              </View>

              {loadingContacts ? (
                <View style={styles.loaderContainer}>
                  <ActivityIndicator size="large" color="hsl(178, 60%, 50%)" />
                  <Text style={styles.loaderText}>Loading contacts...</Text>
                </View>
              ) : filteredContacts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={48} color="#6b7280" />
                  <Text style={styles.emptyText}>
                    {searchQuery ? 'No contacts match your search' : 'No contacts found'}
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.contactsList} showsVerticalScrollIndicator={false}>
                  {filteredContacts.map((contact) => {
                    const isSelected = selectedContactIds.has(contact.id);
                    return (
                      <TouchableOpacity
                        key={contact.id}
                        style={[styles.contactItem, isSelected && styles.contactItemSelected]}
                        onPress={() => toggleContact(contact.id)}
                      >
                        <View style={styles.contactCheckbox}>
                          <Ionicons
                            name={isSelected ? 'checkbox' : 'square-outline'}
                            size={24}
                            color={isSelected ? 'hsl(178, 60%, 50%)' : '#d0d5dd'}
                          />
                        </View>
                        <View style={styles.contactInfo}>
                          <Text style={styles.contactName}>{contact.name}</Text>
                          {contact.phoneNumbers.length > 0 && (
                            <View style={styles.contactMeta}>
                              <Ionicons name="call-outline" size={14} color="#6b7280" />
                              <Text style={styles.contactMetaText}>
                                {contact.phoneNumbers.length === 1
                                  ? contact.phoneNumbers[0]
                                  : `${contact.phoneNumbers.length} numbers`}
                              </Text>
                            </View>
                          )}
                          {contact.emails.length > 0 && (
                            <View style={styles.contactMeta}>
                              <Ionicons name="mail-outline" size={14} color="#6b7280" />
                              <Text style={styles.contactMetaText}>{contact.emails[0]}</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </>
          )}

          {/* Results with Contact Errors */}
          {results && contactErrors.length > 0 && (
            <View style={styles.resultsContainer}>
              <View style={styles.resultsHeader}>
                <Ionicons name="information-circle" size={20} color="#d92d20" />
                <Text style={styles.resultsTitle}>Contacts Not Imported</Text>
              </View>
              <ScrollView style={styles.errorsContainer} nestedScrollEnabled>
                {contactErrors.map((error, index) => (
                  <View key={index} style={styles.contactErrorItem}>
                    <View style={styles.contactErrorHeader}>
                      <Text style={styles.contactErrorName}>{error.contactName}</Text>
                    </View>
                    {error.phone && (
                      <Text style={styles.contactErrorPhone}>{error.phone}</Text>
                    )}
                    <Text style={styles.contactErrorReason}>{error.reason}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            {Platform.OS === 'ios' ? (
              // iOS: Just show Done/Close button
              <TouchableOpacity
                style={[styles.button, styles.doneButton]}
                onPress={() => {
                  if (results && results.imported > 0) {
                    onSuccess();
                  }
                  onClose();
                }}
                disabled={importing || loadingContacts}
              >
                <Text style={styles.doneButtonText}>
                  {results && results.imported > 0 ? 'Done' : 'Close'}
                </Text>
              </TouchableOpacity>
            ) : (
              // Android: Cancel and Import buttons
              <>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={onClose}
                  disabled={importing}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.importButton, selectedCount === 0 && styles.importButtonDisabled]}
                  onPress={handleImport}
                  disabled={importing || selectedCount === 0}
                >
                  {importing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.importButtonText}>Import ({selectedCount})</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
        
        {/* Toast notification */}
        <Toast visible={toast.visible} config={toast.config} onHide={toast.hide} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#101828',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: '#0f1729',
    fontSize: 15,
  },
  selectionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectAllButton: {
    paddingVertical: 4,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'hsl(178, 60%, 50%)',
  },
  countText: {
    fontSize: 14,
    color: '#6b7280',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  contactsList: {
    marginBottom: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#f5f7fb',
  },
  contactItemSelected: {
    backgroundColor: 'rgba(13, 178, 181, 0.1)',
    borderWidth: 1,
    borderColor: 'hsl(178, 60%, 50%)',
  },
  contactCheckbox: {
    marginRight: 12,
    marginTop: 2,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 4,
  },
  contactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  contactMetaText: {
    fontSize: 14,
    color: '#6b7280',
  },
  resultsContainer: {
    backgroundColor: '#fef3f2',
    borderWidth: 1,
    borderColor: '#fecdca',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    maxHeight: 200,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  resultsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#b42318',
  },
  errorsContainer: {
    maxHeight: 150,
  },
  contactErrorItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#d92d20',
  },
  contactErrorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactErrorName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#101828',
  },
  contactErrorPhone: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  contactErrorReason: {
    fontSize: 12,
    color: '#d92d20',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e4e7ec',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f7fb',
  },
  cancelButtonText: {
    color: '#101828',
    fontWeight: '700',
    fontSize: 16,
  },
  importButton: {
    backgroundColor: 'hsl(178, 60%, 50%)',
  },
  importButtonDisabled: {
    backgroundColor: '#d0d5dd',
  },
  importButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  iosPickerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  iosPickerText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  pickAnotherButton: {
    backgroundColor: 'hsl(178, 60%, 50%)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    minWidth: 200,
  },
  pickAnotherText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  doneButton: {
    backgroundColor: 'hsl(178, 60%, 50%)',
  },
  doneButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});

