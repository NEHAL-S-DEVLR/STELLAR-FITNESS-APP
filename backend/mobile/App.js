// URL polyfill must load before React Navigation's deep-link parser.
// React Native's built-in URL doesn't implement `.protocol`, so React
// Navigation v7 crashes on startup without this.
import 'react-native-url-polyfill/auto';

import React, { useState, useEffect, useCallback } from 'react';
import { registerRootComponent } from 'expo';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme as NavDark, useFocusEffect } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { api, Session } from './src/api';
import { colors } from './src/theme';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import WorkoutScreen from './src/screens/WorkoutScreen';
import FoodScreen from './src/screens/FoodScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import AccountScreen from './src/screens/AccountScreen';
import CheckInScreen from './src/screens/CheckInScreen';
import GymPassScreen from './src/screens/GymPassScreen';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

const navTheme = {
  ...NavDark,
  colors: {
    ...NavDark.colors,
    background: colors.bg,
    card:       colors.bg,
    primary:    colors.primary,
    text:       colors.onSurface,
    border:     colors.outlineVar,
    notification: colors.error,
  },
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await Session.getToken();
      setSignedIn(!!token);
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" />
        {signedIn ? (
          <RootStack.Navigator screenOptions={{ headerShown: false }}>
            <RootStack.Screen name="Tabs">
              {() => <TabShell onLogout={() => setSignedIn(false)} />}
            </RootStack.Screen>
            <RootStack.Screen name="CheckIn" component={CheckInScreen} options={{ presentation: 'fullScreenModal' }} />
            <RootStack.Screen name="GymPass" component={GymPassScreen} options={{ presentation: 'modal', headerShown: true, title: 'Gym Pass' }} />
          </RootStack.Navigator>
        ) : (
          <LoginScreen onSignedIn={() => setSignedIn(true)} />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

function TabShell({ onLogout }) {
  const [user, setUser] = useState(null);
  const [foodDay, setFoodDay] = useState(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [u, food, b] = await Promise.all([
        api('/api/me'),
        api('/api/me/food').catch(() => null),
        Session.getBaseUrl(),
      ]);
      setUser(u);
      setFoodDay(food);
      setBaseUrl(b);
      setError(null);
    } catch (e) {
      setError(e.message);
      if (e.message.includes('Session expired')) onLogout();
    } finally {
      setRefreshing(false);
    }
  }, [onLogout]);

  useEffect(() => { refresh(); }, [refresh]);

  async function checkIn() {
    try {
      await api('/api/me/attendance', { method: 'POST' });
      await refresh();
    } catch (e) { console.warn(e.message); }
  }

  async function markAllRead() {
    try { await api('/api/me/notifications/read-all', { method: 'POST' }); await refresh(); }
    catch {}
  }

  if (!user) {
    return (
      <View style={styles.splash}>
        {error ? (
          <>
            <Ionicons name="cloud-offline" size={40} color={colors.outline} />
            <Text style={styles.errorTitle}>Couldn't reach the server</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Text style={styles.errorHint}>
              Make sure the backend is running (`npm start` in the project root) and your phone is on the same Wi-Fi.
            </Text>
          </>
        ) : (
          <ActivityIndicator color={colors.primary} size="large" />
        )}
      </View>
    );
  }

  const unread = (user.notifications || []).filter(n => !n.read).length;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.outlineVar,
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVar,
      }}
    >
      <Tab.Screen
        name="Home"
        options={{ tabBarIcon: ({ color }) => <Ionicons name="home" size={22} color={color} /> }}
      >
        {({ navigation }) => <HomeTab navigation={navigation} user={user} foodDay={foodDay} checkIn={checkIn} refresh={refresh} refreshing={refreshing} />}
      </Tab.Screen>

      <Tab.Screen
        name="Workout"
        options={{ tabBarIcon: ({ color }) => <Ionicons name="barbell" size={22} color={color} /> }}
      >
        {() => <WorkoutScreen user={user} />}
      </Tab.Screen>

      <Tab.Screen
        name="Food"
        options={{ tabBarIcon: ({ color }) => <Ionicons name="restaurant" size={22} color={color} /> }}
      >
        {() => <FoodScreen day={foodDay} onRefresh={refresh} />}
      </Tab.Screen>

      <Tab.Screen
        name="Alerts"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="notifications" size={22} color={color} />,
          tabBarBadge: unread > 0 ? unread : undefined,
        }}
        listeners={{ tabPress: () => { if (unread > 0) markAllRead(); } }}
      >
        {() => <NotificationsScreen notifications={user.notifications || []} />}
      </Tab.Screen>

      <Tab.Screen
        name="Account"
        options={{ tabBarIcon: ({ color }) => <Ionicons name="person" size={22} color={color} /> }}
      >
        {() => <AccountScreen user={user} onSaved={refresh} onLogout={onLogout} baseUrl={baseUrl} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// Refetches /api/me whenever the Home tab regains focus — this is what
// makes attendance show up immediately after returning from the QR-scan
// screen, without wiring a callback across separate stack screens.
function HomeTab({ navigation, user, foodDay, checkIn, refresh, refreshing }) {
  useFocusEffect(
    useCallback(() => { refresh(); }, [refresh])
  );
  return (
    <HomeScreen user={user} foodToday={foodDay} onCheckIn={checkIn} onRefresh={refresh} refreshing={refreshing} navigation={navigation} />
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1, backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
    padding: 30,
  },
  errorTitle: { color: colors.onSurface, fontSize: 16, fontWeight: '700', marginTop: 14 },
  errorBody:  { color: colors.error, fontSize: 13, marginTop: 8, textAlign: 'center' },
  errorHint:  { color: colors.onSurfaceVar, fontSize: 12, marginTop: 12, textAlign: 'center' },
});

// Register the root component. Required because we set `"main": "App.js"` in
// package.json, which bypasses Expo's default AppEntry that would otherwise
// register it for us. This must happen at module top level.
registerRootComponent(App);
