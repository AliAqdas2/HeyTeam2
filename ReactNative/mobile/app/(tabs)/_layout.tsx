import { Redirect } from 'expo-router';

// This is a placeholder route group - redirect to auth by default
export default function TabLayout() {
  return <Redirect href="/auth" />;
}
