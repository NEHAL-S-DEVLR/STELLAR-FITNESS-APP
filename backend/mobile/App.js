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
import SimpleAccountScreen from './src/screens/SimpleAccountScreen';
import CheckInScreen from './src/screens/CheckInScreen';
import GymPassScreen from './src/screens/GymPassScreen';
import TrainerClientsScreen from './src/screens/TrainerClientsScreen';
import TrainerClientDetailScreen from './src/screens/TrainerClientDetailScreen';
import TrainerEarningsScreen from './src/screens/TrainerEarningsScreen';
import AdminMembersScreen from './src/screens/AdminMembersScreen';
import AdminAddMemberScreen from './src/screens/AdminAddMemberScreen';
import AdminMemberDetailScreen from './src/screens/AdminMemberDetailScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import AdminBatchesScreen from './src/screens/AdminBatchesScreen';
import AdminEnquiriesScreen from './src/screens/AdminEnquiriesScreen';
import AdminExpensesScreen from './src/screens/AdminExpensesScreen';
import AdminCheckinQrScreen from './src/screens/AdminCheckinQrScreen';
import AdminFinanceScreen from './src/screens/AdminFinanceScreen';
import AdminTrainersScreen from './src/screens/AdminTrainersScreen';
import AdminTrainerDetailScreen from './src/screens/AdminTrainerDetailScreen';
import AdminAddTrainerScreen from './src/screens/AdminAddTrainerScreen';
import AdminNewAssignmentScreen from './src/screens/AdminNewAssignmentScreen';
import AdminStaffScreen from './src/screens/AdminStaffScreen';
import AdminAddStaffScreen from './src/screens/AdminAddStaffScreen';
import AdminAdmissionsScreen from './src/screens/AdminAdmissionsScreen';
import AdminReportsScreen from './src/screens/AdminReportsScreen';
import TrainerWorkingHoursScreen from './src/screens/TrainerWorkingHoursScreen';
import MemberProgressScreen from './src/screens/MemberProgressScreen';
import MemberPaymentsScreen from './src/screens/MemberPaymentsScreen';
import AdminPlansScreen from './src/screens/AdminPlansScreen';
import AdminGalleryScreen from './src/screens/AdminGalleryScreen';
import AdminDefaultWorkoutScreen from './src/screens/AdminDefaultWorkoutScreen';
import ReelRequestsScreen from './src/screens/ReelRequestsScreen';

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
              {() => <AppShell onLogout={() => setSignedIn(false)} />}
            </RootStack.Screen>
            <RootStack.Screen name="CheckIn" component={CheckInScreen} options={{ presentation: 'fullScreenModal' }} />
            <RootStack.Screen name="GymPass" component={GymPassScreen} options={{ presentation: 'modal', headerShown: true, title: 'Gym Pass' }} />
            <RootStack.Screen name="AdminAddMember" component={AdminAddMemberScreen} options={{ presentation: 'modal', headerShown: true, title: 'Add Member' }} />
            <RootStack.Screen name="TrainerClientDetail" component={TrainerClientDetailScreen} options={{ headerShown: true, title: '' }} />
            <RootStack.Screen name="AdminMemberDetail" component={AdminMemberDetailScreen} options={{ headerShown: true, title: '' }} />
            <RootStack.Screen name="AdminBatches" component={AdminBatchesScreen} options={{ headerShown: true, title: 'Batches' }} />
            <RootStack.Screen name="AdminEnquiries" component={AdminEnquiriesScreen} options={{ headerShown: true, title: 'Enquiries' }} />
            <RootStack.Screen name="AdminExpenses" component={AdminExpensesScreen} options={{ headerShown: true, title: 'Expenses' }} />
            <RootStack.Screen name="AdminCheckinQr" component={AdminCheckinQrScreen} options={{ headerShown: true, title: 'Check-in QR' }} />
            <RootStack.Screen name="AdminFinance" component={AdminFinanceScreen} options={{ headerShown: true, title: 'Finance' }} />
            <RootStack.Screen name="AdminTrainers" component={AdminTrainersScreen} options={{ headerShown: true, title: 'Trainers & PT' }} />
            <RootStack.Screen name="AdminAddTrainer" component={AdminAddTrainerScreen} options={{ presentation: 'modal', headerShown: true, title: 'Add Trainer' }} />
            <RootStack.Screen name="AdminNewAssignment" component={AdminNewAssignmentScreen} options={{ presentation: 'modal', headerShown: true, title: 'New PT Assignment' }} />
            <RootStack.Screen name="AdminStaff" component={AdminStaffScreen} options={{ headerShown: true, title: 'Staff' }} />
            <RootStack.Screen name="AdminAddStaff" component={AdminAddStaffScreen} options={{ presentation: 'modal', headerShown: true, title: 'Add Staff' }} />
            <RootStack.Screen name="AdminAdmissions" component={AdminAdmissionsScreen} options={{ headerShown: true, title: 'Admissions' }} />
            <RootStack.Screen name="AdminReports" component={AdminReportsScreen} options={{ headerShown: true, title: 'Reports' }} />
            <RootStack.Screen name="MemberProgress" component={MemberProgressScreen} options={{ headerShown: true, title: 'Progress' }} />
            <RootStack.Screen name="MemberPayments" component={MemberPaymentsScreen} options={{ headerShown: true, title: 'Payment History' }} />
            <RootStack.Screen name="ReelRequests" component={ReelRequestsScreen} options={{ headerShown: true, title: 'Reel Shoot Request' }} />
            <RootStack.Screen name="AdminPlans" component={AdminPlansScreen} options={{ headerShown: true, title: 'Plans' }} />
            <RootStack.Screen name="AdminGallery" component={AdminGalleryScreen} options={{ headerShown: true, title: 'Gallery' }} />
            <RootStack.Screen name="AdminTrainerDetail" component={AdminTrainerDetailScreen} options={{ headerShown: true, title: '' }} />
            <RootStack.Screen name="AdminDefaultWorkout" component={AdminDefaultWorkoutScreen} options={{ headerShown: true, title: 'Default Workout Plan' }} />
          </RootStack.Navigator>
        ) : (
          <LoginScreen onSignedIn={() => setSignedIn(true)} />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// Fetches /api/me once, then routes to a role-specific tab set — a member,
// a trainer, and an admin/staff account see three genuinely different apps,
// matching how the website has separate dashboards per role.
function AppShell({ onLogout }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const u = await api('/api/me');
      setUser(u);
      setError(null);
    } catch (e) {
      setError(e.message);
      if (e.message.includes('Session expired')) onLogout();
    } finally {
      setRefreshing(false);
    }
  }, [onLogout]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!user) {
    return (
      <View style={styles.splash}>
        {error ? (
          <>
            <Ionicons name="cloud-offline" size={40} color={colors.outline} />
            <Text style={styles.errorTitle}>Couldn't reach the server</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Text style={styles.errorHint}>
              Make sure the backend is running and your phone can reach it.
            </Text>
          </>
        ) : (
          <ActivityIndicator color={colors.primary} size="large" />
        )}
      </View>
    );
  }

  if (user.role === 'trainer') return <TrainerTabs user={user} refresh={refresh} onLogout={onLogout} />;
  if (user.role === 'admin' || user.role === 'staff') return <AdminTabs user={user} refresh={refresh} onLogout={onLogout} />;
  return <MemberTabs user={user} refresh={refresh} refreshing={refreshing} onLogout={onLogout} />;
}

function MemberTabs({ user, refresh, refreshing, onLogout }) {
  const [foodDay, setFoodDay] = useState(null);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    api('/api/me/food').then(setFoodDay).catch(() => {});
    Session.getBaseUrl().then(setBaseUrl);
  }, [user]);

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

  const unread = (user.notifications || []).filter(n => !n.read).length;

  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen name="Home" options={{ tabBarIcon: ({ color }) => <Ionicons name="home" size={22} color={color} /> }}>
        {({ navigation }) => <HomeTab navigation={navigation} user={user} foodDay={foodDay} checkIn={checkIn} refresh={refresh} refreshing={refreshing} />}
      </Tab.Screen>
      <Tab.Screen name="Workout" options={{ tabBarIcon: ({ color }) => <Ionicons name="barbell" size={22} color={color} /> }}>
        {() => <WorkoutScreen user={user} />}
      </Tab.Screen>
      <Tab.Screen name="Food" options={{ tabBarIcon: ({ color }) => <Ionicons name="restaurant" size={22} color={color} /> }}>
        {() => <FoodScreen day={foodDay} onRefresh={refresh} />}
      </Tab.Screen>
      <Tab.Screen
        name="Alerts"
        options={{ tabBarIcon: ({ color }) => <Ionicons name="notifications" size={22} color={color} />, tabBarBadge: unread > 0 ? unread : undefined }}
        listeners={{ tabPress: () => { if (unread > 0) markAllRead(); } }}
      >
        {() => <NotificationsScreen notifications={user.notifications || []} />}
      </Tab.Screen>
      <Tab.Screen name="Account" options={{ tabBarIcon: ({ color }) => <Ionicons name="person" size={22} color={color} /> }}>
        {({ navigation }) => <AccountScreen user={user} onSaved={refresh} onLogout={onLogout} baseUrl={baseUrl} navigation={navigation} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function TrainerTabs({ user, onLogout }) {
  // Regular trainers can't see their own PT client count or earnings unless
  // specifically granted 'trainer.earnings.view' — same gate as the website.
  const canViewEarnings = user.role === 'admin' || (user.permissions || []).includes('trainer.earnings.view');
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen name="Clients" component={TrainerClientsScreen} options={{ tabBarIcon: ({ color }) => <Ionicons name="people" size={22} color={color} /> }} />
      {canViewEarnings && (
        <Tab.Screen name="Earnings" component={TrainerEarningsScreen} options={{ tabBarIcon: ({ color }) => <Ionicons name="cash" size={22} color={color} /> }} />
      )}
      <Tab.Screen name="Hours" component={TrainerWorkingHoursScreen} options={{ tabBarIcon: ({ color }) => <Ionicons name="time" size={22} color={color} /> }} />
      <Tab.Screen name="Account" options={{ tabBarIcon: ({ color }) => <Ionicons name="person" size={22} color={color} /> }}>
        {() => <SimpleAccountScreen user={user} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function AdminTabs({ user, onLogout }) {
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen name="Dashboard" options={{ tabBarIcon: ({ color }) => <Ionicons name="grid" size={22} color={color} /> }}>
        {({ navigation }) => <AdminDashboardScreen navigation={navigation} isAdmin={user.role === 'admin'} />}
      </Tab.Screen>
      <Tab.Screen name="Members" options={{ tabBarIcon: ({ color }) => <Ionicons name="people" size={22} color={color} /> }}>
        {({ navigation }) => <AdminMembersScreen navigation={navigation} isAdmin={user.role === 'admin'} />}
      </Tab.Screen>
      <Tab.Screen name="Account" options={{ tabBarIcon: ({ color }) => <Ionicons name="person" size={22} color={color} /> }}>
        {() => <SimpleAccountScreen user={user} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

const tabOptions = {
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
};

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
