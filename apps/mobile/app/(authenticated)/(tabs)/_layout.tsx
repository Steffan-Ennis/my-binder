import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { FC } from 'react';

import { Colors } from '@root/constants/theme';

const TabsLayout: FC = () => (
  <Tabs
    initialRouteName="binder"
    screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: Colors.dark.tabIconSelected,
      tabBarInactiveTintColor: Colors.dark.tabIconDefault,
      tabBarStyle: { backgroundColor: Colors.dark.tabBarBackground },
    }}
  >
    <Tabs.Screen
      name="binder"
      options={{
        tabBarLabel: 'Binder',
        tabBarIcon: ({ color, size }) => <Ionicons name="albums" size={size} color={color} />,
      }}
    />
    <Tabs.Screen
      name="search"
      options={{
        tabBarLabel: 'Search',
        tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={color} />,
      }}
    />
    <Tabs.Screen
      name="scan"
      options={{
        tabBarLabel: 'Scan',
        tabBarIcon: ({ color, size }) => <Ionicons name="scan-outline" size={size} color={color} />,
      }}
    />
    <Tabs.Screen
      name="profile"
      options={{
        tabBarLabel: 'Profile',
        tabBarIcon: ({ color, size }) => (
          <Ionicons name="person-circle-outline" size={size} color={color} />
        ),
      }}
    />
  </Tabs>
);

export default TabsLayout;