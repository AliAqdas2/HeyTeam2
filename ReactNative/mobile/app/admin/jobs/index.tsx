import { Redirect } from 'expo-router';

// Jobs index - redirect to dashboard since jobs are accessed via nested routes
export default function JobsIndex() {
  return <Redirect href="/admin/dashboard" />;
}

