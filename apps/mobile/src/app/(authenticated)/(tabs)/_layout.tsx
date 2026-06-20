import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { FC } from 'react';

import { Colors } from '@src/constants/theme';

const TabsLayout: FC = () => (
  <Tabs
    initialRouteName="binder"
    screenOptions={{
      headerShown: true,
      tabBarActiveTintColor: Colors.dark.tabIconSelected,
      tabBarInactiveTintColor: Colors.dark.tabIconDefault,
      headerStyle: { backgroundColor: Colors.dark.tabBarBackground },
      tabBarStyle: { backgroundColor: Colors.dark.tabBarBackground }
    }}
  >
    <Tabs.Screen
      name="binder"
      options={{
        headerShown: false,
        tabBarLabel: 'Binder',
        tabBarIcon: ({ color, size }) => <Ionicons name="albums" size={size} color={color} />,
      }}
    />
    <Tabs.Screen
      name="catalogue"
      options={{
        // Spec 018 / contracts/ui.md §1.1 — Catalogue renders its own crimson
        // masthead edge-to-edge; the tab navigator MUST NOT inject a header.
        headerShown: false,
        tabBarLabel: 'Search',
        tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={color} />,
      }}
    />
    <Tabs.Screen
      name="scan"
      options={{
        // Spec 022 — Scan hosts a full-bleed camera viewfinder rendered by its own
        // stack; the tab navigator MUST NOT inject a header on top of it.
        headerShown: false,
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
