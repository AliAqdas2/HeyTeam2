import { Redirect } from 'expo-router';

// This is a placeholder route - redirect to auth by default
export default function ExploreScreen() {
  return <Redirect href="/auth" />;
}
