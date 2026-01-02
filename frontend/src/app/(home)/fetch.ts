// These are placeholder functions for server components
// Real data fetching happens in client components using useAuth hook

export async function getOverviewData() {
  // Return default data - will be replaced by client-side fetching
  return {
    views: {
      value: 0,
      growthRate: 0,
    },
    profit: {
      value: 0,
      growthRate: 0,
    },
    products: {
      value: 0,
      growthRate: 0,
    },
    users: {
      value: 0,
      growthRate: 0,
    },
  };
}

interface ChatData {
  profile: string;
  name: string;
  isActive: boolean;
  unreadCount?: number;
  lastMessage: {
    content: string;
    timestamp: string;
  };
}

export async function getChatsData(): Promise<ChatData[]> {
  // Return empty array - this feature isn't used in invoice app
  return [];
}